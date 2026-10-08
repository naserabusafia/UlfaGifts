import { DeleteObjectsCommand, S3Client } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';
import { StorageService } from './storage.service';

const KEY =
  'items/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222/full';

const make = (values: Record<string, unknown>) =>
  new StorageService({
    get: (key: string, fallback?: unknown) => values[key] ?? fallback,
  } as unknown as ConfigService);

describe('StorageService', () => {
  describe('s3', () => {
    const service = make({
      'storage.s3': {
        region: 'eu-central-1',
        accessKeyId: 'AKIDEXAMPLE',
        secretAccessKey: 'secret',
      },
      'storage.s3.bucket': 'ulfa-media',
    });

    it('signs uploads for the exact size and type', async () => {
      const target = await service.presignUpload(KEY, 1234);
      const url = new URL(target.url);
      expect(url.hostname).toBe('ulfa-media.s3.eu-central-1.amazonaws.com');
      expect(url.pathname).toBe(`/${KEY}`);
      expect(url.searchParams.get('X-Amz-SignedHeaders')).toContain(
        'content-length',
      );
      expect(url.searchParams.get('X-Amz-Expires')).toBe('900');
      expect(target).toMatchObject({
        method: 'PUT',
        headers: { 'Content-Type': 'application/octet-stream' },
      });
    });

    it('signs short-lived downloads', async () => {
      const url = new URL(await service.presignDownload(KEY));
      expect(url.searchParams.get('X-Amz-Expires')).toBe('3600');
    });

    it('deletes in one batch and fails loudly on partial errors', async () => {
      const send = jest
        .spyOn(S3Client.prototype, 'send')
        .mockResolvedValueOnce({} as never)
        .mockResolvedValueOnce({ Errors: [{ Key: KEY }] } as never);
      await service.deleteMany([KEY, `${KEY.slice(0, -4)}thumb`, KEY]);
      const command = send.mock.calls[0][0] as DeleteObjectsCommand;
      expect(command.input.Delete?.Objects).toEqual([
        { Key: KEY },
        { Key: `${KEY.slice(0, -4)}thumb` },
      ]);
      await expect(service.deleteMany([KEY])).rejects.toThrow(KEY);
      send.mockRestore();
    });
  });

  it('refuses to start without a bucket', () => {
    expect(() => make({ 'storage.s3': {} })).toThrow('S3_BUCKET');
  });

  it('rejects keys outside the item layout', () => {
    expect(StorageService.isValidKey(KEY)).toBe(true);
    expect(StorageService.isValidKey(`${KEY}/../x`)).toBe(false);
  });
});
