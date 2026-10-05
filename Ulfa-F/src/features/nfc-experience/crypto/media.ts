import type { ExperienceMedia, ExperienceSection } from '../types/experience';
import { decryptBytes, decryptText } from './keys';

export type EncryptedMedia = ExperienceMedia & { encrypted?: boolean; mime?: string | null };

/** Fetches an encrypted object and returns a local object URL of the plaintext. */
export async function decryptToObjectUrl(key: CryptoKey, url: string, mime: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed (${response.status})`);
  const plain = await decryptBytes(key, new Uint8Array(await response.arrayBuffer()));
  return URL.createObjectURL(new Blob([plain], { type: mime }));
}

async function pool<T>(items: T[], limit: number, run: (item: T) => Promise<void>) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) await run(items[next++]);
  }));
}

/**
 * Decrypts captions, voice notes and image thumbnails so the sections can
 * render right away (thumbnails stand in for full images). Full images are
 * decrypted afterwards in the background and delivered through onFullImages
 * in batches, so the page stays responsive even with hundreds of photos.
 */
export async function decryptSections(
  key: CryptoKey,
  sections: ExperienceSection[],
  onFullImages?: (urls: Map<string, string>) => void,
): Promise<ExperienceSection[]> {
  const all = sections.flatMap((s) => (s.media ?? []) as EncryptedMedia[]).filter((m) => m.encrypted);
  const plain = new Map<string, Partial<ExperienceMedia>>();
  await pool(all, 6, async (media) => {
    const caption = media.caption ? await decryptText(key, media.caption).catch(() => null) : null;
    const isImage = media.mediaType === 'IMAGE';
    const source = isImage ? media.thumbnailUrl ?? media.url : media.url;
    const url = await decryptToObjectUrl(key, source, isImage ? 'image/webp' : media.mime ?? 'audio/webm').catch(() => '');
    plain.set(media.id, { caption, url, thumbnailUrl: isImage ? url : null, fullUrl: url });
  });
  if (onFullImages) {
    const images = all.filter((m) => m.mediaType === 'IMAGE' && m.thumbnailUrl && plain.get(m.id)?.url);
    void (async () => {
      let batch = new Map<string, string>();
      await pool(images, 3, async (media) => {
        const url = await decryptToObjectUrl(key, media.url, 'image/webp').catch(() => '');
        if (url) batch.set(media.id, url);
        if (batch.size >= 20) { onFullImages(batch); batch = new Map(); }
      });
      if (batch.size) onFullImages(batch);
    })();
  }
  return sections.map((section) => ({
    ...section,
    media: (section.media ?? []).map((m) => (plain.has(m.id) ? { ...m, ...plain.get(m.id) } : m))
      .filter((m) => m.url),
  }));
}

/** Applies decrypted full-size image URLs to already-rendered sections. */
export function withFullImages(sections: ExperienceSection[], urls: Map<string, string>): ExperienceSection[] {
  return sections.map((section) => ({
    ...section,
    media: section.media?.map((m) => (urls.has(m.id) ? { ...m, url: urls.get(m.id)!, fullUrl: urls.get(m.id)! } : m)),
  }));
}
