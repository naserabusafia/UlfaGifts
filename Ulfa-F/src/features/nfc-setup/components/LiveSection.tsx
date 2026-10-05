import { useLayoutEffect, useRef, useState } from 'react';
import PhotoWheel from '../../nfc-experience/components/PhotoWheel';
import VoiceNote from '../../nfc-experience/components/VoiceNote';
import MemoryCalendar from '../../nfc-experience/components/MemoryCalendar';
import FilmStrip from '../../nfc-experience/components/FilmStrip';
import type { ExperienceSection } from '../../nfc-experience/types/experience';

type Props = {
  section: ExperienceSection; language: 'ar' | 'en'; theme: string; occasion: string;
  /** Editor only: the "+" in the photo wheel's center. */
  centerAction?: React.ReactNode;
  /** Editor only: tapping a calendar day adds photos to it. */
  onAddDay?: (day: string) => void;
};

/** The real recipient component for a section, themed like the NFC page. */
export default function LiveSection({ section, language, theme, occasion, centerAction, onAddDay }: Props) {
  const content = {
    photo_wheel: () => <PhotoWheel section={section} language={language} centerAction={centerAction} />,
    voice_note: () => <VoiceNote section={section} language={language} />,
    memory_calendar: () => <MemoryCalendar section={section} language={language} onAddDay={onAddDay} />,
    film_strip: () => <FilmStrip section={section} language={language} />,
  }[section.key];
  if (!content) return null;
  return <div className="nfc-sections s-live" data-theme={theme} data-occasion={occasion} lang={language}
    dir={language === 'ar' ? 'rtl' : 'ltr'} data-section-type={section.key}>
    {content()}
  </div>;
}

/** A non-interactive miniature of a section rendered at phone width. */
export function MiniSection(props: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.2);
  useLayoutEffect(() => {
    const node = box.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / 390));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return <div className="s-mini" ref={box} aria-hidden="true" inert>
    <div className="s-mini__stage" style={{ transform: `scale(${scale})` }}>
      <LiveSection {...props} />
    </div>
  </div>;
}
