import type { SetupCopy } from '../copy';
import type { SaveState } from '../draftStore';

export default function SaveStatus({ copy, state }: { copy: SetupCopy; state: SaveState }) {
  if (state === 'idle') return null;
  return <span className={`s-save s-save--${state}`} role="status">
    {state === 'saving' ? copy.saving : state === 'saved' ? `✓ ${copy.saved}` : copy.saveError}
  </span>;
}
