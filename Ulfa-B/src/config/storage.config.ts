import { registerAs } from '@nestjs/config';

// Encrypted media lives in S3 (or any S3-compatible service).
export default registerAs('storage', () => ({
  s3: {
    bucket: process.env.S3_BUCKET || '',
    region: process.env.S3_REGION || 'us-east-1',
    endpoint: process.env.S3_ENDPOINT || undefined,
    accessKeyId: process.env.S3_ACCESS_KEY_ID || undefined,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || undefined,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
  },
}));
