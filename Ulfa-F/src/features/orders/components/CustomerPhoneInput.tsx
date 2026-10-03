import React from 'react';
import {
  PHONE_COUNTRY_CODES,
  type PhoneCountryCode,
  splitCustomerPhone,
} from '../utils/customerPhone';

interface CustomerPhoneInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  countryCodeLabel: string;
  phoneNumberLabel: string;
  placeholder?: string;
  hint?: string;
  autoFocus?: boolean;
}

export const CustomerPhoneInput: React.FC<CustomerPhoneInputProps> = ({
  id,
  value,
  onChange,
  countryCodeLabel,
  phoneNumberLabel,
  placeholder = '591234567',
  hint,
  autoFocus,
}) => {
  const { countryCode, localNumber } = splitCustomerPhone(value);
  const requiredStart = countryCode === '+962' ? '7' : '5';
  const pattern = `${requiredStart}[0-9]{8}`;
  const effectivePlaceholder = countryCode === '+962' ? '791234567' : placeholder;

  return (
    <div>
      <div dir="ltr" className="grid grid-cols-[7rem_minmax(0,1fr)] gap-2">
        <select
          aria-label={countryCodeLabel}
          value={countryCode}
          onChange={(event) =>
            onChange(`${event.target.value as PhoneCountryCode}${localNumber}`)
          }
          className="rounded-xl border border-input bg-background px-3 py-3 text-sm font-bold text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
        >
          {PHONE_COUNTRY_CODES.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>
        <input
          id={id}
          required
          autoFocus={autoFocus}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          maxLength={9}
          pattern={pattern}
          value={localNumber}
          onChange={(event) => {
            const digits = event.target.value.replace(/\D/g, '').slice(0, 9);
            onChange(`${countryCode}${digits}`);
          }}
          placeholder={effectivePlaceholder}
          aria-label={phoneNumberLabel}
          title={hint}
          className="min-w-0 rounded-xl border border-input bg-background px-3.5 py-3 text-start text-sm text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/10"
        />
      </div>
      {hint && <p className="mt-1.5 text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
};

export default CustomerPhoneInput;
