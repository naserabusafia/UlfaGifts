const locale = (lang: string) => (lang?.startsWith('ar') ? 'ar-JO-u-nu-latn' : 'en-GB');

export const formatDay = (date: Date, lang: string) =>
  new Intl.DateTimeFormat(locale(lang), { weekday: 'long', day: 'numeric', month: 'long' }).format(date);

const STEPS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['minute', 60],
  ['hour', 24],
  ['day', 7],
];

/** "2 hours ago" for recent dates, a plain date after a week. */
export const formatRelative = (value: string, lang: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  let diff = (date.getTime() - Date.now()) / 60000;
  const rtf = new Intl.RelativeTimeFormat(locale(lang), { numeric: 'auto' });
  for (const [unit, size] of STEPS) {
    if (Math.abs(diff) < size) return rtf.format(Math.round(diff), unit);
    diff /= size;
  }
  return new Intl.DateTimeFormat(locale(lang), { day: 'numeric', month: 'short' }).format(date);
};

export const formatCount = (value: number, lang: string) => new Intl.NumberFormat(locale(lang)).format(value);
