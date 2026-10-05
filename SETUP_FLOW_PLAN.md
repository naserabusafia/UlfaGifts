# خطة صفحة الـ Setup (تجهيز هدية الـ NFC)

> لمين: الشخص اللي اشترى السنسال (لنفسه أو هدية). بيدخل من رابط `/setup/:editToken` اللي بيطلع مع الطلب (`orders.service.ts` بيبني `setupUrl` أصلاً).
> الهدف: يقفل الهدية بسر، يختار السكشنز ويرتبها، يعبيها بنفس شكل العرض الحقيقي، يشوف بروتوتايب كامل، وينشر.

## القرارات (محسومة)

- **تشفير end-to-end**: الصور والصوت والنصوص بتتشفّر بالمتصفح. السيرفر و S3 ما بيشوفوا إلا bytes مشفرة.
- **PIN من 6 أرقام.**
- **كلشي تقيل بيصير بالخلفية**: الضغط والتشفير والرفع. المستخدم ما بيستنى إشي.
- **بدون over-engineering**: ما في جداول أو خدمات زيادة إلا إذا ضرورية. كل سكشن صوره إله (ما في مشاركة صور بين السكشنز)، ما في cron، ما في outbox.

## حالة التنفيذ (2026-10-05)

P0 → P7 منفّذين ومفحوصين. P8 (الـ bucket الحقيقي) الكود جاهز، بس بدها إعداد AWS (تحت).

**تغييرات عن الخطة الأصلية:**
- السيرفر **ما بيستلم السر أبداً**، ولا وقت التحقق. المتصفح بيشتق من السر مفتاحين بنفس عملية PBKDF2: واحد بيفك التشفير وبيضل بالمتصفح، وواحد بيتبعت للسيرفر بس للتحقق وعدّ المحاولات (bcrypt).
- الرفع صار بـ presigned **PUT** والـ `Content-Length` داخل التوقيع، فـ S3 بيرفض أي حجم غير المتفق عليه. أبسط من POST policy.
- بالتطوير: driver تخزين محلي (`STORAGE_DRIVER=local`، ملفات بـ `Ulfa-B/storage/` وروابط موقّعة) بدل MinIO، لأنه ما في Docker. نفس الواجهة بالضبط.
- شريط الفيلم بيشتغل من صورة وحدة (الكومبوننت بيعرض شريط واحد لأقل من 6)، فالحد الأدنى صار 1.
- `GET nfc-items/edit-mode/:editToken` انشال لأنه كان بيكشف المحتوى لأي حدا معه الرابط.

**تشغيل:**
- Migrations: `20261009_add_viewer_lockout_to_nfc_items.sql` و `20261010_add_setup_and_encrypted_media.sql` (أو `DB_SYNCHRONIZE=true` بالتطوير).
- رابط التجهيز: `/setup/<edit_token>` (بيطلع مع الطلب كـ `setupUrl`).

**التحويل لـ S3:**
1. Env بالباك: `STORAGE_DRIVER=s3`, `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` (انظر `.env.example`).
2. Bucket: Block Public Access كامل، **Versioning OFF**، SSE-S3.
3. CORS على الـ bucket (المتصفح بيرفع وبينزّل مباشرة):
   ```json
   [{ "AllowedOrigins": ["https://YOUR-DOMAIN"], "AllowedMethods": ["PUT", "GET"],
      "AllowedHeaders": ["content-type"], "MaxAgeSeconds": 3600 }]
   ```
4. IAM للباك: `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` على `arn:aws:s3:::BUCKET/items/*` بس.

**الفحوصات:**
- Backend: 48 jest test (منها lockout، تطبيع الأجوبة، S3 driver، التخزين المحلي).
- Frontend: 21 test (منها التشفير، كود الاسترجاع، التطبيع).
- E2E على الـ API الحقيقي: قفل، فتح، رفع، ترتيب، نشر، فك تشفير المستلم، حذف من التخزين، lockout، استرجاع، تغيير السر.
- بالمتصفح (موبايل وديسكتوب): الفلو كامل من الترحيب للنشر، وصفحة المستلم بتفك التشفير.

---

## 0. الوضع الحالي

