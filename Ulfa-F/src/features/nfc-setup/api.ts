import type { SecretType } from '../nfc-experience/crypto/secret';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1';

export class ApiError extends Error {
  readonly status: number;
  /** The store's note when a paused gift answers 403. */
  readonly reason: string | null;
  constructor(status: number, message: string, reason: string | null = null) {
    super(message);
    this.status = status;
    this.reason = reason;
  }
}

export type SetupState = {
  productName: string;
  nfcId: string;
  hasSecret: boolean;
  viewerAuthType: SecretType | null;
  viewerAuthPrompt: string | null;
  encryption: { keySalt: string; kdfIterations: number } | null;
  published: boolean;
  theme: string | null;
  occasion: string | null;
  language: string;
};

export type ServerSection = {
  id: string; key: string; name: string;
  title: string | null; message: string | null;
  isVisible: boolean; displayOrder: number;
};

export type ServerMedia = {
  id: string; mediaType: string; url: string; thumbnailUrl: string | null;
  caption: string | null; memoryDate: string | null; displayOrder: number;
  mime: string | null; encrypted: boolean; sectionKey: string | null;
};

export type ServerDraft = SetupState & {
  content: { title: string | null; message: string | null; signature: string | null; isEncrypted: boolean } | null;
  sections: ServerSection[];
  media: ServerMedia[];
};

export type UploadTarget = { url: string; method: 'PUT'; headers: Record<string, string> };

export type LockBody = {
  viewerAuthType: SecretType; viewerAuthPrompt?: string; authKey: string; keySalt: string;
  kdfIterations: number; wrappedKey: string; recoveryWrappedKey?: string; recoveryAuthKey?: string;
};

/** Thin client for /setup/:token; the session token is set after unlocking. */
export function setupApi(token: string) {
  let session = '';
  // Resolves once the buyer has unlocked again; requests then retry.
  let onExpired: () => Promise<void> = () => Promise.reject(new ApiError(401, 'SESSION_EXPIRED'));
  const base = `${API_BASE_URL}/setup/${encodeURIComponent(token)}`;

  async function call<T>(method: string, path = '', body?: unknown, retried = false, keepalive = false): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${base}${path}`, {
        method,
        keepalive,
        headers: {
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...(session ? { Authorization: `Bearer ${session}` } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new ApiError(0, 'NETWORK');
    }
    const json = await response.json().catch(() => null) as { data?: T; message?: unknown; reason?: unknown } | null;
    if (response.status === 401 && session && !retried) {
      await onExpired();
      return call<T>(method, path, body, true, keepalive);
    }
    if (!response.ok) {
      const message = Array.isArray(json?.message) ? json.message.join(', ') : String(json?.message ?? response.statusText);
      throw new ApiError(response.status, message, typeof json?.reason === 'string' ? json.reason : null);
    }
    return json?.data as T;
  }

  return {
    setSession: (value: string) => { session = value; },
    /** Called when the session expires (setup sessions last 2 hours). */
    onSessionExpired: (handler: () => Promise<void>) => { onExpired = handler; },
    state: () => call<SetupState>('GET'),
    lock: (body: LockBody) => call<SetupState & { session: string }>('PUT', '/lock', body),
    session: (authKey: string) => call<{ session: string; wrappedKey: string }>('POST', '/session', { authKey }),
    recover: (recoveryAuthKey: string) =>
      call<{ session: string; recoveryWrappedKey: string }>('POST', '/recover', { recoveryAuthKey }),
    draft: () => call<ServerDraft>('GET', '/draft'),
    settings: (language: string) => call<ServerDraft>('PATCH', '/settings', { language }),
    sections: (sections: { key: string; isVisible: boolean }[]) => call<ServerDraft>('PUT', '/sections', { sections }),
    content: (content: { title?: string; message: string; signature?: string }) => call('PUT', '/content', content),
    createMedia: (body: { sectionKey: string; mime: string; bytes: number; thumbBytes?: number;
      displayOrder: number; caption?: string; memoryDate?: string }) =>
      call<{ id: string; uploads: { full: UploadTarget; thumb: UploadTarget | null } }>('POST', '/media', body),
    completeMedia: (id: string) => call<ServerMedia>('POST', `/media/${id}/complete`),
    updateMedia: (id: string, body: { caption?: string | null; memoryDate?: string | null }) =>
      call<ServerMedia>('PATCH', `/media/${id}`, body),
    orderMedia: (sectionKey: string, ids: string[]) => call('PUT', '/media/order', { sectionKey, ids }),
    // keepalive: a delete fired as the page closes still reaches the server.
    deleteMedia: (id: string, keepalive = false) => call('DELETE', `/media/${id}`, undefined, false, keepalive),
    publish: () => call<SetupState>('POST', '/publish'),
  };
}

export type SetupApi = ReturnType<typeof setupApi>;

/** PUT to a signed S3 URL. */
export async function putObject(target: UploadTarget, body: Uint8Array<ArrayBuffer>): Promise<void> {
  let response: Response;
  try {
    response = await fetch(target.url, { method: target.method, headers: target.headers, body });
  } catch {
    throw new ApiError(0, 'NETWORK');
  }
  if (!response.ok) throw new ApiError(response.status, 'UPLOAD_FAILED');
}
