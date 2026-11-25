import { WordPressError, errorMessages, toWordPressError } from './errors';
import { resolveUrl, sameOrigin } from './url';

export const MAX_REDIRECTS = 5;

export interface GuardedRequest {
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: RequestInit['body'];
  fetchImpl: typeof fetch;
  signal?: AbortSignal;
  /** Credentials and requests may only ever go to this origin. */
  allowedOrigin: string;
  authorization?: string;
}

function redirectError(location: string, status?: number): WordPressError {
  return new WordPressError({
    kind: 'redirect',
    message: errorMessages.redirect,
    status,
    details: { location },
  });
}

/**
 * fetch wrapper that:
 *  - attaches Authorization only to the allowed origin,
 *  - follows redirects manually and refuses any hop to another origin,
 *  - detects redirects the platform followed on its own,
 *  - never sends cookies (`credentials: 'omit'`), so WP cookie auth/nonces cannot interfere.
 */
export async function guardedFetch(
  req: GuardedRequest,
): Promise<{ response: Response; url: string }> {
  let url = req.url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!sameOrigin(url, req.allowedOrigin)) throw redirectError(url);

    const headers: Record<string, string> = { ...(req.headers ?? {}) };
    if (req.authorization) headers.Authorization = req.authorization;

    const response = await req.fetchImpl(url, {
      method: req.method,
      headers,
      body: req.body,
      signal: req.signal,
      redirect: 'manual',
      credentials: 'omit',
    });

    if (response.type === 'opaqueredirect') throw redirectError(url);
    if (response.url && !sameOrigin(response.url, url)) throw redirectError(response.url);

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) return { response, url };
      const next = resolveUrl(url, location);
      if (!sameOrigin(next, req.allowedOrigin)) throw redirectError(next, response.status);
      const safeToReplay = req.method === 'GET' || req.method === 'HEAD';
      if (!safeToReplay && response.status !== 307 && response.status !== 308) {
        throw redirectError(next, response.status);
      }
      url = next;
      continue;
    }
    return { response, url };
  }
  throw redirectError(url);
}

export async function withTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  opts: { timeoutMs: number; signal?: AbortSignal },
): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;
  const onAbort = () => controller.abort();
  if (opts.signal) {
    if (opts.signal.aborted) throw toWordPressError(null, { cancelled: true });
    opts.signal.addEventListener('abort', onAbort);
  }
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, opts.timeoutMs);
  try {
    return await fn(controller.signal);
  } catch (e) {
    throw toWordPressError(e, { timedOut, cancelled: opts.signal?.aborted === true });
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', onAbort);
  }
}