| الموجود | ملاحظة |
| --- | --- |
| `nfc_items.edit_token` + `GET nfc-items/edit-mode/:editToken` | بيرجع الأيتم كامل لأي حدا معه الرابط. لازم ينقفل بعد ما يتعين السر. |
| `viewer_auth_type` (NONE/PIN/DATE/TEXT) + `viewer_auth_prompt` | نفس الأنواع اللي بدنا ياها. |
| `hashPassword` = SHA-256 بدون salt، وما في حد للمحاولات | **مشكلة أمنية** — بتنحل بـ P0. |
| `sections` + `item_sections` (ترتيب + `is_visible`) | جاهزين للاختيار والترتيب. |
| الكومبوننتس: `message`, `photo_wheel`, `voice_note`, `memory_calendar`, `film_strip` | بنعيد استخدامها كـ editors. |
| `framer-motion` | فيه `Reorder` للسحب والترتيب. |

---

## 1. الفلو

```
/setup/:token
  ├─ (أول مرة)          ① ترحيب ← ② قفل الهدية ← ③ تحذير + كود استرجاع
  ├─ (بعد تعيين السر)   شاشة السر (نفس شاشة الـ NFC)
  ④ اختيار السكشنز وترتيبها
  ⑤ تعبئة كل سكشن بنفس شكله الحقيقي
  ⑥ بروتوتايب كامل
  ⑦ نشر — وبعدها تعديل/حذف/إضافة أي وقت
```

Stepper فوق، الرجوع مسموح، وكل تغيير بينحفظ تلقائياً.

### ① ترحيب
اسم المنتج، الثيم/المناسبة، اللغة.

### ② قفل الهدية
- **PIN** (6 أرقام) / **تاريخ** / **سؤال وجواب**، مع بريفيو لشاشة الدخول اللي رح يشوفها المستلم.
- الهنت/السؤال (`viewer_auth_prompt`): إجباري مع TEXT، اختياري مع الباقي.
- إدخال السر مرتين.
- Normalization (نفسها بالفرونت والباك):
  - TEXT: trim، lowercase، NFKC، أ/إ/آ←ا، ة←ه، ى←ي، حذف التشكيل والتطويل، الأرقام العربية←لاتينية، المسافات المتكررة←وحدة.
  - DATE: `YYYY-MM-DD`.
  - PIN: الأرقام العربية←لاتينية، لازم 6 أرقام بالضبط.
- منع الواضح: كل الأرقام نفس الرقم (`000000`)، أو متسلسلة (`123456`, `654321`).

### ③ التحذير
Checkboxes إجبارية:
- ☐ السر رح يُطلب منك كل ما تفوت على صفحة التجهيز.
- ☐ صاحب الهدية لازم يكون عارف الجواب.
- ☐ ما حدا، ولا إحنا، بيقدر يرجّع السر أو يشوف المحتوى.

وتحتهم **كود الاسترجاع** مع زر نسخ/تنزيل. بيسمح بتعيين سر جديد إذا نسي القديم.

### ④ السكشنز
- كارت لكل سكشن: بريفيو حي مصغّر (الكومبوننت الحقيقي ببيانات `demo/sections.ts`، `scale` + `pointer-events: none`)، وزر بريفيو كامل بـ bottom-sheet، وToggle.
- **الرسالة مثبّتة أول وحدة** (مقفلة)، والسيرفر بيفرضها `display_order = 0`.
- ترتيب بالسحب (`Reorder.Group`) + أزرار ↑↓.

### ⑤ التعبئة — الكومبوننت الحقيقي هو الـ editor
Wrapper لكل سكشن (`editors/*Editor.tsx`) بيرندر الكومبوننت الحقيقي بالـ draft + أدوات فوقه. الكومبوننتس الأصلية بيضافلها بس prop `editable` و empty-state.

