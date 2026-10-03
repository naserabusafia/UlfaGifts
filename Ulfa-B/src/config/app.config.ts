import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  apiPrefix: process.env.API_PREFIX || 'api/v1',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  nfcSetupBaseUrl:
    process.env.NFC_SETUP_BASE_URL || 'http://localhost:5173/setup',
  nfcViewBaseUrl:
    process.env.NFC_VIEW_BASE_URL || 'http://localhost:5173/nfc',
}));
