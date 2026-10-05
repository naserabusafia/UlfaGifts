-- Sections, default section lists and Arabic/English copy for every theme occasion.
-- Run after migrations/20261008_add_themes_and_occasions.sql.
-- Safe to re-run: existing sections, defaults and copy are never overwritten.
BEGIN;

INSERT INTO sections (key, name, is_active) VALUES
  ('photo_wheel', 'Photo wheel', true),
  ('voice_note', 'Voice note', true),
  ('memory_calendar', 'Memory calendar', true),
  ('film_strip', 'Film strip', true)
ON CONFLICT (key) DO NOTHING;

-- Sections a new item of each occasion starts with (copied into item_sections).
INSERT INTO occasion_sections (occasion_id, section_id, display_order)
SELECT occasion.id, section.id, defaults.display_order
FROM (VALUES
  ('luxury', 'romantic', 'photo_wheel', 1),
  ('luxury', 'romantic', 'voice_note', 2),
  ('luxury', 'romantic', 'memory_calendar', 3),
  ('luxury', 'romantic', 'film_strip', 4),
  ('luxury', 'birthday', 'photo_wheel', 1),
  ('luxury', 'birthday', 'voice_note', 2),
  ('luxury', 'birthday', 'film_strip', 3),
  ('luxury', 'anniversary', 'photo_wheel', 1),
  ('luxury', 'anniversary', 'memory_calendar', 2),
  ('luxury', 'anniversary', 'voice_note', 3),
  ('luxury', 'anniversary', 'film_strip', 4),
  ('casual', 'birthday', 'photo_wheel', 1),
  ('casual', 'birthday', 'film_strip', 2),
  ('casual', 'birthday', 'voice_note', 3),
  ('casual', 'friendship', 'photo_wheel', 1),
  ('casual', 'friendship', 'film_strip', 2),
  ('casual', 'friendship', 'memory_calendar', 3)
) AS defaults(theme_key, occasion_key, section_key, display_order)
JOIN themes AS theme ON theme.key = defaults.theme_key
JOIN theme_occasions AS occasion ON occasion.theme_id = theme.id AND occasion.key = defaults.occasion_key
JOIN sections AS section ON section.key = defaults.section_key
ON CONFLICT (occasion_id, section_id) DO NOTHING;

