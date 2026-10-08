import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** What the browser needs to upload one object. */
export type UploadTarget = {
  url: string;
  method: 'PUT';
  headers: Record<string, string>;
};

export const UPLOAD_TTL_SECONDS = 15 * 60;
export const DOWNLOAD_TTL_SECONDS = 60 * 60;
const CONTENT_TYPE = 'application/octet-stream';
// Every stored object is ciphertext, so only its size is meaningful here.
const KEY_PATTERN = /^items\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/(full|thumb)$/;

/**
 * Encrypted media objects. The browser uploads and downloads directly with
 * short-lived signed URLs; this service only signs, checks size and deletes.
 */
@Injectable()
export class StorageService {
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor(config: ConfigService) {
    const s3 = config.get<Record<string, string | boolean | undefined>>(
      'storage.s3',
      {},
    );
    this.bucket = config.get<string>('storage.s3.bucket', '');
    if (!this.bucket) throw new Error('S3_BUCKET is not configured');
    this.s3 = new S3Client({
      region: s3.region as string,
      endpoint: s3.endpoint as string | undefined,
      forcePathStyle: Boolean(s3.forcePathStyle),
      credentials:
        s3.accessKeyId && s3.secretAccessKey
          ? {
              accessKeyId: s3.accessKeyId as string,
              secretAccessKey: s3.secretAccessKey as string,
            }
          : undefined,
    });
  }

  static isValidKey(key: string): boolean {
    return KEY_PATTERN.test(key);
  }

  async presignUpload(key: string, bytes: number): Promise<UploadTarget> {
    // Content-Length is part of the signature: S3 rejects any other size.
    const url = await getSignedUrl(
      this.s3,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: CONTENT_TYPE,
        ContentLength: bytes,
      }),
      {
        expiresIn: UPLOAD_TTL_SECONDS,
        signableHeaders: new Set(['content-type', 'content-length']),
      },
    );
    return { url, method: 'PUT', headers: { 'Content-Type': CONTENT_TYPE } };
  }

  async presignDownload(key: string): Promise<string> {
    return getSignedUrl(
      this.s3,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: DOWNLOAD_TTL_SECONDS },
    );
  }

  /** Stored size in bytes, or null when the object does not exist. */
  async size(key: string): Promise<number | null> {
    try {
      const head = await this.s3.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return head.ContentLength ?? 0;
    } catch (error) {
      if ((error as { name?: string }).name === 'NotFound') return null;
      throw error;
    }
  }

  /**
   * Deletes the objects or throws. Callers delete their database rows only
   * after this resolves, so a row never outlives a failed deletion silently.
   */
  async deleteMany(keys: string[]): Promise<void> {
    const unique = [...new Set(keys.filter(Boolean))];
    if (!unique.length) return;
    for (let i = 0; i < unique.length; i += 1000) {
      const result = await this.s3.send(
        new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: {
            Objects: unique.slice(i, i + 1000).map((Key) => ({ Key })),
            Quiet: true,
          },
        }),
      );
      if (result.Errors?.length) {
        throw new Error(
          `S3 delete failed for ${result.Errors.map((e) => e.Key).join(', ')}`,
        );
      }
    }
  }
}
