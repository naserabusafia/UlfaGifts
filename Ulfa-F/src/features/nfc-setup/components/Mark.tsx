import { ULFA_PATH } from '../../nfc-experience/PulseLogo';

/** The Ulfa mark, drawn in the current text color. */
export default function Mark({ label }: { label: string }) {
  return <span className="s-mark" role="img" aria-label={label}>
    <svg viewBox="-2 -2 131.5 86.5" aria-hidden="true"><path d={ULFA_PATH} /></svg>
  </span>;
}
