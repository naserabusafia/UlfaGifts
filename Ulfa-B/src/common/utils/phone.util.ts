export const PHONE_NUMBER_PATTERN =
  /^(?:\+9705[0-9]{8}|\+9725[0-9]{8}|\+9627[0-9]{8})$/;

export const normalizePhoneNumber = (value: unknown): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim().replace(/[\s().-]/g, '');
};
