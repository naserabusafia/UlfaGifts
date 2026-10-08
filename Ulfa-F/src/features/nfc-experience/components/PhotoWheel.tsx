import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { ExperienceMedia, ExperienceSection } from '../types/experience';
import { useHorizontalDrag } from '../hooks/useHorizontalDrag';
import { useCircularDrag } from '../hooks/useCircularDrag';
import { ACTIVE_SCALE, CLICK_MODE, DIAMETER_RATIO, HINT_DELAY_MS, HINT_PAUSE_MS, HOLE_RATIO,
  MAX_DIAMETER, NUMBER_RADIUS_RATIO, PHOTO_SIZE_RATIO, PILE_MIN_SCALE, PILE_RADIUS_RATIO,
  PILE_SIZE_RATIO, SLOT_ANGLE, TRANSITION_EASING, TRANSITION_MS, VISIBLE_COUNT,
  pileWindow, seededPose, signedOffset, wheelSlot, wheelWindow, wrapIndex } from '../utils/wheel';
import SectionOrnament from './SectionOrnament';
import './photo-wheel.css';
import './memory-sections.css';

// centerAction: optional control placed in the disk's center hole (the setup editor's "+").
type Props = { section: ExperienceSection; language: 'ar' | 'en'; centerAction?: React.ReactNode };
type ReelStyle = CSSProperties & Record<`--${string}`, string | number>;
type CardPosition = { index: number; offset?: number; depth?: number };

function ReelPhoto({ photo, position, pileCount, active, dragAngle, format, onClick, buttonRef, label }: {
  photo: ExperienceMedia; position: CardPosition; pileCount: number; active: number; dragAngle: number;
  format: (number: number) => string; onClick: () => void; buttonRef: (node: HTMLButtonElement | null) => void; label: string;
}) {
  const pile = position.depth !== undefined;
  const depth = position.depth ?? 0;
  const fraction = pileCount > 1 ? depth / (pileCount - 1) : 0;
  const pose = seededPose(photo.id);
  const slot = wheelSlot(position.offset ?? 0, dragAngle);
  const pileSize = PHOTO_SIZE_RATIO * PILE_SIZE_RATIO;
  const scale = pile ? PILE_SIZE_RATIO * (1 - (1 - PILE_MIN_SCALE) * fraction) : slot.scale;
  const angle = pile ? pose.angle : slot.angle;
  const x = pile ? pose.x * pileSize : slot.x;
  const y = pile ? PILE_RADIUS_RATIO + pose.y * pileSize : slot.y;
  const isActive = !pile && position.index === active;
  return <button type="button" className={`photo-wheel__photo${pile ? ' is-pile' : ' is-slot'}${isActive ? ' is-active' : ''}`}
    ref={buttonRef} data-photo-index={position.index} data-pile-depth={pile ? depth : undefined}
    style={{ transform: `translate(${x * 100}cqw, ${y * 100}cqw) rotate(${angle}deg) scale(${scale})`,
      zIndex: pile ? 40 - depth : isActive ? 80 : 60 - Math.abs(position.offset ?? 0),
      '--photo-brightness': pile ? 1 - .15 * fraction : 1,
      boxShadow: pile ? '0 3px 8px #1c1b3345' : `0 ${3 + slot.emphasis * 10}px ${8 + slot.emphasis * 20}px #1c1b3350` } as ReelStyle}
    aria-label={label} aria-current={isActive ? 'true' : undefined}
    tabIndex={isActive || (pile && depth === 0) ? 0 : -1} onClick={onClick}>
    <img src={photo.thumbnailUrl || photo.url} alt="" draggable="false"
      loading={!pile || depth < 3 ? 'eager' : 'lazy'} decoding="async" />
    {pile && depth === 0 && <span className="photo-wheel__pile-accessible">{format(position.index + 1)}</span>}
  </button>;
}

