export const PHONE_COUNTRY_CODES = ['+972', '+970', '+962'] as const;

export type PhoneCountryCode = (typeof PHONE_COUNTRY_CODES)[number];

export interface PhoneParts {
  countryCode: PhoneCountryCode;
  localNumber: string;
}

export const splitCustomerPhone = (value: string): PhoneParts => {
  const compact = value.trim().replace(/[\s().-]/g, '');
  const countryCode = PHONE_COUNTRY_CODES.find((code) => compact.startsWith(code));

  if (countryCode) {
    return {
      countryCode,
      localNumber: compact.slice(countryCode.length).replace(/\D/g, '').slice(0, 9),
    };
  }

  const localDigits = compact.replace(/\D/g, '');
  return {
    countryCode: '+970',
    localNumber:
      localDigits.length === 10 && localDigits.startsWith('0')
        ? localDigits.slice(1)
        : localDigits.slice(0, 9),
  };
};

export const normalizeCustomerPhoneForForm = (value?: string): string => {
  if (!value) return '';
  const { countryCode, localNumber } = splitCustomerPhone(value);
  return localNumber ? `${countryCode}${localNumber}` : '';
};