| سكشن | التعبئة | قيود |
| --- | --- | --- |
| **الرسالة** | الظرف مفتوح والورقة editable (تحية، نص، توقيع) بنفس الخط. | إجبارية، 2000 حرف. |
| **الدولاب** | الدولاب الحقيقي؛ فاضي = slots شبحية + "+". الضغط على الصورة النشطة: كابشن، نقل، حذف. تحته درج thumbnails للترتيب السريع. | 1–500 صورة. |
| **الفويس نوت** | الفينيل نفسه + 🎙 سجّل / 📁 ملف. أثناء التسجيل: مؤقت + الإبرة بتتحرك. بعدها: اسمع، أعد، احفظ. | 5 نوتس، 3 دقايق للنوت. |
| **التقويم** | التقويم الحقيقي؛ تضغط يوم ← تضيف صورة. | صورة لكل يوم إلها تاريخ. |
| **الفيلم** | الشريطين + "+"، ومؤشر "ضيف 3 كمان". | 6 صور على الأقل. |

السكشن الناقص ما بيظهر للمستلم (نفس منطق `orderedSections`)، وبيتعلّم ⚠ بالـ setup.

### ⑥ البروتوتايب
`NfcExperience` نفسها بس بتاخد البيانات من الـ draft المحلي (prop `initialData`) بدل الـ fetch. بتبلش من شاشة السر. زر "عدّل هاد السكشن" بيرجعه للـ editor.

### ⑦ النشر
`setup_status: DRAFT → PUBLISHED`. قبل النشر `/nfc/:id` بيعرض "الهدية لسا عم تتجهّز 🎁". بعد النشر التعديلات بتظهر مباشرة. تغيير السر بيحتاج السر الحالي (بنعيد تغليف المفتاح بس، الصور ما بتتأثر).

---

## 2. الرفع بالخلفية — ما بدنا يحس بأي بطء

المبدأ: **الصورة بتظهر فوراً، وكلشي ثاني بيصير وراها.**

1. يختار صور ← بنعمل `URL.createObjectURL(file)` وبتطلع **فوراً** بالدولاب (أقل من 100ms).
2. بنحطهم بـ **upload queue** واحد للصفحة كلها (singleton برا الـ React steps). يعني إذا انتقل لخطوة ثانية أو سكشن ثاني، الرفع بيضل ماشي.
3. **Web Worker** (ما بيعلّق الواجهة) لكل صورة: decode ← thumb أول (480px) ← full (2048px) ← WebP ← تشفير.
4. الرفع: 3 ملفات بنفس الوقت، retry تلقائي (3 مرات، backoff) إذا النت قطع.
5. مؤشر صغير ثابت بالزاوية: "عم نرفع 12 من 30" — بيقدر يتجاهله. والصورة اللي لسا ما خلصت عليها دائرة progress صغيرة.
6. إذا حاول يسكّر الصفحة والرفع مش خالص ← `beforeunload` تحذير.
7. "نشر" بيستنى الـ queue يخلص (بيطلع "لحظة، عم نكمّل الرفع...").
8. الحذف optimistic: بتختفي فوراً، والطلب بالخلفية. إذا فشل بترجع مع رسالة.

---

## 3. الـ API (Backend)

موديول `src/modules/setup/` (public)، و`src/modules/storage/` (S3 client).

| Method | Route | شو بيعمل |
| --- | --- | --- |
| GET | `/setup/:token` | `hasSecret`, `authType`, `prompt`, `setupStatus`, الثيم واللغة. **بدون محتوى.** |
| PUT | `/setup/:token/lock` | أول مرة (أو بـ session لتغيير السر): `authType`, `prompt`, `answer`, `salt`, `wrappedKey`, `recoveryWrappedKey`. |
| POST | `/setup/:token/session` | `{ answer }` ← تحقق ← **setup JWT** (ساعتين، مربوط بالأيتم) + `salt`/`wrappedKey`. |
| POST | `/setup/:token/recover` | `{ recoveryCode }` ← تحقق من هاشه ← session + `recoveryWrappedKey` عشان يعين سر جديد. |
| GET | `/setup/:token/draft` 🔒 | المحتوى المشفّر + السكشنز + روابط GET موقّعة. |
| PUT | `/setup/:token/sections` 🔒 | `[{ sectionKey, isVisible, displayOrder }]`. |
| PUT | `/setup/:token/content` 🔒 | الرسالة (مشفّرة). |
| POST | `/setup/:token/media` 🔒 | بينشئ `item_media` بحالة `PENDING` + بيرجع presigned POST للـ full والـ thumb (بحد حجم). |
| POST | `/setup/:token/media/:id/complete` 🔒 | HEAD على S3 ← `READY`. |
| PATCH | `/setup/:token/media/:id` 🔒 | كابشن / ترتيب / تاريخ. |
| DELETE | `/setup/:token/media/:id` 🔒 | يمسح من S3 **أولاً** ثم من الـ DB. |
| POST | `/setup/:token/publish` 🔒 | `PUBLISHED`. |

