/// <reference lib="webworker" />
// Off the main thread: decode a photo (EXIF orientation applied), resize to a
// full image and a thumbnail, encode both as WebP and encrypt them. Re-encoding
// also drops EXIF metadata such as GPS location.
import encode from '@jsquash/webp/encode';
import { encryptBytes } from '../../nfc-experience/crypto/keys';
import { exifDate } from './exif';

export type ImageJob = { id: number; file: Blob; key: CryptoKey };
export type ImageResult =
  | { id: number; ok: true; full: Uint8Array<ArrayBuffer>; thumb: Uint8Array<ArrayBuffer>;
      preview: Blob; thumbPreview: Blob; width: number; height: number; takenOn: string | null }
  | { id: number; ok: false; error: string };

const FULL_EDGE = 2048;
const THUMB_EDGE = 480;
const FULL_QUALITY = 82;
const THUMB_QUALITY = 72;

function scaled(bitmap: ImageBitmap, edge: number) {
  const ratio = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * ratio));
  const height = Math.max(1, Math.round(bitmap.height * ratio));
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext('2d')!;
  context.imageSmoothingQuality = 'high';
  context.drawImage(bitmap, 0, 0, width, height);
  return context.getImageData(0, 0, width, height);
}

self.onmessage = async ({ data }: MessageEvent<ImageJob>) => {
  try {
    // Read before re-encoding, which drops EXIF.
    const takenOn = exifDate(await data.file.slice(0, 256 * 1024).arrayBuffer());
    const bitmap = await createImageBitmap(data.file, { imageOrientation: 'from-image' });
    const fullPixels = scaled(bitmap, FULL_EDGE);
    const thumbPixels = scaled(bitmap, THUMB_EDGE);
    bitmap.close();
    const full = await encode(fullPixels, { quality: FULL_QUALITY });
    const thumb = await encode(thumbPixels, { quality: THUMB_QUALITY });
    const result: ImageResult = {
      id: data.id, ok: true,
      full: await encryptBytes(data.key, full),
      thumb: await encryptBytes(data.key, thumb),
      preview: new Blob([full], { type: 'image/webp' }),
      thumbPreview: new Blob([thumb], { type: 'image/webp' }),
      width: fullPixels.width, height: fullPixels.height, takenOn,
    };
    (self as unknown as DedicatedWorkerGlobalScope).postMessage(result, [result.full.buffer, result.thumb.buffer]);
  } catch (error) {
    (self as unknown as DedicatedWorkerGlobalScope).postMessage({ id: data.id, ok: false, error: String(error) } satisfies ImageResult);
  }
};