function ReelDisk({ angle, maskId }: { angle: number; maskId: string }) {
  return <svg className="photo-wheel__disk" viewBox="0 0 100 100" aria-hidden="true"
    style={{ transform: `rotate(${angle}deg)` }}>
    <defs>
      <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
        <circle cx="50" cy="50" r="50" fill="white" />
        <circle cx="50" cy="50" r={HOLE_RATIO * 50} fill="black" />
        {Array.from({ length: 8 }, (_, i) => <rect key={i} x="48" y="-.3" width="4" height="3.3"
          fill="black" transform={`rotate(${22.5 + i * SLOT_ANGLE} 50 50)`} />)}
      </mask>
      <filter id={`${maskId}-grain`} x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="3" stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <radialGradient id={`${maskId}-edge`}>
        <stop offset="88%" stopColor="#2c2a4c" stopOpacity="0" />
        <stop offset="100%" stopColor="#2c2a4c" stopOpacity=".12" />
      </radialGradient>
    </defs>
    <g mask={`url(#${maskId})`}>
      <circle cx="50" cy="50" r="50" fill="#EDE1DD" />
      <circle cx="50" cy="50" r="50" filter={`url(#${maskId}-grain)`} opacity=".075" />
      <circle cx="50" cy="50" r="50" fill={`url(#${maskId}-edge)`} />
      <circle cx="50" cy="50" r={HOLE_RATIO * 50 + .4} fill="none" stroke="#2c2a4c" strokeOpacity=".22" strokeWidth=".8" />
    </g>
  </svg>;
}

