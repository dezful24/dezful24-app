export interface SiteInfo {
  name: string;
  description: string;
  url: string;
  home: string;
  /** null when the site does not expose it; never guessed silently. */
  gmtOffset: number | null;
  timezoneString: string | null;
}

export interface CurrentUser {
  id: number;
  name: string;
  slug: string;
  roles: string[];
  /** Only the capabilities the app uses (see `pickCapabilities`). */
  capabilities: Record<string, boolean>;
}

export interface SiteSession {
  siteId: string;
  siteUrl: string;
  apiBase: string;
  username: string;
  site: SiteInfo;
  user: CurrentUser;
  connectedAt: string;
}

export interface Pagination {
  total: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  data: T;
  status: number;
  pagination?: Pagination;
}

export const USED_CAPABILITIES = [
  'edit_posts',
  'publish_posts',
  'edit_published_posts',
  'edit_others_posts',
  'delete_posts',
  'delete_others_posts',
  'read_private_posts',
  'upload_files',
  'manage_categories',
  'list_users',
] as const;

export function pickCapabilities(all: Record<string, unknown> | undefined): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  if (!all) return out;
  for (const cap of USED_CAPABILITIES) if (cap in all) out[cap] = all[cap] === true;
  return out;
}
