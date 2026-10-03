import { useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Delete } from 'lucide-react';
import ulfaLogo from '../../assets/nfc/ulfa-logo.png';
import PulseLogo from './PulseLogo';
import ExperienceSections from './components/ExperienceSections';
import type { ExperienceResponse, ExperienceSection } from './types/experience';
import { demoSections } from './demo/sections';
import sealImg from '../../components/EnvelopeLetter/seal.png';
import envelopeTexture from '../../components/EnvelopeLetter/envelope-texture.jpg';
import letterPaper from '../../components/EnvelopeLetter/letter-paper.webp';
import '@fontsource/great-vibes/latin-400.css';
import '@fontsource/cormorant-garamond/latin-400.css';
import '@fontsource/cormorant-garamond/latin-700-italic.css';
import './nfc-experience.css';

const PIN_LENGTH = 4;
const LOADER_MIN_MS = 1000; // just enough to confirm data is ready
const REQUEST_TIMEOUT_MS = 15000;
export type ViewerAuthType = 'NONE' | 'PIN' | 'DATE' | 'TEXT';
type Challenge = { viewerAuthType: ViewerAuthType; viewerAuthPrompt?: string | null };
type WelcomeMessage = { title?: string | null; message?: string | null; signature?: string | null };
type Appearance = { theme: string; language: string };
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1';
const years = Array.from({ length: 301 }, (_, index) => 1850 + index);

const viewerCopy = {
  en: {
    title: 'For your eyes only', fallbackPrompt: 'Enter your password to unlock this',
    continue: 'Continue to password', previousMonth: 'Previous month', nextMonth: 'Next month',
    chooseMonth: 'Choose month', chooseYear: 'Choose year', yourAnswer: 'Your answer',
    answerHint: 'Type the answer to the question above', answerPlaceholder: 'Write your answer here',
    previewOnly: 'Demo PIN: 1234', unlocked: 'Unlocked',
    previewAnswer: 'Demo: choose any date or enter any answer',
    loadError: 'Unable to load this message.', verifyError: 'Incorrect password. Please try again.',
    retry: 'Try again', unavailable: 'This message is unavailable.',
    connectionError: 'Unable to connect. Please try again.',
    emptyMessage: 'This letter has no message yet.',
  },
  ar: {
    title: 'لعيونك فقط', fallbackPrompt: 'أدخل كلمة المرور لفتح هذه الرسالة',
    continue: 'المتابعة إلى كلمة المرور', previousMonth: 'الشهر السابق', nextMonth: 'الشهر التالي',
    chooseMonth: 'اختر الشهر', chooseYear: 'اختر السنة', yourAnswer: 'إجابتك',
    answerHint: 'اكتب إجابة السؤال أعلاه', answerPlaceholder: 'اكتب إجابتك هنا',
    previewOnly: 'رمز الديمو: 1234', unlocked: 'تم الفتح',
    previewAnswer: 'للتجربة: اختر أي تاريخ أو اكتب أي إجابة',
    loadError: 'تعذر تحميل هذه الرسالة.', verifyError: 'كلمة المرور غير صحيحة. حاول مرة أخرى.',
    retry: 'حاول مرة أخرى', unavailable: 'هذه الرسالة غير متاحة.',
    connectionError: 'تعذر الاتصال. حاول مرة أخرى.',
    emptyMessage: 'لم تتم إضافة نص لهذه الرسالة بعد.',
  },
} as const;

