export const PHONE_NUMBER_PATTERN =
  /^(?:\+9705[0-9]{8}|\+9725[0-9]{8}|\+9627[0-9]{8})$/;

/** E.164: a plus sign, a country code and at most 15 digits in total. */
export const INTERNATIONAL_PHONE_NUMBER_PATTERN = /^\+[1-9][0-9]{7,14}$/;

export const normalizePhoneNumber = (value: unknown): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim().replace(/[\s().-]/g, '');
};
