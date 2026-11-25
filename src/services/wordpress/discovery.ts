import { WordPressClient } from './client';
import { WordPressError, errorMessages } from './errors';
import type { SiteInfo } from './types';
import { apiBaseCandidates, siteIdFromUrl } from './url';

export interface DiscoveryDeps {
  fetchImpl?: typeof fetch;
  allowInsecureHttp?: boolean;
  timeoutMs?: number;
  signal?: AbortSignal;
  /** User-supplied API base (already normalised); probed first and exclusively. */
  apiBaseOverride?: string;
}

export interface DiscoveryResult {
  apiBase: string;
  site: SiteInfo;
}

interface RootIndex {
  name?: unknown;
  description?: unknown;
  url?: unknown;
  home?: unknown;
  gmt_offset?: unknown;
  timezone_string?: unknown;
  namespaces?: unknown;
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

async function probe(apiBase: string, siteUrl: string, deps: DiscoveryDeps): Promise<SiteInfo> {
  // Anonymous client: discovery never carries credentials.
  const client = new WordPressClient({
    siteId: siteIdFromUrl(siteUrl),
    apiBase,
    username: '',
    appPassword: '',
    fetchImpl: deps.fetchImpl,
    allowInsecureHttp: deps.allowInsecureHttp,
    timeoutMs: deps.timeoutMs,
    maxRetries: 0,
  });
  const { data } = await client.get<RootIndex>('/', { signal: deps.signal });
  const namespaces = Array.isArray(data?.namespaces) ? (data.namespaces as unknown[]) : [];
  if (!namespaces.includes('wp/v2')) {
    throw new WordPressError({
      kind: 'rest_unavailable',
      message: errorMessages.restUnavailable,
      details: { apiBase },
    });
  }
  const gmt = data.gmt_offset;
  const tz = str(data.timezone_string);
  return {
    name: str(data.name) || siteUrl,
    description: str(data.description).slice(0, 200),
    url: str(data.url) || siteUrl,
    home: str(data.home) || siteUrl,
    gmtOffset: typeof gmt === 'number' ? gmt : null,
    timezoneString: tz !== '' ? tz : null,
  };
}

const HARD_FAILURES = new Set(['network', 'timeout', 'cancelled', 'redirect', 'insecure']);

export async function discoverApi(siteUrl: string, deps: DiscoveryDeps): Promise<DiscoveryResult> {
  const candidates = deps.apiBaseOverride ? [deps.apiBaseOverride] : apiBaseCandidates(siteUrl);
  let lastError: WordPressError | null = null;
  for (const apiBase of candidates) {
    try {
      return { apiBase, site: await probe(apiBase, siteUrl, deps) };
    } catch (e) {
      if (!(e instanceof WordPressError)) throw e;
      // Network problems / redirects will not be fixed by trying another path.
      if (HARD_FAILURES.has(e.kind)) throw e;
      lastError = e;
    }
  }
  throw (
    lastError ??
    new WordPressError({ kind: 'rest_unavailable', message: errorMessages.restUnavailable })
  );
}