**السيرفر بيشوف السر؟** لا. بيستلم بس "مفتاح تحقق" مشتق من السر بالمتصفح (للـ bcrypt والـ lockout)، وما بيقدر يرجّع منه السر ولا مفتاح فك التشفير.

---

## 4. قاعدة البيانات

```sql
ALTER TABLE nfc_items
  ADD COLUMN setup_status         varchar(16) NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN key_salt             text,   -- base64
  ADD COLUMN wrapped_key          text,   -- base64: DEK مغلّف بمفتاح من السر
  ADD COLUMN recovery_wrapped_key text,   -- base64: DEK مغلّف بكود الاسترجاع
  ADD COLUMN recovery_hash        varchar(100), -- bcrypt لكود الاسترجاع
  ADD COLUMN failed_attempts      int NOT NULL DEFAULT 0,
  ADD COLUMN locked_until         timestamptz;

ALTER TABLE item_media
  ALTER COLUMN url DROP NOT NULL,         -- url بيضل للأيتمز القديمة
  ADD COLUMN storage_key varchar(255),    -- items/{itemId}/{mediaId}/full
  ADD COLUMN thumb_key   varchar(255),    -- items/{itemId}/{mediaId}/thumb
  ADD COLUMN mime        varchar(64),
  ADD COLUMN bytes       int,
  ADD COLUMN status      varchar(16) NOT NULL DEFAULT 'READY';  -- PENDING | READY

ALTER TABLE item_contents
  ADD COLUMN is_encrypted boolean NOT NULL DEFAULT false;
```

الكابشنز ونص الرسالة بيتخزنوا ciphertext (base64) بنفس الأعمدة.

---

## 5. التشفير (WebCrypto — بدون مكتبات)

1. أول تعيين للسر: المتصفح بيولّد **DEK** (AES-256-GCM).
2. `KEK = PBKDF2-SHA256(normalize(secret), salt, 600,000)`.
3. `wrappedKey = AES-GCM(KEK, DEK)` ← للسيرفر. الـ DEK ما بيطلع من المتصفح.
4. كود الاسترجاع (16 byte عشوائي) ← `recoveryWrappedKey` بنفس الطريقة.
5. كل ملف/نص: `iv(12 byte) + AES-GCM(DEK, data)`.
6. المستلم: السر ← السيرفر بيتحقق ← بيعطيه `salt + wrappedKey` + روابط ← فك التشفير بـ worker ← `createObjectURL`. الـ thumbs أول، والـ full وقت الحاجة.

**بيتشفّر:** الصور، الصوت، الرسالة، التوقيع، الكابشنز.
**ما بيتشفّر:** نوع السكشن، الترتيب، `memory_date`.

**الحد الصريح:** PIN من 6 أرقام = مليون احتمال. اللي معه نسخة من الداتابيز بيقدر نظرياً يجربها offline (الـ PBKDF2 بيخلي هاد ياخد وقت وجهد كبير، بس مش مستحيل). يعني ما منقدر نشوف **بالصدفة أو بشغلنا العادي**. السؤال النصي القوي بيكون أقوى.

---

## 6. الضغط والصوت

### الصور (بالـ worker)
- `createImageBitmap(file, { imageOrientation: 'from-image' })` ← `OffscreenCanvas` ← resize.
- WebP بـ `@jsquash/webp` (WASM، تقريباً 300KB، بس بصفحة الـ setup). سفاري ما بيعمل WebP بـ canvas.
- full: 2048px، جودة 0.82. thumb: 480px، جودة 0.72.
- إعادة الضغط بتمسح EXIF/GPS.
- 2–3 صور بنفس الوقت (ذاكرة الآيفون).

