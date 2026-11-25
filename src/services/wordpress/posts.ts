import type { WordPressClient } from './client';
import { WordPressError } from './errors';
import type { Pagination } from './types';
import type { QueryParams } from './url';

export type PostStatus = 'publish' | 'draft' | 'pending' | 'future' | 'private' | 'trash';
export type StatusFilter = PostStatus | 'all';
export type PostOrderBy = 'date' | 'modified';

export interface WpRendered {
  raw?: string;
  rendered?: string;
}

interface EmbeddedMedia {
  source_url?: string;
  media_details?: { sizes?: Record<string, { source_url?: string } | undefined> };
}

export interface WpPost {
  id: number;
  date: string;
  date_gmt: string;
  modified: string;
  modified_gmt: string;
  slug: string;
  status: PostStatus;
  link: string;
  title?: WpRendered;
  excerpt?: WpRendered;
  author: number;
  featured_media: number;
  categories: number[];
  tags: number[];
  _embedded?: {
    author?: Array<{ name?: string } | undefined>;
    'wp:featuredmedia'?: Array<EmbeddedMedia | undefined>;
  };
}

export interface WpTerm {
  id: number;
  name: string;
  slug: string;
  parent: number;
  count: number;
}

export interface PostFilters {
  search: string;
  status: StatusFilter;
  categoryId: number | null;
  orderBy: PostOrderBy;
}

export interface Page<T> {
  items: T[];
  pagination: Pagination;
}

export const DEFAULT_FILTERS: PostFilters = {
  search: '',
  status: 'all',
  categoryId: null,
  orderBy: 'date',
};

export const STATUS_LABELS: Record<PostStatus, string> = {
  publish: 'منتشرشده',
  draft: 'پیش‌نویس',
  pending: 'در انتظار بررسی',
  future: 'زمان‌بندی‌شده',
  private: 'خصوصی',
  trash: 'زباله‌دان',
};

/** "all" means every non-trash status the user may see; private only with the capability. */
export function statusesFor(filter: StatusFilter, caps: Record<string, boolean>): PostStatus[] {
  if (filter !== 'all') return [filter];
  const s: PostStatus[] = ['publish', 'draft', 'pending', 'future'];
  if (caps.read_private_posts === true) s.push('private');
  return s;
}

export function buildPostsQuery(
  f: PostFilters,
  page: number,
  perPage: number,
  caps: Record<string, boolean>,
): QueryParams {
  return {
    context: 'edit',
    page,
    per_page: perPage,
    status: statusesFor(f.status, caps).join(','),
    search: f.search.trim() || undefined,
    categories: f.categoryId ?? undefined,
    orderby: f.orderBy,
    order: 'desc',
    _embed: 'author,wp:featuredmedia',
  };
}

export async function listPosts(
  client: WordPressClient,
  filters: PostFilters,
  page: number,
  perPage: number,
  caps: Record<string, boolean>,
  signal?: AbortSignal,
): Promise<Page<WpPost>> {
  try {
    const res = await client.get<WpPost[]>('/wp/v2/posts', {
      query: buildPostsQuery(filters, page, perPage, caps),
      signal,
    });
    return {
      items: res.data,
      pagination: res.pagination ?? { total: res.data.length, totalPages: 1 },
    };
  } catch (e) {
    // WordPress answers 400 when the page is past the end; that is simply "no more".
    if (e instanceof WordPressError && e.wpCode === 'rest_post_invalid_page_number') {
      return { items: [], pagination: { total: 0, totalPages: Math.max(page - 1, 0) } };
    }
    throw e;
  }
}

/** Count via X-WP-Total of a one-item page; null when the site hides the header. */
export async function countPosts(
  client: WordPressClient,
  status: PostStatus,
  signal?: AbortSignal,
): Promise<number | null> {
  const res = await client.get<unknown[]>('/wp/v2/posts', {
    query: { context: 'edit', status, per_page: 1, _fields: 'id' },
    signal,
  });
  return res.pagination ? res.pagination.total : null;
}

/** Normal delete: moves to trash (force=false). Permanent deletion is out of scope. */
export async function trashPost(client: WordPressClient, id: number): Promise<void> {
  await client.delete(`/wp/v2/posts/${id}`, { query: { force: false } });
}

/** Restores as a draft (never publishes by accident). Only `status` is sent. */
export async function restorePost(client: WordPressClient, id: number): Promise<void> {
  await client.post(`/wp/v2/posts/${id}`, { body: { status: 'draft' } });
}

export async function listTerms(
  client: WordPressClient,
  taxonomy: 'categories' | 'tags',
  page: number,
  search: string,
  signal?: AbortSignal,
): Promise<Page<WpTerm>> {
  const res = await client.get<WpTerm[]>(`/wp/v2/${taxonomy}`, {
    query: {
      page,
      per_page: 100,
      search: search.trim() || undefined,
      orderby: 'name',
      order: 'asc',
      _fields: 'id,name,slug,parent,count',
    },
    signal,
  });
  return {
    items: res.data,
    pagination: res.pagination ?? { total: res.data.length, totalPages: 1 },
  };
}

/** Parents before children, children indented by depth; orphans (parent not loaded) at depth 0. */
export function orderTermsHierarchically(terms: WpTerm[]): Array<{ term: WpTerm; depth: number }> {
  const ids = new Set(terms.map((t) => t.id));
  const children = new Map<number, WpTerm[]>();
  for (const t of terms) {
    const key = t.parent !== 0 && ids.has(t.parent) ? t.parent : 0;
    const list = children.get(key) ?? [];
    list.push(t);
    children.set(key, list);
  }
  const out: Array<{ term: WpTerm; depth: number }> = [];
  const seen = new Set<number>();
  const walk = (parent: number, depth: number) => {
    for (const t of children.get(parent) ?? []) {
      if (seen.has(t.id)) continue; // guards against cyclic data
      seen.add(t.id);
      out.push({ term: t, depth });
      walk(t.id, depth + 1);
    }
  };
  walk(0, 0);
  return out;
}

const NAMED: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—',
  hellip: '…', laquo: '«', raquo: '»', rlm: '\u200f', lrm: '\u200e', zwnj: '\u200c',
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e.startsWith('#')) {
      const cp = /^#x/i.test(e) ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(cp) && cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : m;
    }
    return NAMED[e.toLowerCase()] ?? m;
  });
}

export function plainText(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();
}

export function postTitle(p: Pick<WpPost, 'title'>): string {
  const raw = p.title?.raw?.trim();
  const t = raw ? raw : plainText(p.title?.rendered ?? '');
  return t || '(بدون عنوان)';
}

export function postAuthorName(p: WpPost): string | null {
  return p._embedded?.author?.[0]?.name ?? null;
}

export function featuredImageUrl(p: WpPost): string | null {
  const m = p._embedded?.['wp:featuredmedia']?.[0];
  if (!m) return null;
  const sizes = m.media_details?.sizes;
  return sizes?.medium?.source_url ?? sizes?.thumbnail?.source_url ?? m.source_url ?? null;
}

export function isSafeWebUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}
