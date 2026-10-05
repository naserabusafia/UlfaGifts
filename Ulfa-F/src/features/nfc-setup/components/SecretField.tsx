import type { SecretType } from '../../nfc-experience/crypto/secret';
import { PIN_LENGTH } from '../../nfc-experience/crypto/secret';

const thisYear = new Date().getFullYear();

/** One input for any secret type: 6-digit PIN, a date or a text answer. */
export default function SecretField({ type, id, label, value, onChange, placeholder, autoFocus, invalid }: {
  type: SecretType; id: string; label: string; value: string; onChange: (value: string) => void;
  placeholder?: string; autoFocus?: boolean; invalid?: boolean;
}) {
  const common = { id, autoFocus, 'aria-invalid': invalid || undefined, autoComplete: 'off' } as const;
  return <div className="s-field">
    <label className="s-label" htmlFor={id}>{label}</label>
    {type === 'PIN' && <span className="s-pin">
      <input {...common} className="s-pin__input" inputMode="numeric" maxLength={PIN_LENGTH} value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d٠-٩۰-۹]/g, '').slice(0, PIN_LENGTH))} />
      <span className="s-pin__boxes" aria-hidden="true">
        {Array.from({ length: PIN_LENGTH }, (_, i) =>
          <span key={i} className={i < value.length ? 'is-filled' : i === value.length ? 'is-next' : ''}>{value[i] ?? ''}</span>)}
      </span>
    </span>}
    {type === 'DATE' && <input {...common} className="s-input" type="date" min="1900-01-01" max={`${thisYear + 30}-12-31`}
      value={value} onChange={(e) => onChange(e.target.value)} />}
    {type === 'TEXT' && <input {...common} className="s-input" type="text" value={value} maxLength={120}
      placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />}
  </div>;
}
