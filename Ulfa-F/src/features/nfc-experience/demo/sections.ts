import type { ExperienceSection } from '../types/experience';

const PHOTO_IDS = ['10', '11', '12', '15', '16', '18', '20', '21', '22', '24', '25', '26', '27', '28', '29', '30', '37', '42', '43', '49', '50', '54', '57', '58', '64', '65', '66', '76', '82', '83'];

// Standalone demo fixtures. Real NFC items always use verified database content.
const COPY = {
  en: {
    title: 'Every picture holds a memory, and every memory tells our story.',
    message: 'Click on each photo to relive the moment.',
    captions: ['A little adventure, a lasting memory.', 'The places we carry with us.', 'A moment worth keeping.'],
  },
  ar: {
    title: 'كل صورة تحمل ذكرى، وكل ذكرى تحكي حكايتنا.',
    message: 'اضغط على كل صورة لتعيش اللحظة من جديد.',
    captions: ['مغامرة صغيرة وذكرى تبقى.', 'أماكن نحملها معنا أينما ذهبنا.', 'لحظة تستحق أن نحتفظ بها.'],
  },
};

export function demoSections(language: 'ar' | 'en', count = 30): ExperienceSection[] {
  const copy = COPY[language];
  return [{
    id: 'demo-photo-wheel', key: 'photo_wheel', title: copy.title, message: copy.message,
    // Deliberately no displayOrder: exercise the shared after-Message fallback.
    media: Array.from({ length: count }, (_, index) => {
      const id = PHOTO_IDS[index % PHOTO_IDS.length];
      return {
        id: `demo-photo-${index}`, mediaType: 'IMAGE', displayOrder: index,
        url: `/demo/photos/${id}-full.jpg`, fullUrl: `/demo/photos/${id}-full.jpg`,
        thumbnailUrl: `/demo/photos/${id}-thumb.jpg`,
        caption: index % 3 === 0 ? copy.captions[Math.floor(index / 3) % copy.captions.length] : null,
      };
    }),
  }];
}
