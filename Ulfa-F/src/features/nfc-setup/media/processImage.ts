import type { ImageJob, ImageResult } from './image.worker';

export type ProcessedImage = Extract<ImageResult, { ok: true }>;

// Two workers: enough to keep a phone busy without running out of memory on
// large photos.
const WORKERS = 2;
let workers: { worker: Worker; busy: boolean }[] = [];
const waiting: { job: Omit<ImageJob, 'id'>; resolve: (r: ProcessedImage) => void; reject: (e: Error) => void }[] = [];
const running = new Map<number, { resolve: (r: ProcessedImage) => void; reject: (e: Error) => void; slot: number }>();
let nextId = 1;

function start() {
  if (workers.length) return;
  workers = Array.from({ length: WORKERS }, () => {
    const worker = new Worker(new URL('./image.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }: MessageEvent<ImageResult>) => {
      const task = running.get(data.id);
      if (!task) return;
      running.delete(data.id);
      workers[task.slot].busy = false;
      if (data.ok) task.resolve(data); else task.reject(new Error(data.error));
      pump();
    };
    return { worker, busy: false };
  });
}

function pump() {
  for (const [slot, entry] of workers.entries()) {
    if (entry.busy || !waiting.length) continue;
    const { job, resolve, reject } = waiting.shift()!;
    const id = nextId++;
    entry.busy = true;
    running.set(id, { resolve, reject, slot });
    entry.worker.postMessage({ ...job, id } satisfies ImageJob);
  }
}

/** Resize, WebP-encode and encrypt a photo in a background worker. */
export function processImage(file: Blob, key: CryptoKey): Promise<ProcessedImage> {
  start();
  return new Promise((resolve, reject) => {
    waiting.push({ job: { file, key }, resolve, reject });
    pump();
  });
}
