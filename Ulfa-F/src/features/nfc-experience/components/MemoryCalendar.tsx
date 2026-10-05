import { useCallback, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarDays, ChevronLeft, ChevronRight, LayoutGrid } from 'lucide-react';
import type { ExperienceMedia, ExperienceSection } from '../types/experience';
import { parseMemoryDate, sectionMedia } from '../utils/sections';
import type { MemoryDay } from '../utils/sections';
import SectionHeading from './SectionHeading';
import PhotoLightbox from './PhotoLightbox';
import './memory-sections.css';

type Memory = MemoryDay & { photo: ExperienceMedia };
const monthKey = (year: number, month: number) => year * 12 + month;
const utc = (year: number, month: number, day = 1) => new Date(Date.UTC(year, month, day));
const daysIn = (year: number, month: number) => utc(year, month + 1, 0).getUTCDate();

function MonthCells({ year, month, render }: { year: number; month: number; render: (day: number) => React.ReactNode }) {
  const lead = utc(year, month).getUTCDay();
  return <>
    {Array.from({ length: lead }, (_, i) => <span key={`lead-${i}`} aria-hidden="true" />)}
    {Array.from({ length: daysIn(year, month) }, (_, i) => render(i + 1))}
  </>;
}

/**
 * onAddDay (setup editor only): every month is reachable and tapping any day
 * adds photos to it instead of opening the viewer.
 */
