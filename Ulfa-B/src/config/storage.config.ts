import { registerAs } from '@nestjs/config';

export default registerAs('storage', () => ({
  // 'local' keeps files on disk behind signed URLs (development);
  // 's3' talks to S3 or any S3-compatible service.
  driver: process.env.STORAGE_DRIVER === 's3' ? 's3' : 'local',
  localDir: process.env.STORAGE_LOCAL_DIR || 'storage',
  // Public base of this API, used to build local signed URLs.
  publicApiUrl:
    process.env.PUBLIC_API_URL ||
    `http://localhost:${process.env.PORT || 3000}/${process.env.API_PREFIX || 'api/v1'}`,
  signingSecret:
    process.env.STORAGE_SIGNING_SECRET || process.env.JWT_SECRET || 'dev',
  s3: {
    bucket: process.env.S3_BUCKET || '',
    region: process.env.S3_REGION || 'us-east-1',
    endpoint: process.env.S3_ENDPOINT || undefined,
    accessKeyId: process.env.S3_ACCESS_KEY_ID || undefined,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || undefined,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
  },
}));
