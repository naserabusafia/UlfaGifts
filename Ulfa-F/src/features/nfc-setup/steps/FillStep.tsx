import type { SetupCopy } from '../copy';
import type { DraftState, DraftStore } from '../draftStore';
import { fillParts, partReady } from '../draftView';
import LetterEditor from '../editors/LetterEditor';
import PhotoEditor from '../editors/PhotoEditor';
import VoiceEditor from '../editors/VoiceEditor';
import { Intro } from './AccessSteps';

export default function FillStep({ copy, draft, store, part, onPart, onBack, onNext }: {
  copy: SetupCopy; draft: DraftState; store: DraftStore; part: string;
  onPart: (part: string) => void; onBack: () => void; onNext: () => void;
}) {
  const parts = fillParts(draft);
  const current = parts.includes(part) ? part : parts[0];
  const index = parts.indexOf(current);
  const ready = parts.filter((key) => partReady(draft, key)).length;
  const name = (key: string) => (key === 'letter' ? copy.letterName : copy.sectionInfo[key]?.name ?? key);
  const go = (key: string) => { onPart(key); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  return <section>
    <Intro eyebrow={copy.fillEyebrow} title={copy.fillTitle} />
    <nav className="s-tabs" aria-label={copy.fillTitle}>
      {parts.map((key) => <button key={key} type="button" className="s-tab" aria-current={key === current ? 'step' : undefined}
        onClick={() => go(key)}>
        <span className={`s-tab__dot${partReady(draft, key) ? ' is-ready' : ''}`} aria-hidden="true" />
        {name(key)}
      </button>)}
    </nav>
    <div className="s-fillhead">
      <h2 className="s-h2">{current === 'letter' ? copy.letterTitle : name(current)}</h2>
      <span className="s-count">{copy.readyCount(ready, parts.length)}</span>
    </div>
    {current === 'letter' && <LetterEditor copy={copy} draft={draft} store={store} />}
    {current === 'voice_note' && <VoiceEditor copy={copy} draft={draft} store={store} />}
    {current !== 'letter' && current !== 'voice_note' && <PhotoEditor key={current} copy={copy} draft={draft} store={store} sectionKey={current} />}
    {current !== 'letter' && !partReady(draft, current) && <p className="s-note" style={{ marginTop: 14 }}>{copy.sectionHidden}</p>}
    <div className="s-actions">
      <button type="button" className="s-text" onClick={() => (index > 0 ? go(parts[index - 1]) : onBack())}>{copy.back}</button>
      <button type="button" className="s-btn" onClick={() => (index < parts.length - 1 ? go(parts[index + 1]) : onNext())}>
        {index < parts.length - 1 ? `${copy.next} · ${name(parts[index + 1])}` : copy.next}
      </button>
    </div>
  </section>;
}
