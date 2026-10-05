import { useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { ExperienceMedia } from '../types/experience';
import { useHorizontalDrag } from '../hooks/useHorizontalDrag';
import './photo-wheel.css';

type Props = {
  photos: ExperienceMedia[];
  index: number;
  language: 'ar' | 'en';
  onIndex: (index: number) => void;
  onClose: () => void;
  /** Optional line above the caption, e.g. the memory date. */
  meta?: (photo: ExperienceMedia) => string | null;
};

/** Photo card dialog shared by the calendar and film strip; same look as the wheel's card. */
export default function PhotoLightbox({ photos, index, language, onIndex, onClose, meta }: Props) {
  const { t } = useTranslation(undefined, { lng: language });
  const numberFormat = useMemo(() => new Intl.NumberFormat(language), [language]);
  const cardRef = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const count = photos.length;
  const photo = photos[index];
  const step = (delta: number) => { if (count > 1) onIndex((index + delta + count) % count); };
  const drag = useHorizontalDrag((dx) => { if (Math.abs(dx) > 35) step(dx < 0 ? 1 : -1); });
  const stepRef = useRef(step);
  useEffect(() => { stepRef.current = step; });

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const bodyOverflow = document.body.style.overflow;
    const rootOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    closeButton.current?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault(); stepRef.current(event.key === 'ArrowRight' ? 1 : -1);
      }
      if (event.key === 'Tab') {
        const controls = [...(cardRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])];
        const first = controls[0]; const last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = bodyOverflow;
      document.documentElement.style.overflow = rootOverflow;
      document.removeEventListener('keydown', onKey);
      opener?.focus({ preventScroll: true });
    };
  }, [onClose]);

  useEffect(() => {
    [index - 1, index + 1].forEach((i) => {
      const next = photos[(i + count) % count];
      if (next) new Image().src = next.fullUrl || next.url;
    });
  }, [count, index, photos]);

  if (!photo) return null;
  const label = t('photoWheel.photo', { number: numberFormat.format(index + 1), count: numberFormat.format(count) });
  const line = meta?.(photo);
  return createPortal(<div className="photo-card-backdrop" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="photo-card" ref={cardRef} role="dialog" aria-modal="true" aria-label={label} lang={language} dir="ltr">
      <button ref={closeButton} className="photo-card__close" type="button" onClick={onClose} aria-label={t('photoWheel.close')}><X /></button>
      <figure {...drag.handlers}>
        <img src={photo.fullUrl || photo.url} alt={photo.caption || label} decoding="async" draggable="false" />
        {(line || photo.caption) && <figcaption dir={language === 'ar' ? 'rtl' : 'ltr'}>
          {line && <span className="photo-card__meta">{line}</span>}
          {photo.caption}
        </figcaption>}
      </figure>
      {count > 1 && <nav className="photo-card__controls" aria-label={t('photoWheel.navigation')}>
        <button type="button" onClick={() => step(-1)} aria-label={t('photoWheel.previous')}><ChevronLeft /></button>
        <span>{numberFormat.format(index + 1)} / {numberFormat.format(count)}</span>
        <button type="button" onClick={() => step(1)} aria-label={t('photoWheel.next')}><ChevronRight /></button>
      </nav>}
    </div>
  </div>, document.body);
}
