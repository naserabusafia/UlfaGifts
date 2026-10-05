import { useState } from 'react';
import { NfcExperiencePreview } from '../../nfc-experience/NfcExperiencePage';
import type { LocalExperience, ViewerAuthType } from '../../nfc-experience/NfcExperiencePage';
import type { ExperienceSection } from '../../nfc-experience/types/experience';
import type { SetupCopy } from '../copy';
import type { DraftState } from '../draftStore';
import { toExperienceMedia } from '../draftView';

/**
 * The prototype: the recipient page itself, fed the local (decrypted) draft
 * instead of the API, starting from the lock screen. Only a small bar floats
 * over it.
 */
export default function PreviewStep({ copy, draft, authType, prompt, verify, onEdit, onPublish }: {
  copy: SetupCopy; draft: DraftState; authType: ViewerAuthType; prompt: string | null;
  verify: (type: ViewerAuthType, answer: string) => Promise<boolean>;
  onEdit: () => void; onPublish: () => Promise<void>;
}) {
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState('');
  // A snapshot: the preview should not restart while background uploads finish.
  const [experience] = useState<LocalExperience>(() => ({
    challenge: { viewerAuthType: authType, viewerAuthPrompt: prompt },
    appearance: { theme: draft.theme, occasion: draft.occasion, language: draft.language },
    letter: { ...draft.letter },
    sections: draft.sections.filter((s) => s.isVisible).map((s, index): ExperienceSection => ({
      id: s.id, key: s.key, title: s.title, message: s.message, displayOrder: index + 1,
      media: toExperienceMedia(draft.media.filter((m) => m.sectionKey === s.key)),
    })),
    verify,
  }));
  const busy = draft.media.some((m) => m.status === 'processing' || m.status === 'uploading');

  const publish = async () => {
    setError('');
    if (!draft.letter.message.trim()) return setError(copy.needMessage);
    setPublishing(true);
    try { await onPublish(); } catch { setError(copy.networkError); setPublishing(false); }
  };

  return <>
    <NfcExperiencePreview experience={experience} />
    <div className="s-previewbar" role="toolbar" aria-label={copy.previewTitle}>
      {error && <span className="s-previewbar__error" role="alert">{error}</span>}
      <button type="button" className="s-btn s-btn--line" onClick={onEdit}>{copy.editSection}</button>
      {draft.published
        ? <span className="s-previewbar__live">● {copy.live}</span>
        : <button type="button" className="s-btn" onClick={() => void publish()} disabled={publishing}>
          {publishing ? (busy ? copy.waitUploads : copy.publishing) : copy.publish}</button>}
    </div>
  </>;
}
