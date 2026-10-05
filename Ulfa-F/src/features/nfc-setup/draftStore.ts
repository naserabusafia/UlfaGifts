import { useSyncExternalStore } from 'react';
import { decryptText, encryptBytes, encryptText } from '../nfc-experience/crypto/keys';
import { decryptToObjectUrl } from '../nfc-experience/crypto/media';
import { ApiError, putObject } from './api';
import type { ServerDraft, ServerSection, SetupApi } from './api';
import { processImage } from './media/processImage';

export type MediaStatus = 'processing' | 'uploading' | 'ready' | 'error';
export type DraftMedia = {
  key: string;            // stable local key (React key)
  id: string | null;      // server id once created
  sectionKey: string;
  mediaType: 'IMAGE' | 'VOICE_NOTE';
  mime: string;
  url: string;            // plaintext object URL (full image / audio)
  thumbnailUrl: string;
  caption: string;
  memoryDate: string | null;
  status: MediaStatus;
};
export type Letter = { title: string; message: string; signature: string };
export type SaveState = 'idle' | 'saving' | 'saved' | 'error';
export type DraftState = {
  productName: string;
  language: 'ar' | 'en';
  theme: string;
  occasion: string;
  published: boolean;
  sections: ServerSection[];
  letter: Letter;
  letterSave: SaveState;
  media: DraftMedia[];
  /** The last removed media, restorable for a few seconds. */
  removed: DraftMedia | null;
};

export const SECTION_LIMITS: Record<string, { min: number; max: number; type: 'IMAGE' | 'VOICE_NOTE' }> = {
  photo_wheel: { min: 1, max: 500, type: 'IMAGE' },
  film_strip: { min: 1, max: 200, type: 'IMAGE' },
  memory_calendar: { min: 1, max: 366, type: 'IMAGE' },
  voice_note: { min: 1, max: 5, type: 'VOICE_NOTE' },
};
export const MAX_AUDIO_BYTES = 15 << 20;
const MAX_IMAGE_INPUT_BYTES = 60 << 20;
const PARALLEL_UPLOADS = 3;
const RETRIES = [1000, 3000, 8000];

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));
const retryable = (error: unknown) => error instanceof ApiError && (error.status === 0 || error.status >= 500);

async function withRetry<T>(run: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await run(); } catch (error) {
      if (attempt >= RETRIES.length || !retryable(error)) throw error;
      await sleep(RETRIES[attempt]);
    }
  }
}

type Job = { key: string; file: Blob; cancelled: boolean; running?: boolean };

/**
 * The buyer's draft and everything that syncs it: letter autosave, and a
 * single upload queue for the whole page (it keeps running while the buyer
 * moves between steps). Photos appear immediately from the local file; the
 * worker then compresses and encrypts them and the queue uploads them.
 */