export default function PhotoWheel({ section, language, centerAction }: Props) {
  const { t } = useTranslation(undefined, { lng: language });
  const headingId = useId();
  const maskId = `reel-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const photos = useMemo(() => [...(section.media ?? [])].filter((m) => m.mediaType === 'IMAGE' && m.url)
    .sort((a, b) => a.displayOrder - b.displayOrder), [section.media]);
  const numberFormat = useMemo(() => new Intl.NumberFormat(language), [language]);
  const format = (number: number) => numberFormat.format(number);
  const [activeIndex, setActiveIndex] = useState(0);
  const [diskAngle, setDiskAngle] = useState(0);
  const [dialog, setDialog] = useState<'closed' | 'open' | 'closing'>('closed');
  const sectionRef = useRef<HTMLElement>(null);
  const wheelRef = useRef<HTMLDivElement>(null);
  const photoButtons = useRef(new Map<number, HTMLButtonElement>());
  const openerIndex = useRef(0);
  const closeButton = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef(0);
  const hint = useRef({ seen: false, cancelled: false, timers: [] as number[] });
  const active = wrapIndex(activeIndex, photos.length);
  const selection = useRef({ active, count: photos.length });
  const photo = photos[active];
  const isOpen = dialog !== 'closed';
  const remaining = Math.max(0, photos.length - VISIBLE_COUNT);

  const cancelHint = useCallback(() => {
    hint.current.cancelled = true;
    hint.current.timers.forEach(window.clearTimeout);
    hint.current.timers = [];
  }, []);
  const rotate = useCallback((delta: number) => {
    if (photos.length < 2 || !delta) return;
    setActiveIndex((current) => wrapIndex(current + delta, photos.length));
    setDiskAngle((current) => current - delta * SLOT_ANGLE);
  }, [photos.length]);
  useEffect(() => { selection.current = { active, count: photos.length }; }, [active, photos.length]);
  const close = useCallback(() => {
    if (closeTimer.current) return;
    const current = selection.current;
    if (current.count && Math.abs(signedOffset(openerIndex.current, current.active, current.count)) > 3) {
      rotate(signedOffset(openerIndex.current, current.active, current.count));
    }
    setDialog('closing');
    closeTimer.current = window.setTimeout(() => { setDialog('closed'); closeTimer.current = 0; },
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180);
  }, [rotate]);
  const wheelDrag = useCircularDrag(rotate);
  const liveSteps = wheelDrag.dragging && photos.length > 1 ? -Math.round(wheelDrag.rotation / SLOT_ANGLE) : 0;
  const visualActive = wrapIndex(active + liveSteps, photos.length);
  const dragAngle = wheelDrag.rotation + liveSteps * SLOT_ANGLE;
  const slots = wheelWindow(visualActive, photos.length);
  const pile = pileWindow(visualActive, photos.length);
  const positions: CardPosition[] = [...slots, ...pile];
  const cardDrag = useHorizontalDrag((dx) => { if (Math.abs(dx) > 35) rotate(dx < 0 ? 1 : -1); });
  const openPhoto = (index = active) => {
    cancelHint();
    openerIndex.current = index;
    rotate(signedOffset(index, active, photos.length));
    setDialog('open');
  };

  useEffect(() => {
    const node = sectionRef.current;
    if (!node || photos.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const state = hint.current;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || entry.intersectionRatio < .5 || state.seen || state.cancelled) return;
      state.seen = true;
      state.timers.push(window.setTimeout(() => { if (!state.cancelled) rotate(2); }, HINT_DELAY_MS));
      state.timers.push(window.setTimeout(() => { if (!state.cancelled) rotate(-2); }, HINT_DELAY_MS + TRANSITION_MS + HINT_PAUSE_MS));
    }, { threshold: .5 });
    observer.observe(node);
    return () => { observer.disconnect(); state.timers.forEach(window.clearTimeout); state.timers = []; };
  }, [rotate, photos.length]);
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
    const buttons = photoButtons.current;
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
        const first = controls[0]; const last = controls.at(-1);
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
      (buttons.get(openerIndex.current) ?? wheel)?.focus({ preventScroll: true });
    };
  }, [isOpen, close, rotate]);

  if (!photo) return null;
  const prevLabel = t('photoWheel.previous'); const nextLabel = t('photoWheel.next');
  return <section ref={sectionRef} className="photo-wheel" aria-labelledby={section.title ? headingId : undefined}
    aria-label={section.title ? undefined : t('photoWheel.gallery')}
    onPointerDownCapture={cancelHint} onClickCapture={cancelHint} onKeyDownCapture={cancelHint}
    style={{ '--reel-max': `${MAX_DIAMETER}px`, '--reel-width': `${DIAMETER_RATIO * 100}%`,
      '--photo-size': `${PHOTO_SIZE_RATIO * 100}cqw`, '--active-scale': ACTIVE_SCALE,
      '--reel-duration': `${TRANSITION_MS}ms`, '--reel-easing': TRANSITION_EASING } as ReelStyle}>
    <header className="photo-wheel__heading" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {section.title && <h2 id={headingId}>{section.title}</h2>}
      {section.message && <p>{section.message}</p>}
      <SectionOrnament className="photo-wheel__ornament" />
    </header>
    <div className="photo-wheel__frame" dir="ltr">
      <div className={`photo-wheel__canvas${wheelDrag.dragging ? ' is-dragging' : ''}`} ref={wheelRef} dir="ltr"
        role="region" tabIndex={0} aria-label={t('photoWheel.gallery')} {...wheelDrag.handlers}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            event.preventDefault(); rotate(event.key === 'ArrowRight' ? 1 : -1);
          } else if (event.key === 'Enter' && event.target === event.currentTarget) { event.preventDefault(); openPhoto(); }
        }}>
        <ReelDisk angle={diskAngle + wheelDrag.rotation} maskId={maskId} />
        {remaining > 0 && <svg className="photo-wheel__progress" viewBox="0 0 100 100" aria-hidden="true" data-progress={(active + 1) / photos.length}>
          <circle cx="50" cy="50" r="46" className="photo-wheel__progress-track" />
          <circle cx="50" cy="50" r="46" pathLength="1" strokeDasharray="1" strokeDashoffset={1 - (active + 1) / photos.length}
            className="photo-wheel__progress-fill" transform="rotate(-90 50 50)" />
        </svg>}
        {positions.map((position) => <ReelPhoto key={`${photos[position.index].id}${position.depth !== undefined && slots.some((slot) => slot.index === position.index) ? '-pile' : ''}`} photo={photos[position.index]}
          position={position} pileCount={pile.length} active={visualActive} dragAngle={dragAngle} format={format}
          buttonRef={(node) => { if (position.offset === undefined) return; if (node) photoButtons.current.set(position.index, node); else photoButtons.current.delete(position.index); }}
          label={position.depth !== undefined ? t('photoWheel.more', { count: format(remaining) }) : t('photoWheel.photo', { number: format(position.index + 1), count: format(photos.length) })}
          onClick={() => {
            if (position.depth !== undefined) rotate(1);
            else if (CLICK_MODE === 'open-any' || position.index === active) openPhoto(position.index);
            else rotate(signedOffset(position.index, active, photos.length));
          }} />)}
        {slots.filter((slot) => slot.offset !== 0).map((slot) => <span key={photos[slot.index].id}
          className="photo-wheel__number" aria-hidden="true" data-number-index={slot.index}
          style={{ transform: `rotate(${slot.offset * SLOT_ANGLE + dragAngle}deg) translateY(-${NUMBER_RADIUS_RATIO * 100}cqw) translateX(3cqw)` }}>
          {format(slot.index + 1)}
        </span>)}
        {centerAction && <div className="photo-wheel__center-action">{centerAction}</div>}
        <span className="photo-wheel__marker" aria-hidden="true">V<svg viewBox="0 0 16 24"><path d="M8 23V2M3 8l5-6 5 6" /></svg></span>
        {remaining > 0 && <button className="photo-wheel__pile-badge" type="button" onClick={() => rotate(1)}
          aria-label={t('photoWheel.more', { count: format(remaining) })}>+{format(remaining)}</button>}
      </div>
    </div>
    <nav className="photo-wheel__controls" dir="ltr" aria-label={t('photoWheel.navigation')}>
      <button type="button" onClick={() => rotate(-1)} disabled={photos.length < 2} aria-label={prevLabel}><ChevronLeft /></button>
      <span className="photo-wheel__counter" aria-live="polite" aria-atomic="true">{format(active + 1)} / {format(photos.length)}</span>
      <button type="button" onClick={() => rotate(1)} disabled={photos.length < 2} aria-label={nextLabel}><ChevronRight /></button>
    </nav>
    {isOpen && createPortal(<div className={`photo-card-backdrop${dialog === 'closing' ? ' is-closing' : ''}`}
      onClick={(event) => { if (event.target === event.currentTarget) close(); }}>
      <div className="photo-card" ref={cardRef} role="dialog" aria-modal="true" lang={language}
        aria-label={t('photoWheel.photo', { number: format(active + 1), count: format(photos.length) })} dir="ltr">
        <button ref={closeButton} className="photo-card__close" type="button" onClick={close} aria-label={t('photoWheel.close')}><X /></button>
        <figure {...cardDrag.handlers}>
          <img src={photo.fullUrl || photo.url} alt={photo.caption || t('photoWheel.photo', { number: format(active + 1), count: format(photos.length) })}
            decoding="async" draggable="false" />
          {photo.caption && <figcaption dir={language === 'ar' ? 'rtl' : 'ltr'}>{photo.caption}</figcaption>}
        </figure>
        <nav className="photo-card__controls" aria-label={t('photoWheel.navigation')}>
          <button type="button" onClick={() => rotate(-1)} disabled={photos.length < 2} aria-label={prevLabel}><ChevronLeft /></button>
          <span>{format(active + 1)} / {format(photos.length)}</span>
          <button type="button" onClick={() => rotate(1)} disabled={photos.length < 2} aria-label={nextLabel}><ChevronRight /></button>
        </nav>
      </div>
    </div>, document.body)}
  </section>;
}
