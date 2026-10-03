import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { ExperienceMedia, ExperienceSection } from '../types/experience';
import { useHorizontalDrag } from '../hooks/useHorizontalDrag';
import { PHOTO_CLICK_BEHAVIOR, WHEEL_STEP, wheelSlot, wrapIndex } from '../utils/wheel';
import './photo-wheel.css';

type Props = { section: ExperienceSection; language: 'ar' | 'en' };
type WheelStyle = CSSProperties & { '--slot-angle'?: string; '--disk-angle'?: string };

function WheelPhoto({ photo, index, count, activeIndex, dragSteps, onClick, label, buttonRef }: {
  photo: ExperienceMedia; index: number; count: number; activeIndex: number; dragSteps: number;
  onClick: () => void; label: string; buttonRef: (node: HTMLButtonElement | null) => void;
}) {
  const slot = wheelSlot(index, activeIndex, count, dragSteps);
  const node = useRef<HTMLButtonElement>(null);
  const previousAngle = useRef(slot.angle);
  useLayoutEffect(() => {
    const button = node.current;
    const wrapped = Math.abs(previousAngle.current - slot.angle) > 180;
    previousAngle.current = slot.angle;
    if (!button) return;
    button.style.transition = '';
    button.style.opacity = slot.visible ? '1' : '0';
    if (!wrapped) return;
    // Hide only the wrap seam at the compressed bottom, then fade back in.
    button.style.transition = 'none';
    button.style.opacity = '0';
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        button.style.transition = '';
        button.style.opacity = slot.visible ? '1' : '0';
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [slot.angle, slot.visible]);

  return <button type="button" className={`photo-wheel__photo${index === activeIndex ? ' is-active' : ''}`}
    ref={(button) => { node.current = button; buttonRef(button); }}
    style={{ transform: `rotate(${slot.angle}deg) translateY(calc(-1 * var(--wheel-radius) - ${slot.lift}px)) scale(${slot.scale})`,
      opacity: slot.visible ? 1 : 0, zIndex: count + 2 - Math.round(Math.abs(slot.offset)),
      pointerEvents: slot.visible ? 'auto' : 'none' }}
    aria-label={label} aria-current={index === activeIndex ? 'true' : undefined}
    data-photo-index={index}
    aria-hidden={!slot.visible} tabIndex={index === activeIndex ? 0 : -1}
    onClick={onClick}>
    <img src={photo.thumbnailUrl || photo.url} alt="" draggable="false"
      loading={slot.visible ? 'eager' : 'lazy'} decoding="async" />
    <span className="photo-wheel__number" aria-hidden="true">{index + 1}</span>
  </button>;
}

export default function PhotoWheel({ section, language }: Props) {
  const { t } = useTranslation(undefined, { lng: language });
  const headingId = useId();
  const photos = useMemo(() => [...(section.media ?? [])]
    .filter((m) => m.mediaType === 'IMAGE' && m.url)
    .sort((a, b) => a.displayOrder - b.displayOrder), [section.media]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [diskAngle, setDiskAngle] = useState(0);
  const [dialog, setDialog] = useState<'closed' | 'open' | 'closing'>('closed');
  const wheelRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLElement>(null);
  const photoButtons = useRef(new Map<number, HTMLButtonElement>());
  const returnFocus = useRef<HTMLElement | null>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef(0);
  const [spacing, setSpacing] = useState(80);
  const [wheelMaxWidth, setWheelMaxWidth] = useState<number | null>(null);
  const active = wrapIndex(activeIndex, photos.length);
  const selection = useRef({ active, count: photos.length });
  const photo = photos[active];
  const isOpen = dialog !== 'closed';

  const rotate = useCallback((delta: number) => {
    if (photos.length < 2) return;
    setActiveIndex((current) => wrapIndex(current + delta, photos.length));
    setDiskAngle((current) => current - delta * WHEEL_STEP);
  }, [photos.length]);
  useEffect(() => { selection.current = { active, count: photos.length }; }, [active, photos.length]);
  const close = useCallback(() => {
    if (closeTimer.current) return;
    const openerIndex = Number(returnFocus.current?.dataset.photoIndex);
    const current = selection.current;
    if (Number.isFinite(openerIndex) && current.count) {
      const slot = wheelSlot(openerIndex, current.active, current.count);
      // Bring an opener out of the compressed stack before returning focus.
      if (slot.scale < 0.55) rotate(slot.offset);
    }
    setDialog('closing');
    closeTimer.current = window.setTimeout(() => {
      setDialog('closed');
      closeTimer.current = 0;
    }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180);
  }, [rotate]);
  const wheelDrag = useHorizontalDrag((dx) => rotate(-Math.round(dx / spacing)));
  const cardDrag = useHorizontalDrag((dx) => { if (Math.abs(dx) > 35) rotate(dx < 0 ? 1 : -1); });

  useEffect(() => {
    const wheel = wheelRef.current;
    const section = sectionRef.current;
    const heading = headingRef.current;
    if (!wheel || !section || !heading) return;
    const measure = () => {
      const styles = getComputedStyle(section);
      const headingStyles = getComputedStyle(heading);
      const availableHeight = window.innerHeight - heading.getBoundingClientRect().height
        - parseFloat(styles.paddingTop) - parseFloat(styles.paddingBottom)
        - parseFloat(headingStyles.marginBottom);
      setWheelMaxWidth(Math.max(160, Math.floor(availableHeight / 1.2)));
      setSpacing(Math.max(55, Math.min(130, wheel.getBoundingClientRect().width * 0.18)));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(wheel);
    observer.observe(heading);
    observer.observe(section);
    window.addEventListener('resize', measure);
    measure();
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);
  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  useEffect(() => {
    if (!isOpen || !photos.length) return;
    [active - 1, active, active + 1].forEach((index) => {
      const image = new Image();
      const source = photos[wrapIndex(index, photos.length)];
      image.src = source.fullUrl || source.url;
      void image.decode().catch(() => undefined);
    });
  }, [active, isOpen, photos]);

  useEffect(() => {
    if (!isOpen) return;
    const bodyOverflow = document.body.style.overflow;
    const rootOverflow = document.documentElement.style.overflow;
    const wheel = wheelRef.current;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    closeButton.current?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); close(); }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault(); rotate(event.key === 'ArrowRight' ? 1 : -1);
      }
      if (event.key === 'Tab') {
        const controls = [...(cardRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])];
        const first = controls[0];
        const last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    const keepFocus = (event: FocusEvent) => {
      if (event.target instanceof Node && !cardRef.current?.contains(event.target)) closeButton.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('focusin', keepFocus);
    return () => {
      document.body.style.overflow = bodyOverflow;
      document.documentElement.style.overflow = rootOverflow;
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('focusin', keepFocus);
      const target = returnFocus.current;
      // A disconnected opener (e.g. removed data) falls back to the wheel.
      if (target?.isConnected && target.getAttribute('aria-hidden') !== 'true') target.focus({ preventScroll: true });
      else wheel?.focus({ preventScroll: true });
    };
  }, [isOpen, close, rotate]);

  if (!photo) return null;
  const prevLabel = t('photoWheel.previous');
  const nextLabel = t('photoWheel.next');
  return <section ref={sectionRef} className="photo-wheel" aria-labelledby={section.title ? headingId : undefined}
    aria-label={section.title ? undefined : t('photoWheel.gallery')}>
    <header ref={headingRef} className="photo-wheel__heading" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {section.title && <h2 id={headingId}>{section.title}</h2>}
      {section.message && <p>{section.message}</p>}
      <svg className="photo-wheel__ornament" viewBox="0 0 120 24" aria-hidden="true">
        <path d="M2 12h34m48 0h34M42 12c9-16 14-10 18 0 4-10 9-16 18 0-9 16-14 10-18 0-4 10-9 16-18 0Z" />
      </svg>
    </header>
    <div className={`photo-wheel__canvas${wheelDrag.distance ? ' is-dragging' : ''}`} dir="ltr"
      ref={wheelRef} role="region" tabIndex={0} aria-label={t('photoWheel.gallery')}
      style={wheelMaxWidth ? { maxWidth: wheelMaxWidth } : undefined}
      {...wheelDrag.handlers}
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault(); rotate(event.key === 'ArrowRight' ? 1 : -1);
        }
      }}>
      <div className="photo-wheel__disk" aria-hidden="true"
        style={{ '--disk-angle': `${diskAngle + (photos.length > 1 ? wheelDrag.distance / spacing * WHEEL_STEP : 0)}deg` } as WheelStyle}>
        {Array.from({ length: 60 }, (_, index) => <i key={index} className="photo-wheel__notch"
          style={{ '--slot-angle': `${index * 6}deg` } as WheelStyle} />)}
        <span className="photo-wheel__hole" />
      </div>
      <span className="photo-wheel__marker" aria-hidden="true">↑<span>V</span></span>
      {photos.map((item, index) => <WheelPhoto key={item.id} photo={item} index={index} count={photos.length}
        activeIndex={active} dragSteps={photos.length > 1 ? wheelDrag.distance / spacing : 0}
        buttonRef={(node) => { if (node) photoButtons.current.set(index, node); else photoButtons.current.delete(index); }}
        label={t('photoWheel.photo', { number: index + 1, count: photos.length })}
        onClick={() => {
          if (PHOTO_CLICK_BEHAVIOR === 'open-any' || index === active) {
            returnFocus.current = photoButtons.current.get(index) ?? wheelRef.current;
            rotate(wheelSlot(index, active, photos.length).offset);
            setDialog('open');
          } else rotate(wheelSlot(index, active, photos.length).offset);
        }} />)}
      <nav className="photo-wheel__controls" aria-label={t('photoWheel.navigation')}>
        <button type="button" onClick={() => rotate(-1)} disabled={photos.length < 2} aria-label={prevLabel}><ChevronLeft /></button>
        <span className="photo-wheel__counter" aria-live="polite" aria-atomic="true">{active + 1} / {photos.length}</span>
        <button type="button" onClick={() => rotate(1)} disabled={photos.length < 2} aria-label={nextLabel}><ChevronRight /></button>
      </nav>
    </div>
    {isOpen && createPortal(<div className={`photo-card-backdrop${dialog === 'closing' ? ' is-closing' : ''}`}
      onClick={(event) => { if (event.target === event.currentTarget) close(); }}>
      <div className="photo-card" ref={cardRef} role="dialog" aria-modal="true" lang={language}
        aria-label={t('photoWheel.photo', { number: active + 1, count: photos.length })} dir="ltr">
        <button ref={closeButton} className="photo-card__close" type="button" onClick={close} aria-label={t('photoWheel.close')}><X /></button>
        <figure {...cardDrag.handlers}>
          <img src={photo.fullUrl || photo.url} alt={photo.caption || t('photoWheel.photo', { number: active + 1, count: photos.length })}
            decoding="async" draggable="false" />
          {photo.caption && <figcaption dir={language === 'ar' ? 'rtl' : 'ltr'}>{photo.caption}</figcaption>}
        </figure>
        <nav className="photo-card__controls" aria-label={t('photoWheel.navigation')}>
          <button type="button" onClick={() => rotate(-1)} disabled={photos.length < 2} aria-label={prevLabel}><ChevronLeft /></button>
          <span aria-live="polite" aria-atomic="true">{active + 1} / {photos.length}</span>
          <button type="button" onClick={() => rotate(1)} disabled={photos.length < 2} aria-label={nextLabel}><ChevronRight /></button>
        </nav>
      </div>
    </div>, document.body)}
  </section>;
}