export function createDraftStore(api: SetupApi, contentKey: CryptoKey) {
  let state: DraftState | null = null;
  const listeners = new Set<() => void>();
  const jobs = new Map<string, Job>();
  const queue: Job[] = [];
  let active = 0;
  let letterTimer = 0;
  const orderTimers = new Map<string, number>();
  const captionTimers = new Map<string, number>();
  let counter = 0;

  const emit = () => listeners.forEach((listener) => listener());
  const set = (next: Partial<DraftState>) => { state = { ...state!, ...next }; emit(); };
  const patchMedia = (key: string, patch: Partial<DraftMedia>) =>
    set({ media: state!.media.map((m) => (m.key === key ? { ...m, ...patch } : m)) });
  const find = (key: string) => state?.media.find((m) => m.key === key);
  const inSection = (sectionKey: string) => state!.media.filter((m) => m.sectionKey === sectionKey);

  async function load(draft: ServerDraft) {
    const text = async (value: string | null | undefined) =>
      value ? decryptText(contentKey, value).catch(() => '') : '';
    const media = await Promise.all(draft.media.map(async (m): Promise<DraftMedia | null> => {
      const isImage = m.mediaType === 'IMAGE';
      const thumb = await decryptToObjectUrl(contentKey, (isImage ? m.thumbnailUrl : null) ?? m.url,
        isImage ? 'image/webp' : m.mime ?? 'audio/webm').catch(() => '');
      if (!thumb || !m.sectionKey) return null;
      return { key: m.id, id: m.id, sectionKey: m.sectionKey, mediaType: isImage ? 'IMAGE' : 'VOICE_NOTE',
        mime: m.mime ?? '', url: thumb, thumbnailUrl: thumb, caption: await text(m.caption),
        memoryDate: m.memoryDate, status: 'ready' };
    }));
    state = {
      productName: draft.productName,
      language: draft.language.startsWith('ar') ? 'ar' : 'en',
      theme: draft.theme ?? 'luxury',
      occasion: draft.occasion ?? 'romantic',
      published: draft.published,
      sections: draft.sections,
      letter: {
        title: await text(draft.content?.title),
        message: await text(draft.content?.message),
        signature: await text(draft.content?.signature),
      },
      letterSave: 'idle',
      removed: null,
      media: media.filter((m): m is DraftMedia => !!m),
    };
    emit();
    // Full-size images in the background, a few at a time.
    const images = draft.media.filter((m) => m.mediaType === 'IMAGE' && m.thumbnailUrl);
    for (const m of images) {
      const url = await decryptToObjectUrl(contentKey, m.url, 'image/webp').catch(() => '');
      if (url && find(m.id)) patchMedia(m.id, { url }); else if (url) URL.revokeObjectURL(url);
    }
  }

  // --- letter ---------------------------------------------------------------

  function setLetter(patch: Partial<Letter>) {
    set({ letter: { ...state!.letter, ...patch }, letterSave: 'saving' });
    window.clearTimeout(letterTimer);
    letterTimer = window.setTimeout(saveLetter, 700);
  }

  async function saveLetter() {
    const letter = state!.letter;
    try {
      await withRetry(async () => api.content({
        title: letter.title ? await encryptText(contentKey, letter.title) : undefined,
        message: await encryptText(contentKey, letter.message),
        signature: letter.signature ? await encryptText(contentKey, letter.signature) : undefined,
      }));
      if (state!.letter === letter) set({ letterSave: 'saved' });
    } catch {
      set({ letterSave: 'error' });
    }
  }

  async function flushLetter() {
    if (state?.letterSave !== 'saving') return;
    window.clearTimeout(letterTimer);
    await saveLetter();
  }

  // --- sections ----------------------------------------------------------------

  async function setSections(sections: ServerSection[]) {
    const previous = state!.sections;
    set({ sections });
    try {
      const draft = await api.sections(sections.map((s) => ({ key: s.key, isVisible: s.isVisible })));
      set({ sections: draft.sections });
    } catch (error) {
      set({ sections: previous });
      throw error;
    }
  }

  async function setLanguage(language: 'ar' | 'en') {
    const previous = state!.language;
    set({ language });
    try {
      const draft = await api.settings(language);
      set({ sections: draft.sections });
    } catch (error) {
      set({ language: previous });
      throw error;
    }
  }

  // --- media ---------------------------------------------------------------------

  function room(sectionKey: string) {
    return SECTION_LIMITS[sectionKey].max - inSection(sectionKey).length;
  }

  function addFiles(sectionKey: string, files: File[], memoryDate: string | null = null): number {
    const accepted = files.filter((f) => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name))
      .filter((f) => f.size <= MAX_IMAGE_INPUT_BYTES)
      .slice(0, Math.max(0, room(sectionKey)));
    const added = accepted.map((file): DraftMedia => {
      const key = `local-${Date.now()}-${counter++}`;
      const job = { key, file, cancelled: false };
      jobs.set(key, job); queue.push(job);
      const preview = URL.createObjectURL(file);
      return { key, id: null, sectionKey, mediaType: 'IMAGE', mime: 'image/webp', url: preview,
        thumbnailUrl: preview, caption: '', memoryDate, status: 'processing' };
    });
    set({ media: [...state!.media, ...added] });
    pump();
    return accepted.length;
  }

  function addAudio(blob: Blob, mime: string, caption = ''): boolean {
    if (room('voice_note') <= 0 || blob.size > MAX_AUDIO_BYTES) return false;
    const key = `local-${Date.now()}-${counter++}`;
    const job = { key, file: blob, cancelled: false };
    jobs.set(key, job); queue.push(job);
    const url = URL.createObjectURL(blob);
    set({ media: [...state!.media, { key, id: null, sectionKey: 'voice_note', mediaType: 'VOICE_NOTE',
      mime, url, thumbnailUrl: url, caption, memoryDate: null, status: 'processing' }] });
    pump();
    return true;
  }

  function pump() {
    while (active < PARALLEL_UPLOADS && queue.length) {
      const job = queue.shift()!;
      if (job.cancelled) continue;
      active++;
      job.running = true;
      void upload(job).finally(() => { job.running = false; active--; pump(); emit(); });
    }
  }

  async function upload(job: Job) {
    const item = find(job.key);
    if (!item) return;
    try {
      let full: Uint8Array<ArrayBuffer>;
      let thumb: Uint8Array<ArrayBuffer> | null = null;
      if (item.mediaType === 'IMAGE') {
        const processed = await processImage(job.file, contentKey);
        full = processed.full; thumb = processed.thumb;
        const current = find(job.key);
        if (current) {
          URL.revokeObjectURL(current.url);
          patchMedia(job.key, { url: URL.createObjectURL(processed.preview),
            thumbnailUrl: URL.createObjectURL(processed.thumbPreview),
            // Calendar photos without a chosen day go on the day they were taken.
            ...(current.sectionKey === 'memory_calendar' && !current.memoryDate
              ? { memoryDate: processed.takenOn ?? new Date().toISOString().slice(0, 10) } : {}) });
        }
      } else {
        full = await encryptBytes(contentKey, await job.file.arrayBuffer());
      }
      if (job.cancelled) return;
      patchMedia(job.key, { status: 'uploading' });
      const latest = find(job.key)!;
      const created = await withRetry(async () => api.createMedia({
        sectionKey: latest.sectionKey, mime: latest.mime, bytes: full.length,
        thumbBytes: thumb?.length, displayOrder: inSection(latest.sectionKey).findIndex((m) => m.key === job.key),
        caption: latest.caption ? await encryptText(contentKey, latest.caption) : undefined,
        memoryDate: latest.memoryDate ?? undefined,
      }));
      await Promise.all([
        withRetry(() => putObject(created.uploads.full, full)),
        created.uploads.thumb && thumb ? withRetry(() => putObject(created.uploads.thumb!, thumb)) : null,
      ]);
      await withRetry(() => api.completeMedia(created.id));
      jobs.delete(job.key);
      const pending = pendingDeletes.get(job.key);
      if (pending) {
        // Removed while uploading: keep the id so undo restores it, or the delete removes it.
        pending.item = { ...pending.item, id: created.id, status: 'ready' };
        return;
      }
      if (!find(job.key)) { await api.deleteMedia(created.id).catch(() => undefined); return; }
      const done = find(job.key)!;
      patchMedia(job.key, { id: created.id, status: 'ready' });
      // Edits made while uploading.
      if (done.caption !== latest.caption) saveCaption(job.key);
      if (done.memoryDate !== latest.memoryDate) void api.updateMedia(created.id, { memoryDate: done.memoryDate });
      scheduleOrder(done.sectionKey);
    } catch {
      if (find(job.key)) patchMedia(job.key, { status: 'error' });
    }
  }

  function retry(key: string) {
    const job = jobs.get(key);
    if (!job || find(key)?.status !== 'error') return;
    patchMedia(key, { status: 'processing' });
    queue.push(job);
    pump();
  }

  // Removing hides the item at once; it is deleted for real (from storage
  // too) only after UNDO_MS, so a slip of the finger can be undone.
  const UNDO_MS = 5000;
  const pendingDeletes = new Map<string, { item: DraftMedia; index: number; timer: number }>();

  function remove(key: string) {
    const item = find(key);
    if (!item) return;
    const index = state!.media.indexOf(item);
    const job = jobs.get(key);
    if (job) job.cancelled = true;
    const timer = window.setTimeout(() => void commitDelete(key), UNDO_MS);
    pendingDeletes.set(key, { item, index, timer });
    set({ media: state!.media.filter((m) => m.key !== key), removed: item });
  }

  function undoRemove() {
    const removed = state?.removed;
    const pending = removed && pendingDeletes.get(removed.key);
    if (!pending) return;
    window.clearTimeout(pending.timer);
    pendingDeletes.delete(removed.key);
    const media = [...state!.media];
    media.splice(Math.min(pending.index, media.length), 0, pending.item);
    set({ media, removed: null });
    const job = jobs.get(removed.key);
    if (job) {
      job.cancelled = false;
      // An upload that stopped when the item was removed starts again.
      if (!job.running) { patchMedia(removed.key, { status: 'processing' }); queue.push(job); pump(); }
    }
    scheduleOrder(removed.sectionKey);
  }

  async function commitDelete(key: string, keepalive = false) {
    const pending = pendingDeletes.get(key);
    if (!pending) return;
    pendingDeletes.delete(key);
    window.clearTimeout(pending.timer);
    jobs.delete(key);
    if (state?.removed?.key === key) set({ removed: null });
    const { item } = pending;
    try {
      // A row created by a running upload is deleted when that upload ends.
      if (item.id) await withRetry(() => api.deleteMedia(item.id!, keepalive));
      URL.revokeObjectURL(item.url);
      if (item.thumbnailUrl !== item.url) URL.revokeObjectURL(item.thumbnailUrl);
    } catch {
      // Could not delete: put it back rather than pretend it is gone.
      const media = [...state!.media];
      media.splice(Math.min(pending.index, media.length), 0, item);
      set({ media });
    }
  }

  /** On page close: send pending deletes now, so nothing removed survives. */
  function flushDeletes() {
    for (const key of [...pendingDeletes.keys()]) void commitDelete(key, true);
  }

  function setCaption(key: string, caption: string) {
    patchMedia(key, { caption });
    window.clearTimeout(captionTimers.get(key));
    captionTimers.set(key, window.setTimeout(() => saveCaption(key), 600));
  }

  function saveCaption(key: string) {
    const item = find(key);
    if (!item?.id) return; // sent with the upload
    void (async () => api.updateMedia(item.id!, {
      caption: item.caption ? await encryptText(contentKey, item.caption) : null,
    }))().catch(() => undefined);
  }

  function setMemoryDate(key: string, memoryDate: string) {
    patchMedia(key, { memoryDate });
    const item = find(key);
    if (item?.id) void api.updateMedia(item.id, { memoryDate }).catch(() => undefined);
  }

  /** New order for one section, as local keys. */
  function reorder(sectionKey: string, keys: string[]) {
    const others = state!.media.filter((m) => m.sectionKey !== sectionKey);
    const mine = keys.map((key) => find(key)).filter((m): m is DraftMedia => !!m);
    set({ media: [...others, ...mine] });
    scheduleOrder(sectionKey);
  }

  function scheduleOrder(sectionKey: string) {
    window.clearTimeout(orderTimers.get(sectionKey));
    orderTimers.set(sectionKey, window.setTimeout(() => {
      const ids = inSection(sectionKey).map((m) => m.id).filter((id): id is string => !!id);
      if (ids.length) void withRetry(() => api.orderMedia(sectionKey, ids)).catch(() => undefined);
    }, 700));
  }

  const busyCount = () => state?.media.filter((m) => m.status === 'processing' || m.status === 'uploading').length ?? 0;

  return {
    subscribe: (listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener); },
    get: () => state,
    load, setLetter, flushLetter, setSections, setLanguage,
    addFiles, addAudio, retry, remove, undoRemove, flushDeletes, setCaption, setMemoryDate, reorder, busyCount, room,
    setPublished: (published: boolean) => set({ published }),
  };
}

export type DraftStore = ReturnType<typeof createDraftStore>;

export function useDraft(store: DraftStore): DraftState {
  return useSyncExternalStore(store.subscribe, store.get) as DraftState;
}