const letterContent = {
  en: {
    greeting: "let's write what we can't say",
    body: 'Some feelings are too precious for ordinary words. So I kept them here — in every laugh, every quiet look, every moment that made us feel like home.\n\nI keep coming back to the small things: the songs that found us, the places we turned into memories, and the days that felt brighter because you were there. This is our little collection of forever.',
    sign: 'MEMORIES ABOUT US',
  },
  ar: {
    greeting: 'لنكتب ما لم نستطع قوله',
    body: 'بعض المشاعر أكبر من أن تختصرها الكلمات. احتفظت بها هنا، في كل ضحكة ونظرة هادئة ولحظة جعلتنا نشعر أننا في بيتنا.\n\nأعود دائمًا إلى تفاصيلنا الصغيرة: الأغاني التي جمعتنا، والأماكن التي صارت ذكريات، والأيام التي ازدادت جمالًا لأنك كنت فيها. هذه حكايتنا الصغيرة التي ستبقى معنا.',
    sign: 'ذكرياتنا معًا',
  },
} as const;

function calendarDays(month: Date): (number | null)[] {
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  return [...Array<null>(firstDay).fill(null), ...Array.from({ length: count }, (_, i) => i + 1)];
}

const keypad = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'delete', '0', 'ok'] as const;

function BrandMark({ small = false }: { small?: boolean }) {
  return (
    <span className={`nfc-brand-mark${small ? ' nfc-brand-mark--small' : ''}`} aria-hidden="true">
      <img src={ulfaLogo} alt="" draggable="false" />
    </span>
  );
}

export function NfcExperiencePage({ viewerAuthType = 'PIN' }: { viewerAuthType?: ViewerAuthType }) {
  const { nfcId = 'demo' } = useParams();
  const [searchParams] = useSearchParams();
  const demoType = searchParams.get('auth')?.toUpperCase();
  const demoAuth = ['NONE', 'PIN', 'DATE', 'TEXT'].includes(demoType || '')
    ? demoType as ViewerAuthType : viewerAuthType;
  const demoLanguage = searchParams.get('lang')?.startsWith('ar') ? 'ar' : 'en';
  const requestedCount = Number(searchParams.get('photos') || 30);
  const demoPhotoCount = Number.isFinite(requestedCount) ? Math.max(0, Math.min(60, Math.floor(requestedCount))) : 30;
  return <NfcExperience key={`${nfcId}:${demoAuth}:${demoLanguage}:${nfcId === 'demo' ? demoPhotoCount : ''}`}
    nfcId={nfcId} demoAuth={demoAuth} demoLanguage={demoLanguage} demoPhotoCount={demoPhotoCount} />;
}

