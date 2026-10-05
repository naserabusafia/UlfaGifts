import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import EnvelopeLetter from '../../../components/EnvelopeLetter/EnvelopeLetter';
import type { ExperienceContent, ExperienceSection } from '../types/experience';
import { orderedSections } from '../utils/sections';
import PhotoWheel from './PhotoWheel';
import VoiceNote from './VoiceNote';
import MemoryCalendar from './MemoryCalendar';
import FilmStrip from './FilmStrip';

type Props = {
  sections: ExperienceSection[];
  letter: ExperienceContent | null;
  emptyMessage: string;
  language: 'ar' | 'en';
  theme: string;
  occasion: string;
};
type SectionProps = Props & { section: ExperienceSection; onOpened: () => void; onCompleted: (reason: 'advance' | 'leave') => void };

function MessageSection({ letter, emptyMessage, language, theme, occasion, onOpened, onCompleted }: SectionProps) {
  return <EnvelopeLetter greeting={letter?.title ?? ''} body={letter?.message || emptyMessage}
    sign={letter?.signature ?? ''} lang={language} theme={theme} occasion={occasion} onOpened={onOpened} onCompleted={onCompleted} />;
}

function TextSection({ section }: SectionProps) {
  return <section className="nfc-text-section">
    {section.title && <h2>{section.title}</h2>}
    {section.message && <p>{section.message}</p>}
  </section>;
}

const SECTION_COMPONENTS: Record<string, (props: SectionProps) => React.ReactNode> = {
  message: MessageSection,
  photo_wheel: ({ section, language }) => <PhotoWheel section={section} language={language} />,
  voice_note: ({ section, language }) => <VoiceNote section={section} language={language} />,
  memory_calendar: ({ section, language }) => <MemoryCalendar section={section} language={language} />,
  film_strip: ({ section, language }) => <FilmStrip section={section} language={language} />,
};

export default function ExperienceSections(props: Props) {
  const sections = useMemo(() => orderedSections(props.sections), [props.sections]);
  const nodes = useRef(new Map<string, HTMLDivElement>());
  const [hasOpened, setHasOpened] = useState(false);
  const opened = useRef(false);
  const letterPosition = useRef<number | null>(null);
  const completed = useRef(false);
  const autoScrolling = useRef(false);
  const frame = useRef(0);
  const scrollTimeout = useRef(0);
  const destination = useRef<HTMLElement | null>(null);

  const revealSections = useCallback(() => {
    if (opened.current) return;
    opened.current = true;
    const message = sections.find((section) => section.key === 'message');
    letterPosition.current = message ? nodes.current.get(message.id)?.getBoundingClientRect().top ?? null : null;
    setHasOpened(true);
  }, [sections]);

  useLayoutEffect(() => {
    if (!hasOpened || letterPosition.current === null) return;
    const message = sections.find((section) => section.key === 'message');
    const node = message ? nodes.current.get(message.id) : null;
    // Revealing a section ordered before Message must not move the open letter.
    if (node) {
      const shift = node.getBoundingClientRect().top - letterPosition.current;
      if (Math.abs(shift) > 1) window.scrollBy({ top: shift, behavior: 'instant' });
    }
    letterPosition.current = null;
  }, [hasOpened, sections]);

  useEffect(() => {
    const release = () => { autoScrolling.current = false; window.clearTimeout(scrollTimeout.current); };
    const onScrollEnd = (event: Event) => { if (event.target === document || event.target === window) release(); };
    const onScroll = () => {
      if (autoScrolling.current && Math.abs(destination.current?.getBoundingClientRect().top ?? 100) < 2) release();
    };
    const onIntent = (event: Event) => {
      if (event.defaultPrevented || !autoScrolling.current) return;
      if (event instanceof KeyboardEvent && !['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(event.key)) return;
      if ((event instanceof WheelEvent && event.deltaY < 0) || (event instanceof KeyboardEvent && ['ArrowUp', 'PageUp', 'Home'].includes(event.key))) {
        window.scrollTo({ top: window.scrollY, behavior: 'instant' });
        release();
      } else if (event.cancelable) event.preventDefault();
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('scrollend', onScrollEnd);
    window.addEventListener('wheel', onIntent, { passive: false });
    window.addEventListener('touchmove', onIntent, { passive: false });
    window.addEventListener('keydown', onIntent);
    return () => {
      cancelAnimationFrame(frame.current);
      window.clearTimeout(scrollTimeout.current);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('scrollend', onScrollEnd);
      window.removeEventListener('wheel', onIntent);
      window.removeEventListener('touchmove', onIntent);
      window.removeEventListener('keydown', onIntent);
    };
  }, []);

  const finishMessage = useCallback((reason: 'advance' | 'leave') => {
    if (completed.current) return;
    completed.current = true;
    const index = sections.findIndex((s) => s.key === 'message');
    const next = sections[index + 1];
    const target = next ? nodes.current.get(next.id) : null;
    if (!target || reason === 'leave' || target.getBoundingClientRect().top < -8) return;
    autoScrolling.current = true;
    destination.current = target;
    frame.current = requestAnimationFrame(() => {
      target.focus({ preventScroll: true });
      target.scrollIntoView({
        block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
      });
      scrollTimeout.current = window.setTimeout(() => { autoScrolling.current = false; }, 1200);
    });
  }, [sections]);

  return <div className="nfc-sections" data-theme={props.theme} data-occasion={props.occasion} lang={props.language}
    dir={props.language === 'ar' ? 'rtl' : 'ltr'}>
    {sections.map((section) => {
      const Component = SECTION_COMPONENTS[section.key] ?? TextSection;
      return <div key={section.id} data-section-type={section.key} tabIndex={-1}
        hidden={section.key !== 'message' && !hasOpened}
        ref={(node) => { if (node) nodes.current.set(section.id, node); else nodes.current.delete(section.id); }}>
        <Component {...props} section={section} onOpened={revealSections} onCompleted={finishMessage} />
      </div>;
    })}
  </div>;
}
