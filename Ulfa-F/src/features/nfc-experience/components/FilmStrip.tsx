import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Play, RotateCcw, X } from 'lucide-react';
import type { ExperienceMedia, ExperienceSection } from '../types/experience';
import { sectionMedia } from '../utils/sections';
import SectionHeading from './SectionHeading';
import PhotoLightbox from './PhotoLightbox';
import './memory-sections.css';

const TWO_ROWS_FROM = 6;
const SECONDS_PER_FRAME = 4;
const COUNTDOWN_FROM = 3;
const SLIDE_MS = 3000;
const MAX_SCENES = 24;

type Phase = { name: 'countdown'; value: number } | { name: 'scene'; value: number } | { name: 'end' };

function Cinema({ scenes, language, onClose }: { scenes: ExperienceMedia[]; language: 'ar' | 'en'; onClose: () => void }) {
  const { t } = useTranslation(undefined, { lng: language });
  const reduced = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, []);
  const [phase, setPhase] = useState<Phase>(reduced ? { name: 'scene', value: 0 } : { name: 'countdown', value: COUNTDOWN_FROM });
  const [run, setRun] = useState(0);
  const closeButton = useRef<HTMLButtonElement>(null);
  const number = useMemo(() => new Intl.NumberFormat(language), [language]);

  useEffect(() => {
    const timer = window.setTimeout(() => setPhase((current) => {
      if (current.name === 'countdown') return current.value > 1 ? { name: 'countdown', value: current.value - 1 } : { name: 'scene', value: 0 };
      if (current.name === 'scene') return current.value + 1 < scenes.length ? { name: 'scene', value: current.value + 1 } : { name: 'end' };
      return current;
    }), phase.name === 'countdown' ? 1000 : SLIDE_MS);
    if (phase.name === 'end') window.clearTimeout(timer);
    return () => window.clearTimeout(timer);
  }, [phase, scenes.length, run]);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const bodyOverflow = document.body.style.overflow;
    const rootOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    closeButton.current?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); onClose(); } };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = bodyOverflow;
      document.documentElement.style.overflow = rootOverflow;
      document.removeEventListener('keydown', onKey);
      opener?.focus({ preventScroll: true });
    };
  }, [onClose]);

  const scene = phase.name === 'scene' ? phase.value : -1;
  const caption = scene >= 0 ? scenes[scene]?.caption : null;
  return createPortal(<div className="film-cinema" role="dialog" aria-modal="true" aria-label={t('memorySections.playFilm')} lang={language}>
    <button ref={closeButton} type="button" className="film-cinema__close" onClick={onClose} aria-label={t('memorySections.closeFilm')}><X /></button>
    <div className="film-cinema__screen">
      {scenes.map((photo, index) => <img key={photo.id} src={photo.fullUrl || photo.url} alt=""
        className={index === scene ? 'is-showing' : undefined} decoding="async" draggable="false" />)}
      {phase.name === 'countdown' && <div className="film-cinema__leader" aria-hidden="true">
        <span key={phase.value} className="film-cinema__sweep" />
        <b>{number.format(phase.value)}</b>
      </div>}
      <div className="film-cinema__grain" aria-hidden="true" />
      {phase.name === 'end' && <div className="film-cinema__end">
        <span>{t('memorySections.theEnd')}</span>
        <button type="button" onClick={() => { setRun((r) => r + 1); setPhase({ name: 'scene', value: 0 }); }}>
          <RotateCcw aria-hidden="true" />{t('memorySections.replay')}
        </button>
      </div>}
    </div>
    <p className="film-cinema__caption" dir={language === 'ar' ? 'rtl' : 'ltr'} aria-live="polite">{caption}</p>
  </div>, document.body);
}

export default function FilmStrip({ section, language }: { section: ExperienceSection; language: 'ar' | 'en' }) {
  const { t } = useTranslation(undefined, { lng: language });
  const headingId = useId();
  const photos = useMemo(() => sectionMedia(section), [section]);
  const rows = useMemo(() => photos.length >= TWO_ROWS_FROM
    ? [photos.filter((_, i) => i % 2 === 0), photos.filter((_, i) => i % 2 === 1)] : [photos], [photos]);
  const [open, setOpen] = useState<number | null>(null);
  const [cinema, setCinema] = useState(false);
  const number = useMemo(() => new Intl.NumberFormat(language), [language]);
  const closeLightbox = useCallback(() => setOpen(null), []);
  const closeCinema = useCallback(() => setCinema(false), []);

  if (!photos.length) return null;
  return <section className="memory-section memory-section--light film-strip"
    aria-labelledby={section.title ? headingId : undefined} aria-label={section.title ? undefined : t('memorySections.film')}>
    <SectionHeading section={section} id={headingId} language={language} />
    <div className={`film-strip__reel${open !== null || cinema ? ' is-paused' : ''}`} dir="ltr">
      {rows.map((row, r) => <div key={r} className="film-strip__band"
        style={{ '--film-duration': `${row.length * SECONDS_PER_FRAME}s` } as CSSProperties}>
        <div className={`film-strip__track${r % 2 ? ' is-reverse' : ''}`}>
          {[0, 1].map((copy) => row.map((photo) => {
            const index = photos.indexOf(photo);
            return <button key={`${copy}-${photo.id}`} type="button" className="film-strip__frame"
              aria-hidden={copy === 1 || undefined} tabIndex={copy === 1 ? -1 : 0}
              aria-label={t('memorySections.scene', { number: number.format(index + 1) })} onClick={() => setOpen(index)}>
              <img src={photo.thumbnailUrl || photo.url} alt="" loading="lazy" decoding="async" draggable="false" />
            </button>;
          }))}
        </div>
      </div>)}
    </div>
    <div className="film-strip__actions">
      <button type="button" className="memory-section__button" onClick={() => setCinema(true)}>
        <Play aria-hidden="true" />{t('memorySections.playFilm')}
      </button>
    </div>
    {open !== null && <PhotoLightbox photos={photos} index={open} language={language} onIndex={setOpen} onClose={closeLightbox} />}
    {cinema && <Cinema scenes={photos.slice(0, MAX_SCENES)} language={language} onClose={closeCinema} />}
  </section>;
}
