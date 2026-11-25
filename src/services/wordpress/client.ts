import { base64EncodeUtf8 } from '../../utils/base64';
import { WordPressError, errorMessages, mapHttpError } from './errors';
import { guardedFetch, withTimeout } from './http';
import type { ApiResponse, Pagination } from './types';
import { joinApiUrl, originOf, parseUrl } from './url';
import type { QueryParams } from './url';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface WordPressClientConfig {
  siteId: string;
  apiBase: string;
  /** Leave username/appPassword empty for anonymous discovery requests. */
  username: string;
  appPassword: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxRetries?: number;
  allowInsecureHttp?: boolean;
  sleep?: (ms: number) => Promise<void>;
}

export interface RequestOptions {
  query?: QueryParams;
  body?: unknown;
  formData?: FormData;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  timeoutMs?: number;
  /** Only GET requests are ever retried; set false to disable even there. */
  retry?: boolean;
}

function parsePagination(get: (n: string) => string | null): Pagination | undefined {
  const total = get('x-wp-total');
  const pages = get('x-wp-totalpages');
  if (total === null && pages === null) return undefined;
  const t = Number.parseInt(total ?? '', 10);
  const p = Number.parseInt(pages ?? '', 10);
  return {
    total: Number.isFinite(t) ? t : 0,
    totalPages: Number.isFinite(p) ? p : 0,
  };
}

export class WordPressClient {
  readonly siteId: string;
  readonly apiBase: string;
  readonly #authorization: string | null;
  readonly #origin: string;
  readonly #fetchImpl: typeof fetch | undefined;
  readonly #timeoutMs: number;
  readonly #maxRetries: number;
  readonly #sleep: (ms: number) => Promise<void>;

  constructor(config: WordPressClientConfig) {
    const origin = originOf(config.apiBase);
    if (!origin) {
      throw new WordPressError({ kind: 'unknown', message: 'آدرس پایهٔ API معتبر نیست.' });
    }
    if (parseUrl(config.apiBase)?.scheme === 'http' && !config.allowInsecureHttp) {
      throw new WordPressError({ kind: 'insecure', message: errorMessages.insecure });
    }
    this.siteId = config.siteId;
    this.apiBase = config.apiBase;
    this.#origin = origin;
    this.#authorization =
      config.username && config.appPassword
        ? `Basic ${base64EncodeUtf8(`${config.username}:${config.appPassword}`)}`
        : null;
    this.#fetchImpl = config.fetchImpl;
    this.#timeoutMs = config.timeoutMs ?? 20000;
    this.#maxRetries = config.maxRetries ?? 2;
    this.#sleep = config.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  /** Keeps credentials out of JSON.stringify / console output. */
  toJSON(): { siteId: string; apiBase: string } {
    return { siteId: this.siteId, apiBase: this.apiBase };
  }

  get<T>(route: string, opts?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>('GET', route, opts);
  }
  post<T>(route: string, opts?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>('POST', route, opts);
  }
  delete<T>(route: string, opts?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>('DELETE', route, opts);
  }

  async request<T>(
    method: HttpMethod,
    route: string,
    opts: RequestOptions = {},
  ): Promise<ApiResponse<T>> {
    const url = joinApiUrl(this.apiBase, route, opts.query);
    // Creating, publishing or uploading must never be repeated blindly.
    const attempts = method === 'GET' && opts.retry !== false ? this.#maxRetries + 1 : 1;
    let last: unknown;
    for (let i = 0; i < attempts; i++) {
      try {
        return await this.#once<T>(method, url, opts);
      } catch (e) {
        last = e;
        const retryable = e instanceof WordPressError && e.retryable;
        if (!retryable || i === attempts - 1) throw e;
        await this.#sleep(300 * 2 ** i);
      }
    }
    throw last;
  }

  #once<T>(method: HttpMethod, url: string, opts: RequestOptions): Promise<ApiResponse<T>> {
    return withTimeout(
      async (signal) => {
        const headers: Record<string, string> = { Accept: 'application/json', ...opts.headers };
        let body: RequestInit['body'] | undefined;
        if (opts.formData) {
          body = opts.formData as unknown as RequestInit['body'];
        } else if (opts.body !== undefined) {
          headers['Content-Type'] = 'application/json; charset=utf-8';
          body = JSON.stringify(opts.body);
        }
        const fetchImpl: typeof fetch = this.#fetchImpl ?? ((...a) => fetch(...a));
        const { response } = await guardedFetch({
          url,
          method,
          headers,
          body,
          fetchImpl,
          signal,
          allowedOrigin: this.#origin,
          authorization: this.#authorization ?? undefined,
        });
        const text = await response.text();
        if (!response.ok) throw mapHttpError(response.status, text);

        const pagination = parsePagination((n) => response.headers.get(n));
        const trimmed = text.trim().replace(/^\uFEFF/, '');
        if (response.status === 204 || trimmed === '') {
          return { data: undefined as T, status: response.status, pagination };
        }
        try {
          return { data: JSON.parse(trimmed) as T, status: response.status, pagination };
        } catch {
          throw new WordPressError({
            kind: 'invalid_response',
            message: errorMessages.invalidResponse,
            status: response.status,
          });
        }
      },
      { timeoutMs: opts.timeoutMs ?? this.#timeoutMs, signal: opts.signal },
    );
  }
}
