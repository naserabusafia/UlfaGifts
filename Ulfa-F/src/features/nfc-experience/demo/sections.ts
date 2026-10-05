import type { ExperienceMedia, ExperienceSection } from '../types/experience';
const PHOTO_IDS = ['10', '11', '12', '15', '16', '18', '20', '21', '22', '24', '25', '26', '27', '28', '29', '30', '37', '42', '43', '49', '50', '54', '57', '58', '64', '65', '66', '76', '82', '83'];
const COPY = {
  ar: {
    title: 'كل صورة تحمل ذكرى، وكل ذكرى تحكي حكايتنا.',
    message: 'اضغط على كل صورة لتعيش اللحظة من جديد.',
    captions: ['لحظة صغيرة، وذكرى تبقى معنا.', 'بعض الأماكن تشبه شعور البيت.',
      'تفاصيل بسيطة صنعت حكايتنا.', 'كل طريق مشيناه صار جزءًا منّا.',
      'هنا تركنا ضحكة، وأخذنا ذكرى.', 'للأيام الجميلة لون لا يبهت.',
      'صورة واحدة تعيد إلينا يومًا كاملًا.', 'بين كل الذكريات، نعود لهذه اللحظة.',
      'أجمل ما في الرحلة أننا كنا معًا.', 'حكاية نحب أن نتذكرها كل مرة.'],
    voice: ['في شي حابب تسمعه بصوتي', 'اضغط تشغيل… وخلّي الصوت يحكيلك.'],
    calendar: ['أيامنا الحلوة', 'كل يوم عليه صورة… هو يوم ما بننساه.'],
    film: ['مشاهد من حكايتنا', 'اضغط على أي مشهد… أو شغّل الفيلم كامل.'],
  },
  en: {
    title: 'Every picture holds a memory, and every memory tells our story.',
    message: 'Click on each photo to relive the moment.',
    captions: ['A little moment, a memory that stays.', 'Some places feel like home.',
      'Simple details that became our story.', 'Every road we took became part of us.',
      'We left a laugh here and took a memory.', 'Beautiful days never lose their color.',
      'One picture brings back a whole day.', 'Among all our memories, we return to this moment.',
      'The best part of the journey was being together.', 'A story we love remembering, every time.'],
    voice: ['Something I want you to hear in my voice', 'Press play and let my voice tell you.'],
    calendar: ['Our beautiful days', 'Every day with a photo is a day we will never forget.'],
    film: ['Scenes from our story', 'Tap any scene, or play the whole film.'],
  },
};

// Calendar demo days spread over two years so the month and whole-year views both have content.
const MEMORY_DATES = ['2025-11-08', '2025-12-24', '2026-01-17', '2026-02-14', '2026-02-27', '2026-03-21',
  '2026-04-10', '2026-05-02', '2026-05-02', '2026-06-19', '2026-07-04', '2026-07-30', '2026-08-14',
  '2026-09-09', '2026-09-21', '2026-10-02', '2026-10-04'];

function demoPhoto(prefix: string, index: number, captions: string[], offset = 0): ExperienceMedia {
  const id = PHOTO_IDS[(index + offset) % PHOTO_IDS.length];
  return { id: `${prefix}-${index}`, mediaType: 'IMAGE', displayOrder: index,
    url: `/demo/photos/${id}-full.jpg`, fullUrl: `/demo/photos/${id}-full.jpg`,
    thumbnailUrl: `/demo/photos/${id}-thumb.jpg`, caption: captions[(index + offset) % captions.length] };
}

// Copy and captions belong only to the standalone demo; real events use DB data.
export function demoSections(count = 30, language: 'ar' | 'en' = 'en'): ExperienceSection[] {
  const copy = COPY[language];
  return [
    { id: 'demo-photo-wheel', key: 'photo_wheel', title: copy.title, message: copy.message,
      media: Array.from({ length: count }, (_, index) => demoPhoto('demo-photo', index, copy.captions)) },
    { id: 'demo-voice-note', key: 'voice_note', title: copy.voice[0], message: copy.voice[1],
      media: [{ id: 'demo-voice-0', mediaType: 'VOICE_NOTE', url: '/demo/voice-note.wav', displayOrder: 0 }] },
    { id: 'demo-memory-calendar', key: 'memory_calendar', title: copy.calendar[0], message: copy.calendar[1],
      media: MEMORY_DATES.map((memoryDate, index) => ({ ...demoPhoto('demo-day', index, copy.captions, 7), memoryDate })) },
    { id: 'demo-film-strip', key: 'film_strip', title: copy.film[0], message: copy.film[1],
      media: Array.from({ length: 14 }, (_, index) => demoPhoto('demo-film', index, copy.captions, 13)) },
  ];
}