### الصوت
- `getUserMedia({ audio: true })` ← `MediaRecorder`. قبل الطلب جملة بتشرح ليش.
- إذا رفض (`NotAllowedError`): تعليمات كيف يرجع يسمح + "اختار ملف بدالها".
- النوع: `audio/webm;codecs=opus` (Chrome) أو `audio/mp4` (Safari) — حسب `MediaRecorder.isTypeSupported`، وبنخزن الـ mime.
- ملف من الجهاز: `accept="audio/*"`، ≤ 15MB، ≤ 3 دقايق.

---

## 7. S3 والحذف

- `StorageService` واحد بـ `@aws-sdk/client-s3` + `@aws-sdk/s3-presigned-post` + `@aws-sdk/s3-request-presigner`.
- التطوير: **MinIO** بـ docker (نفس الكود، `S3_ENDPOINT` مختلف).
- Env: `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`.

**الحذف — الصورة لازم تروح من S3:**
1. `DELETE media/:id` ← `DeleteObjects` (full + thumb) ← إذا نجح بنمسح الصف من الـ DB. إذا S3 فشل، الصف بيضل والطلب بيرجع error، والفرونت بيعيد المحاولة. **ما في حالة بيروح فيها الصف ويضل الملف.**
2. حذف الأيتم أو الطلب: نجمع الـ keys ونمسحهم من S3 قبل حذف الـ DB.
3. رفع ما كمل (`PENDING` أقدم من 24 ساعة): بينمسح (S3 + DB) أول ما يفتح الـ session. ما في cron.
4. إعدادات الـ bucket:
   - **Versioning OFF**، غير هيك المحذوف بيضل كنسخة قديمة.
   - Block Public Access كامل. القراءة بروابط موقّعة (10 دقايق).
   - CORS للدومين تاعنا بس.
   - IAM فيه بس `PutObject/GetObject/DeleteObject` على هاد الـ bucket.

---

## 8. الفرونت إند

```
src/features/nfc-setup/
  SetupPage.tsx                 // /setup/:token + stepper + guard
  steps/      Welcome, Lock, LockWarning, Sections, Fill, Preview, Publish
  editors/    Message, PhotoWheel, VoiceNote, MemoryCalendar, FilmStrip, MediaTray
  media/      image.worker.ts, uploadQueue.ts, recorder.ts
  crypto.ts                     // DEK, PBKDF2, wrap/unwrap, encrypt/decrypt
  setupApi.ts
  useSetupDraft.ts              // state + autosave

src/features/nfc-experience/
  components/AuthChallenge.tsx  // مستخرج من NfcExperiencePage — مشترك
  utils/normalizeSecret.ts      // مشترك
```

تعديلات على الموجود:
- `PhotoWheel`, `FilmStrip`, `MemoryCalendar`, `VoiceNote`, `EnvelopeLetter`: `editable` + empty-state.
- `NfcExperience`: prop `initialData` للبروتوتايب.
- صفحة المستلم: فك التشفير.
- `PIN_LENGTH = 6`.
- i18n: `ar.json` / `en.json`.

---

## 9. المراحل

| # | المرحلة | بيطلع منها |
| --- | --- | --- |
| **P0** | أمان التحقق | bcrypt + normalization + 5 محاولات ثم قفل 15 دقيقة + PIN 6. |
| **P1** | Schema + S3 | migrations، `StorageService` + MinIO، presigned upload، حذف من S3. |
| **P2** | قفل الهدية | `crypto.ts`، Lock + Warning + recovery، `/setup/:token`, `/lock`, `/session`، `AuthChallenge`. |
| **P3** | السكشنز | اختيار + بريفيو + ترتيب. |
| **P4** | الرسالة + الصور | MessageEditor، worker + upload queue، PhotoWheelEditor + MediaTray. |
| **P5** | الصوت | تسجيل + صلاحيات + ملف محلي. |
| **P6** | التقويم + الفيلم | editors. |
| **P7** | بروتوتايب + نشر | Preview، publish، فك التشفير عند المستلم. |
| **P8** | S3 الحقيقي | bucket + IAM + CORS + تبديل الـ env. |

## 10. لاحقاً (مش هلأ)
- ترتيب الصور تلقائياً على التقويم من تاريخ التصوير.
- مشاركة نفس الصورة بين أكثر من سكشن.
- فيديو حقيقي مرفوع.
- مفتاح بالـ URL fragment تاع التاغ (حماية كاملة حتى من صاحب السيرفر).
