import { useId, useState } from 'react';
import EnvelopeLetter from '../../../components/EnvelopeLetter/EnvelopeLetter';
import letterPaper from '../../../components/EnvelopeLetter/letter-paper.webp';
import type { SetupCopy } from '../copy';
import type { DraftState, DraftStore } from '../draftStore';
import { Viewer } from '../components/Overlays';
import SaveStatus from './SaveStatus';

const MAX_MESSAGE = 2000;

/** Written on the same paper, in the same type, as the envelope shows it. */
export default function LetterEditor({ copy, draft, store }: { copy: SetupCopy; draft: DraftState; store: DraftStore }) {
  const [envelope, setEnvelope] = useState(false);
  const id = useId();
  const { letter, language } = draft;
  return <div className="s-editor">
    <div className="s-paper" dir={language === 'ar' ? 'rtl' : 'ltr'} lang={language} style={{ backgroundImage: `url(${letterPaper})` }}>
      <label htmlFor={`${id}-title`} className="s-sr">{copy.greeting}</label>
      <input id={`${id}-title`} className="s-paper__greeting" value={letter.title} maxLength={120}
        placeholder={copy.greetingPlaceholder} onChange={(e) => store.setLetter({ title: e.target.value })} />
      <label htmlFor={`${id}-body`} className="s-sr">{copy.message}</label>
      <textarea id={`${id}-body`} className="s-paper__body" value={letter.message} maxLength={MAX_MESSAGE}
        placeholder={copy.messagePlaceholder} onChange={(e) => store.setLetter({ message: e.target.value })} />
      <label htmlFor={`${id}-sign`} className="s-sr">{copy.signature}</label>
      <input id={`${id}-sign`} className="s-paper__sign" value={letter.signature} maxLength={80}
        placeholder={copy.signaturePlaceholder} onChange={(e) => store.setLetter({ signature: e.target.value })} />
      <span className="s-paper__count">{letter.message.length} / {MAX_MESSAGE}</span>
    </div>
    <div className="s-sheet__row">
      <SaveStatus copy={copy} state={draft.letterSave} />
      <button type="button" className="s-link" disabled={!letter.message.trim()}
        onClick={() => { void store.flushLetter(); setEnvelope(true); }}>{copy.seeEnvelope}</button>
    </div>
    {envelope && <Viewer title={copy.letterTitle} closeLabel={copy.close} onClose={() => setEnvelope(false)}>
      <EnvelopeLetter greeting={letter.title} body={letter.message} sign={letter.signature}
        lang={language} theme={draft.theme} occasion={draft.occasion} />
    </Viewer>}
  </div>;
}
