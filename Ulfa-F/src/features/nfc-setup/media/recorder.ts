export const MAX_RECORDING_SECONDS = 180;

export type MicPermission = 'granted' | 'denied' | 'prompt' | 'unsupported';

/** Current microphone permission, without prompting (where the browser tells). */
export async function micPermission(): Promise<MicPermission> {
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') return 'unsupported';
  try {
    const status = await navigator.permissions.query({ name: 'microphone' as PermissionName });
    return status.state as MicPermission;
  } catch {
    return 'prompt'; // Safari/Firefox may not expose it; asking will tell.
  }
}

// Chrome/Android record Opus in WebM, Safari/iOS AAC in MP4.
function recordingType(): string {
  for (const type of ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg;codecs=opus']) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return '';
}

export type Recording = {
  stop: () => Promise<{ blob: Blob; mime: string; seconds: number }>;
  cancel: () => void;
  level: () => number; // 0..1, for the live meter
};

/**
 * Asks for the microphone (the browser shows its own prompt the first time)
 * and starts recording. Rejects with NotAllowedError if permission is denied.
 */
export async function startRecording(onLimit: () => void): Promise<Recording> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  const mime = recordingType();
  const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
  const started = performance.now();
  recorder.start(250);

  const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  const context = AudioCtx ? new AudioCtx() : null;
  const analyser = context?.createAnalyser();
  if (context && analyser) {
    analyser.fftSize = 512;
    context.createMediaStreamSource(stream).connect(analyser);
  }
  const samples = new Uint8Array(analyser?.fftSize ?? 0);
  const limit = window.setTimeout(onLimit, MAX_RECORDING_SECONDS * 1000);

  const release = () => {
    window.clearTimeout(limit);
    stream.getTracks().forEach((track) => track.stop());
    void context?.close().catch(() => undefined);
  };

  return {
    level: () => {
      if (!analyser) return 0;
      analyser.getByteTimeDomainData(samples);
      let peak = 0;
      for (const value of samples) peak = Math.max(peak, Math.abs(value - 128));
      return Math.min(1, peak / 64);
    },
    cancel: () => { recorder.onstop = null; if (recorder.state !== 'inactive') recorder.stop(); release(); },
    stop: () => new Promise((resolve) => {
      recorder.onstop = () => {
        release();
        const type = (recorder.mimeType || mime || 'audio/webm').split(';')[0];
        resolve({ blob: new Blob(chunks, { type }), mime: recorder.mimeType || type,
          seconds: (performance.now() - started) / 1000 });
      };
      recorder.stop();
    }),
  };
}

/** Duration of a local audio file, or null if the browser cannot read it. */
export function audioDuration(blob: Blob): Promise<number | null> {
  return new Promise((resolve) => {
    const audio = new Audio();
    const url = URL.createObjectURL(blob);
    const done = (value: number | null) => { URL.revokeObjectURL(url); resolve(value); };
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => done(Number.isFinite(audio.duration) ? audio.duration : null);
    audio.onerror = () => done(null);
    audio.src = url;
  });
}
