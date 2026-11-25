import { WordPressClient } from './client';
import { discoverApi } from './discovery';
import { WordPressError } from './errors';
import { pickCapabilities } from './types';
import type { CurrentUser, SiteSession } from './types';
import { normalizeApiBase, normalizeSiteUrl, sameOrigin, siteIdFromUrl } from './url';
import { UrlError } from './url';

export interface ConnectInput {
  siteUrl: string;
  username: string;
  /** As copied from WordPress; spaces are allowed and stripped here. */
  appPassword: string;
  apiBaseOverride?: string;
}

export interface ConnectDeps {
  fetchImpl?: typeof fetch;
  allowInsecureHttp?: boolean;
  timeoutMs?: number;
  signal?: AbortSignal;
  now?: () => Date;
}

export interface ConnectResult {
  session: SiteSession;
  client: WordPressClient;
  /** Transient: hand straight to secure storage, never keep it elsewhere. */
  appPassword: string;
}

interface WpUserMe {
  id?: number;
  name?: string;
  slug?: string;
  roles?: string[];
  capabilities?: Record<string, unknown>;
}

export function normalizeAppPassword(raw: string): string {
  return raw.replace(/\s+/g, '');
}

export async function connectToSite(
  input: ConnectInput,
  deps: ConnectDeps = {},
): Promise<ConnectResult> {
  const opts = { allowInsecureHttp: deps.allowInsecureHttp };
  const siteUrl = normalizeSiteUrl(input.siteUrl, opts);
  const username = input.username.trim();
  const appPassword = normalizeAppPassword(input.appPassword);

  let apiBaseOverride: string | undefined;
  if (input.apiBaseOverride?.trim()) {
    apiBaseOverride = normalizeApiBase(input.apiBaseOverride, opts);
    if (!sameOrigin(apiBaseOverride, siteUrl)) {
      throw new UrlError('invalid', 'آدرس پایهٔ API باید روی همان دامنهٔ سایت باشد.');
    }
  }

  const discovery = await discoverApi(siteUrl, { ...deps, ...opts, apiBaseOverride });
  const siteId = siteIdFromUrl(siteUrl);
  const client = new WordPressClient({
    siteId,
    apiBase: discovery.apiBase,
    username,
    appPassword,
    fetchImpl: deps.fetchImpl,
    allowInsecureHttp: deps.allowInsecureHttp,
    timeoutMs: deps.timeoutMs,
  });

  const { data: me } = await client.get<WpUserMe>('/wp/v2/users/me', {
    query: { context: 'edit' },
    signal: deps.signal,
  });
  const capabilities = pickCapabilities(me.capabilities);
  // If the site exposes capabilities, require the one needed to write posts.
  if (Object.keys(capabilities).length > 0 && capabilities.edit_posts !== true) {
    throw new WordPressError({
      kind: 'forbidden',
      message: 'این حساب مجوز ایجاد یا ویرایش نوشته ندارد. از نقش نویسنده یا بالاتر استفاده کنید.',
    });
  }
  const user: CurrentUser = {
    id: typeof me.id === 'number' ? me.id : 0,
    name: me.name ?? username,
    slug: me.slug ?? '',
    roles: Array.isArray(me.roles) ? me.roles : [],
    capabilities,
  };
  const session: SiteSession = {
    siteId,
    siteUrl,
    apiBase: discovery.apiBase,
    username,
    site: discovery.site,
    user,
    connectedAt: (deps.now?.() ?? new Date()).toISOString(),
  };
  return { session, client, appPassword };
}
