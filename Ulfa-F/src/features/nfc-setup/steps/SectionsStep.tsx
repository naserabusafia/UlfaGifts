import { useMemo, useState } from 'react';
import { Reorder, useDragControls } from 'framer-motion';
import { GripVertical, Mail } from 'lucide-react';
import { demoSections } from '../../nfc-experience/demo/sections';
import type { ExperienceSection } from '../../nfc-experience/types/experience';
import type { ServerSection } from '../api';
import type { SetupCopy } from '../copy';
import LiveSection, { MiniSection } from '../components/LiveSection';
import { Viewer } from '../components/Overlays';
import { Intro } from './AccessSteps';
import type { GiftLanguage } from './AccessSteps';

type Props = {
  copy: SetupCopy; language: GiftLanguage; theme: string; occasion: string; sections: ServerSection[];
  onChange: (sections: ServerSection[]) => Promise<void>; onLanguage: (language: GiftLanguage) => void; onNext: () => void;
};

function SectionRow({ section, demo, copy, props, onToggle, onMove, onLook, onDragEnd }: {
  section: ServerSection; demo?: ExperienceSection; copy: SetupCopy; props: Props;
  onToggle: () => void; onMove: (delta: number) => void; onLook: () => void; onDragEnd: () => void;
}) {
  const controls = useDragControls();
  const info = copy.sectionInfo[section.key] ?? { name: section.name, body: '' };
  return <Reorder.Item as="li" value={section} dragListener={false} dragControls={controls} onDragEnd={onDragEnd}
    className={`s-sec${section.isVisible ? ' is-on' : ''}`}
    // The whole card toggles; its own controls stop the click.
    onClick={onToggle}>
    <button type="button" className="s-handle" aria-label={`${copy.dragHint}: ${info.name}`}
      onPointerDown={(e) => { e.stopPropagation(); controls.start(e); }} onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); onMove(e.key === 'ArrowUp' ? -1 : 1); }
      }}>
      <GripVertical />
    </button>
    <span className="s-sec__thumb">
      {demo && <MiniSection section={demo} language={props.language} theme={props.theme} occasion={props.occasion} />}
    </span>
    <span className="s-sec__text">
      <span className="s-sec__name">{info.name}</span>
      <span className="s-sec__body">{info.body}</span>
      <span className="s-sec__meta">
        <button type="button" className="s-link" style={{ fontSize: 'inherit', padding: 0 }}
          onClick={(e) => { e.stopPropagation(); onLook(); }}>{copy.look}</button>
      </span>
    </span>
    <label className="s-switch" onClick={(e) => e.stopPropagation()}>
      <input type="checkbox" checked={section.isVisible} onChange={onToggle} aria-label={info.name} />
      <span aria-hidden="true" />
    </label>
  </Reorder.Item>;
}

export default function SectionsStep(props: Props) {
  const { copy, language, theme, occasion } = props;
  // The local order only exists while dragging; otherwise the store's order.
  const [dragOrder, setDragOrder] = useState<ServerSection[] | null>(null);
  const order = dragOrder ?? props.sections;
  const [looking, setLooking] = useState<string | null>(null);
  const [error, setError] = useState('');
  const demos = useMemo(() => demoSections(12, language), [language]);
  const demoFor = (key: string) => demos.find((d) => d.key === key);

  const save = (next: ServerSection[]) => {
    setDragOrder(null);
    setError('');
    props.onChange(next).catch(() => setError(copy.networkError));
  };
  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    save(next);
  };
  const lookAt = looking ? demoFor(looking) : null;

  return <section>
    <Intro eyebrow={copy.sectionsEyebrow} title={copy.sectionsTitle} lede={copy.sectionsBody} />
    <div className="s-langline">
      <span>{copy.giftLanguageIs}</span>
      <div className="s-segment" role="group" aria-label={copy.giftLanguageIs}>
        <button type="button" aria-pressed={language === 'ar'} onClick={() => props.onLanguage('ar')} lang="ar">العربية</button>
        <button type="button" aria-pressed={language === 'en'} onClick={() => props.onLanguage('en')} lang="en">English</button>
      </div>
    </div>
    <ul className="s-sections" style={{ marginBottom: 12 }}>
      <li className="s-sec is-fixed">
        <span aria-hidden="true" />
        <span className="s-sec__thumb s-sec__envelope"><Mail aria-hidden="true" /></span>
        <span className="s-sec__text">
          <span className="s-sec__name">{copy.letterName}</span>
          <span className="s-sec__body">{copy.letterBody}</span>
          <span className="s-sec__meta" style={{ color: 'var(--ink-3)' }}>{copy.alwaysFirst}</span>
        </span>
      </li>
    </ul>
    <Reorder.Group as="ul" axis="y" values={order} onReorder={setDragOrder} className="s-sections">
      {order.map((section, index) => <SectionRow key={section.id} section={section} demo={demoFor(section.key)} copy={copy}
        props={props} onLook={() => setLooking(section.key)} onMove={(delta) => move(index, delta)}
        onToggle={() => save(order.map((s) => (s.id === section.id ? { ...s, isVisible: !s.isVisible } : s)))}
        onDragEnd={() => { if (dragOrder) save(dragOrder); }} />)}
    </Reorder.Group>
    {!order.some((s) => s.isVisible) && <p className="s-note" style={{ marginTop: 14 }}>{copy.noSections}</p>}
    {error && <p className="s-error" role="alert" style={{ marginTop: 14 }}>{error}</p>}
    <div className="s-actions">
      <button type="button" className="s-btn" onClick={props.onNext}>{copy.next}</button>
    </div>
    {lookAt && <Viewer title={copy.sectionInfo[lookAt.key]?.name ?? ''} closeLabel={copy.close} onClose={() => setLooking(null)}>
      <LiveSection section={lookAt} language={language} theme={theme} occasion={occasion} />
    </Viewer>}
  </section>;
}
