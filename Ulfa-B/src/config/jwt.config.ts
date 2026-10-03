import { registerAs } from '@nestjs/config';

export default registerAs('jwt', () => ({
  secret: process.env.JWT_SECRET || 'super_secret_jwt_key_ulfa_2026_change_in_production',
  expiresIn: process.env.JWT_EXPIRES_IN || '30d',
}));