INSERT INTO occasion_section_contents (occasion_id, language, section_id, title, message)
SELECT occasion.id, copy.language, section.id, copy.title, copy.message
FROM (VALUES
  -- luxury / romantic
  ('luxury', 'romantic', 'photo_wheel', 'en', 'Every picture holds a memory, and every memory tells our story.', 'Click on each photo to relive the moment.'),
  ('luxury', 'romantic', 'photo_wheel', 'ar', 'كل صورة تحمل ذكرى، وكل ذكرى تحكي حكايتنا.', 'اضغط على كل صورة لتعيش اللحظة من جديد.'),
  ('luxury', 'romantic', 'voice_note', 'en', 'Something I want you to hear in my voice', 'Press play and let my voice tell you.'),
  ('luxury', 'romantic', 'voice_note', 'ar', 'في شي حابب تسمعه بصوتي', 'اضغط تشغيل… وخلّي الصوت يحكيلك.'),
  ('luxury', 'romantic', 'memory_calendar', 'en', 'Our beautiful days', 'Every day with a photo is a day we will never forget.'),
  ('luxury', 'romantic', 'memory_calendar', 'ar', 'أيامنا الحلوة', 'كل يوم عليه صورة… هو يوم ما بننساه.'),
  ('luxury', 'romantic', 'film_strip', 'en', 'Scenes from our story', 'Tap any scene, or play the whole film.'),
  ('luxury', 'romantic', 'film_strip', 'ar', 'مشاهد من حكايتنا', 'اضغط على أي مشهد… أو شغّل الفيلم كامل.'),
  -- luxury / birthday
  ('luxury', 'birthday', 'photo_wheel', 'en', 'Every year with you is a gift worth remembering.', 'Click on each photo to relive the moment.'),
  ('luxury', 'birthday', 'photo_wheel', 'ar', 'كل سنة معك هدية تستحق أن تُذكر.', 'اضغط على كل صورة لتعيش اللحظة من جديد.'),
  ('luxury', 'birthday', 'voice_note', 'en', 'A birthday wish, in my own voice', 'Press play and hear it from me.'),
  ('luxury', 'birthday', 'voice_note', 'ar', 'أمنية عيد ميلادك… بصوتي', 'اضغط تشغيل واسمعها مني.'),
  ('luxury', 'birthday', 'memory_calendar', 'en', 'A year of beautiful days', 'Every day with a photo is a day we celebrated together.'),
  ('luxury', 'birthday', 'memory_calendar', 'ar', 'سنة من الأيام الحلوة', 'كل يوم عليه صورة… يوم احتفلنا فيه سوا.'),
  ('luxury', 'birthday', 'film_strip', 'en', 'Scenes from your year', 'Tap any scene, or play the whole film.'),
  ('luxury', 'birthday', 'film_strip', 'ar', 'مشاهد من سنتك', 'اضغط على أي مشهد… أو شغّل الفيلم كامل.'),
  -- luxury / anniversary
  ('luxury', 'anniversary', 'photo_wheel', 'en', 'Every year together writes another page of our story.', 'Click on each photo to relive the moment.'),
  ('luxury', 'anniversary', 'photo_wheel', 'ar', 'كل سنة معًا تكتب صفحة جديدة من حكايتنا.', 'اضغط على كل صورة لتعيش اللحظة من جديد.'),
  ('luxury', 'anniversary', 'voice_note', 'en', 'Words I want you to hear on our day', 'Press play and let my voice tell you.'),
  ('luxury', 'anniversary', 'voice_note', 'ar', 'كلام حابب تسمعه بيومنا', 'اضغط تشغيل… وخلّي الصوت يحكيلك.'),
  ('luxury', 'anniversary', 'memory_calendar', 'en', 'The days that made us', 'Every marked day is a chapter of us.'),
  ('luxury', 'anniversary', 'memory_calendar', 'ar', 'الأيام اللي صنعتنا', 'كل يوم عليه صورة… فصل من حكايتنا.'),
  ('luxury', 'anniversary', 'film_strip', 'en', 'Our story, scene by scene', 'Tap any scene, or play the whole film.'),
  ('luxury', 'anniversary', 'film_strip', 'ar', 'حكايتنا مشهد ورا مشهد', 'اضغط على أي مشهد… أو شغّل الفيلم كامل.'),
  -- casual / birthday
  ('casual', 'birthday', 'photo_wheel', 'en', 'Another year, even more good times!', 'Spin through the fun.'),
  ('casual', 'birthday', 'photo_wheel', 'ar', 'سنة كمان، وضحك أكتر!', 'لفّ وشوف شو عملنا.'),
  ('casual', 'birthday', 'voice_note', 'en', 'Hit play, I have something to say', 'It is short, I promise.'),
  ('casual', 'birthday', 'voice_note', 'ar', 'اكبس تشغيل، عندي إشي بدي أحكيلك ياه', 'قصير، وعد.'),
  ('casual', 'birthday', 'memory_calendar', 'en', 'Our best days this year', 'Tap a day to see what we were up to.'),
  ('casual', 'birthday', 'memory_calendar', 'ar', 'أحلى أيامنا هالسنة', 'اكبس على يوم وشوف شو كنا عاملين.'),
  ('casual', 'birthday', 'film_strip', 'en', 'Moments from this year', 'Tap a scene or roll the whole thing.'),
  ('casual', 'birthday', 'film_strip', 'ar', 'لقطات من هالسنة', 'اكبس على لقطة… أو شغّل الفيلم كله.'),
  -- casual / friendship
  ('casual', 'friendship', 'photo_wheel', 'en', 'Friends, photos, and way too many inside jokes.', 'Tap a photo and remember.'),
  ('casual', 'friendship', 'photo_wheel', 'ar', 'صحاب، صور، ونكت ما حدا بيفهمها غيرنا.', 'اكبس على صورة وتذكّر.'),
  ('casual', 'friendship', 'voice_note', 'en', 'A little voice note, just for you', 'Press play.'),
  ('casual', 'friendship', 'voice_note', 'ar', 'فويس نوت صغير إلك', 'اكبس تشغيل واسمع.'),
  ('casual', 'friendship', 'memory_calendar', 'en', 'Days we will never forget', 'Every photo is a day we spent together.'),
  ('casual', 'friendship', 'memory_calendar', 'ar', 'أيام ما بتنتسى', 'كل صورة يوم قضيناه سوا.'),
  ('casual', 'friendship', 'film_strip', 'en', 'Scenes from our friendship', 'Tap a scene or play the whole film.'),
  ('casual', 'friendship', 'film_strip', 'ar', 'لقطات من صحبتنا', 'اكبس على لقطة… أو شغّل الفيلم كله.')
) AS copy(theme_key, occasion_key, section_key, language, title, message)
JOIN themes AS theme ON theme.key = copy.theme_key
JOIN theme_occasions AS occasion ON occasion.theme_id = theme.id AND occasion.key = copy.occasion_key
JOIN sections AS section ON section.key = copy.section_key
ON CONFLICT (occasion_id, language, section_id) DO NOTHING;

COMMIT;