function NfcExperience({ nfcId, demoAuth, demoLanguage, demoPhotoCount }: { nfcId: string; demoAuth: ViewerAuthType; demoLanguage: 'ar' | 'en'; demoPhotoCount: number }) {
  const isDemo = nfcId === 'demo';
  const [challenge, setChallenge] = useState<Challenge | null>(isDemo ? {
    viewerAuthType: demoAuth,
    viewerAuthPrompt: demoLanguage === 'ar' ? 'ما هو سرّنا؟' : 'What is our secret?',
  } : null);
  const [appearance, setAppearance] = useState<Appearance>({ theme: isDemo ? 'DEFAULT' : 'romantic', language: isDemo ? demoLanguage : 'en' });
  const [showSplash, setShowSplash] = useState(true);
  const [dataReady, setDataReady] = useState(isDemo);
  const [loadFailed, setLoadFailed] = useState(false);
  const [minElapsed, setMinElapsed] = useState(false);
  const [pin, setPin] = useState('');
  const [textAnswer, setTextAnswer] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [status, setStatus] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [unlocked, setUnlocked] = useState(isDemo && demoAuth === 'NONE');
  const [welcomeMessage, setWelcomeMessage] = useState<WelcomeMessage | null>(null);
  const [sections, setSections] = useState<ExperienceSection[]>(() =>
    isDemo ? demoSections(demoLanguage, demoPhotoCount) : []);

  useEffect(() => {
    if (isDemo) return;
    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    fetch(`${API_BASE_URL}/nfc-items/public/${encodeURIComponent(nfcId)}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Unable to load this message.');
        return response.json();
      })
      .then(async (body: { data: Challenge & Partial<Appearance> }) => {
        if (!active) return;
        if (!body.data || !['NONE', 'PIN', 'DATE', 'TEXT'].includes(body.data.viewerAuthType)) {
          throw new Error('Invalid challenge');
        }
        setChallenge(body.data);
        setAppearance({ theme: body.data.theme || 'romantic', language: body.data.language || 'en' });
        if (body.data.viewerAuthType === 'NONE') {
          const response = await fetch(`${API_BASE_URL}/nfc-items/public/${encodeURIComponent(nfcId)}/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ answer: '' }),
            signal: controller.signal,
          });
          if (!response.ok) throw new Error('Unable to load content');
          const result = await response.json() as { data: ExperienceResponse };
          if (!result.data) throw new Error('Invalid content response');
          if (!active) return;
          setWelcomeMessage(result.data.content ?? null);
          setSections(result.data.sections ?? []);
          setAppearance((current) => ({
            theme: result.data.theme || current.theme,
            language: result.data.language || current.language,
          }));
          setUnlocked(true);
        }
      })
      .catch(() => { if (active) setLoadFailed(true); })
      .finally(() => { window.clearTimeout(timeout); if (active) setDataReady(true); });
    return () => { active = false; window.clearTimeout(timeout); controller.abort(); };
  }, [isDemo, nfcId]);

  useEffect(() => {
    const min = window.setTimeout(() => setMinElapsed(true), LOADER_MIN_MS);
    return () => { window.clearTimeout(min); };
  }, []);

  useEffect(() => {
    if (!minElapsed || !dataReady) return;
    let cancelled = false;
    // fonts only download once text uses them, so load them explicitly before the
    // password screen appears; otherwise the text visibly resizes when they swap in
    const fonts = document.fonts
      ? Promise.all([
          document.fonts.load("400 1em 'Great Vibes'"),
          document.fonts.load("400 1em 'Cormorant Garamond'"),
          document.fonts.load("italic 700 1em 'Cormorant Garamond'"),
        ]).catch(() => undefined)
      : Promise.resolve();
    const fontTimeout = window.setTimeout(() => { if (!cancelled) setShowSplash(false); }, 3000);
    void fonts.then(() => { if (!cancelled) setShowSplash(false); });
    return () => { cancelled = true; window.clearTimeout(fontTimeout); };
  }, [minElapsed, dataReady]);

  // warm up the envelope images while the user is typing the password,
  // so the seal and paper are already decoded when the letter appears
  useEffect(() => {
    [sealImg, envelopeTexture, letterPaper].forEach((src) => {
      const img = new Image();
      img.src = src;
      void img.decode?.().catch(() => undefined);
    });
  }, []);

  const pressKey = useCallback((value: string) => {
    setStatus('');
    setPin((current) =>
      value === 'delete'
        ? current.slice(0, -1)
        : current.length < PIN_LENGTH
          ? current + value
          : current,
    );
  }, []);

  const submitAnswer = useCallback(async () => {
    if (!challenge || showSplash || loadFailed || unlocked) return;
    const authType = challenge.viewerAuthType;
    const copy = viewerCopy[appearance.language.startsWith('ar') ? 'ar' : 'en'];
    const answer = authType === 'PIN' ? pin : authType === 'DATE' ? selectedDate : textAnswer;
    if (!answer || (authType === 'PIN' && answer.length !== PIN_LENGTH) || verifying) return;
    if (nfcId === 'demo') {
      if (authType === 'PIN' && answer !== '1234') {
        setStatus(viewerCopy[appearance.language.startsWith('ar') ? 'ar' : 'en'].verifyError);
        setPin('');
        return;
      }
      setUnlocked(true);
      return;
    }
    setVerifying(true);
    setStatus('');
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let failureMessage: string = copy.connectionError;
    try {
      const response = await fetch(`${API_BASE_URL}/nfc-items/public/${encodeURIComponent(nfcId)}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const error = await response.json().catch(() => null) as { message?: string } | null;
        failureMessage = response.status === 403
          ? error?.message === 'Incorrect password' ? copy.verifyError : copy.unavailable
          : response.status === 404 ? copy.unavailable : copy.connectionError;
        throw new Error('Verification failed');
      }
      const body = await response.json() as { data: ExperienceResponse };
      if (!body.data) throw new Error(copy.loadError);
      setWelcomeMessage(body.data.content ?? null);
      setSections(body.data.sections ?? []);
      setAppearance((current) => ({
        theme: body.data.theme || current.theme,
        language: body.data.language || current.language,
      }));
      setUnlocked(true);
    } catch {
      setStatus(failureMessage);
      if (authType === 'PIN') setPin('');
    } finally {
      window.clearTimeout(timeout);
      setVerifying(false);
    }
  }, [appearance.language, challenge, loadFailed, nfcId, pin, selectedDate, showSplash, textAnswer, unlocked, verifying]);

  useEffect(() => {
    if (showSplash || loadFailed || unlocked || verifying || challenge?.viewerAuthType !== 'PIN') return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (/^[0-9]$/.test(event.key)) {
        pressKey(event.key);
      } else if (event.key === 'Backspace') {
        event.preventDefault();
        pressKey('delete');
      } else if (event.key === 'Enter') {
        void submitAnswer();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [challenge, loadFailed, pressKey, showSplash, submitAnswer, unlocked, verifying]);

  const shiftMonth = (delta: number) => setMonth((current) =>
    new Date(current.getFullYear(), current.getMonth() + delta, 1));
  const selectDay = (day: number) => {
    setSelectedDate(`${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
    setStatus('');
  };
  const language = appearance.language.startsWith('ar') ? 'ar' : 'en';
  const copy = viewerCopy[language];
  const locale = language === 'ar' ? 'ar' : 'en';
  const weekdays = Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(new Date(2024, 0, index + 7)));
  const monthNames = Array.from({ length: 12 }, (_, index) =>
    new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date(2020, index, 1)));

  if (unlocked && !showSplash) {
    const letter = isDemo ? {
      title: letterContent[language].greeting,
      message: letterContent[language].body,
      signature: letterContent[language].sign,
    } : welcomeMessage;
    return (
      <ExperienceSections
        sections={sections}
        letter={letter}
        emptyMessage={copy.emptyMessage}
        language={language}
        theme={appearance.theme}
      />
    );
  }

  return (
    <main className={`nfc-intro nfc-intro--theme-${appearance.theme}`} dir={language === 'ar' ? 'rtl' : 'ltr'} lang={language}>
      <div className="nfc-intro__artboard">
        {showSplash ? (
          <section className="nfc-intro__splash" aria-label="Ulfa introduction">
            <PulseLogo />
            <button
              className="nfc-intro__skip"
              type="button"
              onClick={() => { if (dataReady) setShowSplash(false); }}
              disabled={!dataReady}
              aria-label={copy.continue}
            />
          </section>
        ) : loadFailed || !challenge ? (
          <section className="nfc-intro__password" aria-label={copy.loadError}>
            <BrandMark />
            <h1 className="nfc-intro__title">{copy.title}</h1>
            <p className="nfc-intro__subtitle" role="alert">{copy.loadError}</p>
            <button className="nfc-intro__panel-ok nfc-intro__retry" type="button" onClick={() => window.location.reload()}>{copy.retry}</button>
          </section>
        ) : (
          <section className="nfc-intro__password" aria-label="Private message password">
            <BrandMark />
            <h1 className="nfc-intro__title">{copy.title}</h1>
            <p className="nfc-intro__subtitle">{challenge.viewerAuthPrompt || copy.fallbackPrompt}</p>

            {challenge.viewerAuthType === 'PIN' && (
              <>
                <div
                  className="nfc-intro__pin-dots"
                  role="status"
                  aria-label={`${pin.length} of ${PIN_LENGTH} digits entered`}
                >
                  {Array.from({ length: PIN_LENGTH }, (_, index) => (
                    <span
                      key={index}
                      className={`nfc-intro__dot${index < pin.length ? ' nfc-intro__dot--filled' : ''}`}
                      aria-hidden="true"
                    />
                  ))}
                </div>

                <div className="nfc-intro__keypad" role="group" aria-label="PIN keypad">
                  {keypad.map((value) => (
                    <button
                      key={value}
                      className={`nfc-intro__key${value === 'delete' ? ' nfc-intro__key--delete' : ''}${value === 'ok' ? ' nfc-intro__key--ok' : ''}`}
                      type="button"
                      onClick={() => value === 'ok' ? void submitAnswer() : pressKey(value)}
                      aria-label={value === 'delete' ? 'Delete last digit' : value === 'ok' ? 'OK' : value}
                      disabled={verifying || (value === 'delete' ? !pin : value === 'ok' ? pin.length !== PIN_LENGTH : false)}
                    >
                      {value === 'delete' ? <Delete aria-hidden="true" strokeWidth={2.2} /> : value === 'ok' ? 'OK' : value}
                    </button>
                  ))}
                </div>
              </>
            )}

            {challenge.viewerAuthType === 'DATE' && (
              <div className="nfc-intro__panel nfc-intro__calendar">
                <div className="nfc-intro__calendar-header">
                  <button type="button" onClick={() => shiftMonth(-1)} aria-label={copy.previousMonth}>‹</button>
                  <div className="nfc-intro__calendar-jump">
                    <select aria-label={copy.chooseMonth} value={month.getMonth()}
                      onChange={(event) => setMonth(new Date(month.getFullYear(), Number(event.target.value), 1))}>
                      {monthNames.map((name, index) => <option key={name} value={index}>{name}</option>)}
                    </select>
                    <select aria-label={copy.chooseYear} value={month.getFullYear()}
                      onChange={(event) => setMonth(new Date(Number(event.target.value), month.getMonth(), 1))}>
                      {years.map((year) => <option key={year} value={year}>{year}</option>)}
                    </select>
                  </div>
                  <button type="button" onClick={() => shiftMonth(1)} aria-label={copy.nextMonth}>›</button>
                </div>
                <div className="nfc-intro__calendar-grid">
                  {weekdays.map((day) => <span className="nfc-intro__weekday" key={day}>{day}</span>)}
                  {calendarDays(month).map((day, index) => day === null
                    ? <span key={`empty-${index}`} />
                    : <button type="button" key={`${month.toISOString()}-${day}`}
                        className={selectedDate === `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` ? 'is-selected' : ''}
                        onClick={() => selectDay(day)}>{day}</button>)}
                </div>
                <button className="nfc-intro__panel-ok" type="button" disabled={!selectedDate || verifying} onClick={() => void submitAnswer()}>OK</button>
              </div>
            )}
            {challenge.viewerAuthType === 'TEXT' && (
              <form className="nfc-intro__panel nfc-intro__text-panel" onSubmit={(event) => { event.preventDefault(); void submitAnswer(); }}>
                <span className="nfc-intro__text-ornament" aria-hidden="true">✦</span>
                <label htmlFor="nfc-text-answer">{copy.yourAnswer}</label>
                <p className="nfc-intro__text-hint">{copy.answerHint}</p>
                <input id="nfc-text-answer" type="text" autoComplete="off" value={textAnswer}
                  onChange={(event) => { setTextAnswer(event.target.value); setStatus(''); }} placeholder={copy.answerPlaceholder} />
                <button className="nfc-intro__panel-ok" type="submit" disabled={!textAnswer.trim() || verifying}>OK</button>
              </form>
            )}
            {(status || isDemo) && <p className="nfc-intro__status" role="status">{status || (challenge.viewerAuthType === 'PIN' ? copy.previewOnly : copy.previewAnswer)}</p>}
          </section>
        )}
      </div>
    </main>
  );
}