export default function MemoryCalendar({ section, language, onAddDay }: {
  section: ExperienceSection; language: 'ar' | 'en'; onAddDay?: (day: string) => void;
}) {
  const { t } = useTranslation(undefined, { lng: language });
  const headingId = useId();
  const memories = useMemo<Memory[]>(() => sectionMedia(section)
    .map((photo) => ({ ...parseMemoryDate(photo.memoryDate)!, photo }))
    .sort((a, b) => a.key.localeCompare(b.key) || a.photo.displayOrder - b.photo.displayOrder), [section]);
  const byDay = useMemo(() => {
    const map = new Map<string, number[]>();
    memories.forEach((memory, index) => map.set(memory.key, [...(map.get(memory.key) ?? []), index]));
    return map;
  }, [memories]);
  const first = memories[0];
  const last = memories.at(-1);
  const [view, setView] = useState<'month' | 'year'>('month');
  const [cursor, setCursor] = useState(() => (last ? { year: last.year, month: last.month }
    : onAddDay ? { year: new Date().getFullYear(), month: new Date().getMonth() } : { year: 2000, month: 0 }));
  const [open, setOpen] = useState<number | null>(null);

  const format = useMemo(() => ({
    number: new Intl.NumberFormat(language),
    month: new Intl.DateTimeFormat(language, { month: 'long', year: 'numeric', timeZone: 'UTC' }),
    monthName: new Intl.DateTimeFormat(language, { month: 'long', timeZone: 'UTC' }),
    year: new Intl.DateTimeFormat(language, { year: 'numeric', timeZone: 'UTC' }),
    full: new Intl.DateTimeFormat(language, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }),
    weekday: new Intl.DateTimeFormat(language, { weekday: 'narrow', timeZone: 'UTC' }),
  }), [language]);
  // 2023-01-01 was a Sunday; the grid starts on Sunday in both languages.
  const weekdays = useMemo(() => Array.from({ length: 7 }, (_, i) => format.weekday.format(utc(2023, 0, 1 + i))), [format]);
  const metaFor = useCallback((photo: ExperienceMedia) => {
    const day = parseMemoryDate(photo.memoryDate);
    return day ? format.full.format(utc(day.year, day.month, day.day)) : null;
  }, [format]);
  const closeLightbox = useCallback(() => setOpen(null), []);

  if ((!first || !last) && !onAddDay) return null;
  const current = monthKey(cursor.year, cursor.month);
  const canPrev = !first || !last ? true : onAddDay || (view === 'month' ? current > monthKey(first.year, first.month) : cursor.year > first.year);
  const canNext = !first || !last ? true : onAddDay || (view === 'month' ? current < monthKey(last.year, last.month) : cursor.year < last.year);
  const move = (delta: number) => setCursor(({ year, month }) => {
    if (view === 'year') return { year: year + delta, month: delta < 0 ? 11 : 0 };
    const next = monthKey(year, month) + delta;
    return { year: Math.floor(next / 12), month: next % 12 };
  });
  const dayKey = (year: number, month: number, day: number) =>
    `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const countIn = (year: number, month?: number) => memories
    .filter((m) => m.year === year && (month === undefined || m.month === month)).length;
  const monthCount = countIn(cursor.year, cursor.month);
  const yearCount = countIn(cursor.year);
  const PrevIcon = language === 'ar' ? ChevronRight : ChevronLeft;
  const NextIcon = language === 'ar' ? ChevronLeft : ChevronRight;

  return <section className="memory-section memory-section--dark memory-calendar"
    aria-labelledby={section.title ? headingId : undefined} aria-label={section.title ? undefined : t('memorySections.calendar')}>
    <SectionHeading section={section} id={headingId} language={language} />
    <div className={`memory-calendar__card is-${view}`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="memory-calendar__head">
        <button type="button" onClick={() => move(-1)} disabled={!canPrev}
          aria-label={t(view === 'month' ? 'memorySections.previousMonth' : 'memorySections.previousYear')}><PrevIcon /></button>
        <strong aria-live="polite">
          {view === 'month' ? format.month.format(utc(cursor.year, cursor.month)) : format.year.format(utc(cursor.year, 0))}
        </strong>
        <button type="button" onClick={() => move(1)} disabled={!canNext}
          aria-label={t(view === 'month' ? 'memorySections.nextMonth' : 'memorySections.nextYear')}><NextIcon /></button>
      </div>

      {view === 'month' ? <div className="memory-calendar__grid">
        {weekdays.map((name, i) => <span key={`wd-${i}`} className="memory-calendar__weekday" aria-hidden="true">{name}</span>)}
        <MonthCells year={cursor.year} month={cursor.month} render={(day) => {
          const key = dayKey(cursor.year, cursor.month, day);
          const indexes = byDay.get(key);
          if (!indexes && onAddDay) return <button key={day} type="button" className="memory-calendar__day is-addable"
            onClick={() => onAddDay(key)}>{format.number.format(day)}</button>;
          if (!indexes) return <span key={day} className="memory-calendar__day">{format.number.format(day)}</span>;
          const photo = memories[indexes[0]].photo;
          return <button key={day} type="button" className="memory-calendar__day is-memory"
            style={{ backgroundImage: `url("${photo.thumbnailUrl || photo.url}")` }}
            aria-label={t('memorySections.memoryOn', { date: format.full.format(utc(cursor.year, cursor.month, day)) })}
            onClick={() => (onAddDay ? onAddDay(key) : setOpen(indexes[0]))}>
            <b>{format.number.format(day)}</b>
            {indexes.length > 1 && <i>{format.number.format(indexes.length)}</i>}
          </button>;
        }} />
      </div> : <div className="memory-calendar__year">
        {Array.from({ length: 12 }, (_, month) => {
          const count = countIn(cursor.year, month);
          return <button key={month} type="button" className={`memory-calendar__mini${count ? ' has-memories' : ''}`}
            onClick={() => { setCursor({ year: cursor.year, month }); setView('month'); }}
            aria-label={t('memorySections.openMonth', { month: format.month.format(utc(cursor.year, month)), count: format.number.format(count) })}>
            <span className="memory-calendar__mini-name">{format.monthName.format(utc(cursor.year, month))}</span>
            <span className="memory-calendar__mini-grid" aria-hidden="true">
              <MonthCells year={cursor.year} month={month} render={(day) =>
                <span key={day} className={byDay.has(dayKey(cursor.year, month, day)) ? 'is-memory' : undefined} />} />
            </span>
          </button>;
        })}
      </div>}

      <div className="memory-calendar__foot">
        <span>{view === 'month'
          ? (monthCount ? t('memorySections.monthCount', { count: format.number.format(monthCount) }) : t('memorySections.monthEmpty'))
          : t('memorySections.yearCount', { count: format.number.format(yearCount) })}</span>
        <button type="button" className="memory-calendar__toggle" onClick={() => setView(view === 'month' ? 'year' : 'month')}>
          {view === 'month' ? <LayoutGrid aria-hidden="true" /> : <CalendarDays aria-hidden="true" />}
          {t(view === 'month' ? 'memorySections.showYear' : 'memorySections.showMonth')}
        </button>
      </div>
    </div>
    {open !== null && <PhotoLightbox photos={memories.map((m) => m.photo)} index={open} language={language}
      onIndex={setOpen} onClose={closeLightbox} meta={metaFor} />}
  </section>;
}
