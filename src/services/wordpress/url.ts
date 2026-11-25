export type UrlErrorCode = 'empty' | 'invalid' | 'insecure' | 'unsupported_scheme';

export class UrlError extends Error {
  readonly code: UrlErrorCode;
  constructor(code: UrlErrorCode, message: string) {
    super(message);
    this.name = 'UrlError';
    this.code = code;
    Object.setPrototypeOf(this, UrlError.prototype);
  }
}

export interface ParsedUrl {
  scheme: 'http' | 'https';
  host: string;
  port: number | null;
  path: string;
  query: string;
  hash: string;
}

const URL_RE = /^(https?):\/\/([^/?#]*)([^?#]*)(\?[^#]*)?(#.*)?$/i;

/** Small dependency-free parser (does not rely on the platform URL implementation). */
export function parseUrl(input: string): ParsedUrl | null {
  const m = URL_RE.exec(input.trim());
  if (!m) return null;
  const scheme = (m[1] ?? '').toLowerCase() as 'http' | 'https';
  const authority = m[2] ?? '';
  if (authority.includes('@')) return null; // credentials in URL are never accepted
  const hp = /^(\[[^\]]+\]|[^:]+)(?::(\d{1,5}))?$/.exec(authority);
  if (!hp || !hp[1]) return null;
  let port: number | null = hp[2] ? Number(hp[2]) : null;
  if (port !== null && (port < 1 || port > 65535)) return null;
  if (port === (scheme === 'https' ? 443 : 80)) port = null;
  return {
    scheme,
    host: hp[1].toLowerCase(),
    port,
    path: m[3] ?? '',
    query: m[4] ?? '',
    hash: m[5] ?? '',
  };
}

export function originOf(url: string): string | null {
  const p = parseUrl(url);
  if (!p) return null;
  return `${p.scheme}://${p.host}${p.port !== null ? `:${p.port}` : ''}`;
}

export function sameOrigin(a: string, b: string): boolean {
  const oa = originOf(a);
  return oa !== null && oa === originOf(b);
}

/** Resolve a redirect `Location` (absolute, protocol-relative, root-relative or relative). */
export function resolveUrl(base: string, location: string): string {
  if (/^https?:\/\//i.test(location)) return location;
  const p = parseUrl(base);
  const origin = originOf(base);
  if (!p || !origin) return location;
  if (location.startsWith('//')) return `${p.scheme}:${location}`;
  if (location.startsWith('/')) return `${origin}${location}`;
  const dir = p.path.replace(/[^/]*$/, '');
  return `${origin}${dir || '/'}${location}`;
}

export interface NormalizeOptions {
  /** Development only: allow plain http (e.g. a local staging site). */
  allowInsecureHttp?: boolean;
}

/**
 * Normalises what the user typed into a site root URL, preserving sub-directory
 * installs. `example.com/blog/wp-admin/` -> `https://example.com/blog`.
 */
export function normalizeSiteUrl(input: string, opts: NormalizeOptions = {}): string {
  let raw = input.trim();
  if (!raw) throw new UrlError('empty', 'آدرس سایت را وارد کنید.');
  if (/\s/.test(raw)) throw new UrlError('invalid', 'آدرس سایت نباید فاصله داشته باشد.');
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) raw = `https://${raw}`;
  const scheme = (/^([a-z][a-z0-9+.-]*):/i.exec(raw)?.[1] ?? '').toLowerCase();
  if (scheme !== 'http' && scheme !== 'https') {
    throw new UrlError('unsupported_scheme', 'فقط آدرس‌های http و https پشتیبانی می‌شوند.');
  }
  const p = parseUrl(raw);
  if (!p) {
    throw new UrlError(
      'invalid',
      'آدرس سایت معتبر نیست. نمونه درست: https://example.com یا https://example.com/blog',
    );
  }
  if (p.scheme === 'http' && !opts.allowInsecureHttp) {
    throw new UrlError('insecure', 'برای حفاظت از رمز، آدرس سایت باید با https شروع شود.');
  }
  let path = p.path.replace(/\/{2,}/g, '/');
  path = path.replace(/\/(wp-admin|wp-login\.php|wp-json|wp-content|index\.php)(\/.*)?$/i, '');
  path = path.replace(/\/+$/, '');
  return `${p.scheme}://${p.host}${p.port !== null ? `:${p.port}` : ''}${path}`;
}

/** Normalises an API base override typed by the user. Keeps `?rest_route=` style bases. */
export function normalizeApiBase(input: string, opts: NormalizeOptions = {}): string {
  const raw = input.trim();
  if (!raw) throw new UrlError('empty', 'آدرس پایهٔ API را وارد کنید.');
  const p = parseUrl(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
  if (!p) throw new UrlError('invalid', 'آدرس پایهٔ API معتبر نیست.');
  if (p.scheme === 'http' && !opts.allowInsecureHttp) {
    throw new UrlError('insecure', 'آدرس پایهٔ API باید با https شروع شود.');
  }
  const origin = `${p.scheme}://${p.host}${p.port !== null ? `:${p.port}` : ''}`;
  const path = p.path.replace(/\/{2,}/g, '/');
  if (/(^|[?&])rest_route=/.test(p.query)) {
    return `${origin}${path.replace(/\/*$/, '/')}?rest_route=/`;
  }
  return `${origin}${path.replace(/\/*$/, '/')}`;
}

/** API bases to probe, in order. Not every site answers on `/wp-json/`. */
export function apiBaseCandidates(siteUrl: string): string[] {
  return [`${siteUrl}/wp-json/`, `${siteUrl}/index.php/wp-json/`, `${siteUrl}/?rest_route=/`];
}

export type QueryParamValue = string | number | boolean | null | undefined | Array<string | number>;
export type QueryParams = Record<string, QueryParamValue>;

export function buildQueryString(params?: QueryParams): string {
  if (!params) return '';
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    let v: string;
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      v = value.join(',');
    } else {
      v = String(value);
    }
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(v)}`);
  }
  return parts.join('&');
}

/**
 * Builds a request URL for `route` relative to the API base. Handles both
 * `https://x/wp-json/` and `https://x/?rest_route=/` style bases.
 */
export function joinApiUrl(apiBase: string, route: string, query?: QueryParams): string {
  const r = route.replace(/^\/+/, '');
  const qs = buildQueryString(query);
  if (/[?&]rest_route=/.test(apiBase)) {
    const base = apiBase.replace(/rest_route=.*$/, 'rest_route=');
    return `${base}/${r}${qs ? `&${qs}` : ''}`;
  }
  const base = apiBase.endsWith('/') ? apiBase : `${apiBase}/`;
  return `${base}${r}${qs ? `?${qs}` : ''}`;
}

export function siteIdFromUrl(siteUrl: string): string {
  return siteUrl.replace(/^https?:\/\//i, '').toLowerCase();
}

/** SecureStore keys allow only [A-Za-z0-9._-]; a hash suffix prevents collisions. */
export function storageKeyForSite(siteId: string): string {
  let h = 5381;
  for (let i = 0; i < siteId.length; i++) h = ((h << 5) + h + siteId.charCodeAt(i)) >>> 0;
  return `${siteId.replace(/[^a-z0-9._-]/gi, '_')}-${h.toString(36)}`;
}
