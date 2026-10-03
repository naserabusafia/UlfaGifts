import { normalizePhoneNumber, PHONE_NUMBER_PATTERN } from './phone.util';

describe('customer phone validation', () => {
  it.each(['+970591234567', '+972501234567', '+962791234567', '+962771234567'])(
    'accepts supported mobile number %s',
    (phone) => {
      expect(PHONE_NUMBER_PATTERN.test(phone)).toBe(true);
    },
  );

  it.each([
    '+970491234567',
    '+97259123456',
    '+962691234567',
    '+963791234567',
    '0591234567',
  ])('rejects unsupported mobile number %s', (phone) => {
    expect(PHONE_NUMBER_PATTERN.test(phone)).toBe(false);
  });

  it('normalizes spaces, parentheses, dots, and dashes', () => {
    expect(normalizePhoneNumber('+962 (79) 123-45.67')).toBe('+962791234567');
  });
});
