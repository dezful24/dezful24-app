import { WordPressClient } from '../services/wordpress/client';
import {
  DEFAULT_FILTERS,
  buildPostsQuery,
  countPosts,
  decodeEntities,
  featuredImageUrl,
  listPosts,
  listTerms,
  orderTermsHierarchically,
  postTitle,
  restorePost,
  statusesFor,
  trashPost,
  type WpPost,
  type WpTerm,
} from '../services/wordpress/posts';
import { createMockFetch, noSleep } from './helpers/mockFetch';

const client = (m: ReturnType<typeof createMockFetch>) =>
  new WordPressClient({
    siteId: 's',
    apiBase: 'https://example.com/wp-json/',
    username: 'u',
    appPassword: 'abcdefghijklmnop',
    fetchImpl: m.fetch,
    sleep: noSleep,
  });

describe('status filters', () => {
  it('"all" excludes trash and includes private only with the capability', () => {
    expect(statusesFor('all', {})).toEqual(['publish', 'draft', 'pending', 'future']);
    expect(statusesFor('all', { read_private_posts: true })).toContain('private');
    expect(statusesFor('trash', {})).toEqual(['trash']);
  });
});

describe('buildPostsQuery', () => {
  it('uses edit context, embeds, trims search and omits empty filters', () => {
    const q = buildPostsQuery({ ...DEFAULT_FILTERS, search: '  دزفول  ' }, 2, 20, {});
    expect(q.context).toBe('edit');
    expect(q.page).toBe(2);
    expect(q.per_page).toBe(20);
    expect(q.search).toBe('دزفول');
    expect(q.categories).toBeUndefined();
    expect(q._embed).toBe('author,wp:featuredmedia');
    expect(buildPostsQuery({ ...DEFAULT_FILTERS, search: '   ' }, 1, 20, {}).search).toBeUndefined();
  });
  it('maps category and sort order', () => {
    const q = buildPostsQuery({ ...DEFAULT_FILTERS, categoryId: 7, orderBy: 'modified' }, 1, 10, {});
    expect(q.categories).toBe(7);
    expect(q.orderby).toBe('modified');
  });
});

describe('listPosts', () => {
  it('returns items and pagination headers', async () => {
    const m = createMockFetch([{ body: [{ id: 1 }], headers: { 'X-WP-Total': '41', 'X-WP-TotalPages': '3' } }]);
    const page = await listPosts(client(m), DEFAULT_FILTERS, 1, 20, {});
    expect(page.items.length).toBe(1);
    expect(page.pagination).toEqual({ total: 41, totalPages: 3 });
    expect(m.calls[0]?.url).toContain('/wp/v2/posts?context=edit&page=1&per_page=20');
  });
  it('treats an out-of-range page as an empty last page', async () => {
    const m = createMockFetch([{ status: 400, body: { code: 'rest_post_invalid_page_number', message: 'x' } }]);
    const page = await listPosts(client(m), DEFAULT_FILTERS, 4, 20, {});
    expect(page.items).toEqual([]);
    expect(page.pagination.totalPages).toBe(3);
  });
});

describe('countPosts', () => {
  it('reads X-WP-Total from a one-item request', async () => {
    const m = createMockFetch([{ body: [], headers: { 'X-WP-Total': '12', 'X-WP-TotalPages': '12' } }]);
    expect(await countPosts(client(m), 'draft')).toBe(12);
    expect(m.calls[0]?.url).toContain('per_page=1');
  });
});

describe('trash / restore', () => {
  it('trash uses DELETE with force=false (never permanent)', async () => {
    const m = createMockFetch([{ body: { id: 5 } }]);
    await trashPost(client(m), 5);
    expect(m.calls[0]?.method).toBe('DELETE');
    expect(m.calls[0]?.url).toBe('https://example.com/wp-json/wp/v2/posts/5?force=false');
  });
  it('restore sends only status=draft', async () => {
    const m = createMockFetch([{ body: { id: 5 } }]);
    await restorePost(client(m), 5);
    expect(m.calls[0]?.method).toBe('POST');
    expect(m.calls[0]?.body).toBe(JSON.stringify({ status: 'draft' }));
  });
});

describe('terms', () => {
  const t = (id: number, parent: number, name = `c${id}`): WpTerm => ({ id, name, slug: name, parent, count: 0 });
  it('orders hierarchically with depth', () => {
    const out = orderTermsHierarchically([t(3, 2), t(1, 0), t(2, 1), t(4, 0)]);
    expect(out.map((o) => [o.term.id, o.depth])).toEqual([[1, 0], [2, 1], [3, 2], [4, 0]]);
  });
  it('keeps orphans visible and survives cycles', () => {
    expect(orderTermsHierarchically([t(5, 99)]).map((o) => o.depth)).toEqual([0]);
    expect(orderTermsHierarchically([t(1, 2), t(2, 1)]).length).toBe(0);
  });
  it('listTerms requests 100 per page and supports search', async () => {
    const m = createMockFetch([{ body: [], headers: { 'X-WP-Total': '250', 'X-WP-TotalPages': '3' } }]);
    const p = await listTerms(client(m), 'categories', 2, 'اخبار');
    expect(p.pagination.totalPages).toBe(3);
    expect(m.calls[0]?.url).toContain('per_page=100');
    expect(m.calls[0]?.url).toContain('page=2');
  });
});

describe('display helpers', () => {
  it('decodes numeric and named entities', () => {
    expect(decodeEntities('a &#8211; b &amp; c &#x41;')).toBe('a – b & c A');
    expect(decodeEntities('&unknown; &#99999999;')).toBe('&unknown; &#99999999;');
  });
  it('prefers raw title, falls back to stripped rendered, then placeholder', () => {
    expect(postTitle({ title: { raw: ' سلام ', rendered: 'x' } })).toBe('سلام');
    expect(postTitle({ title: { rendered: '<b>اخبار</b> &#8211; امروز' } })).toBe('اخبار – امروز');
    expect(postTitle({ title: { rendered: '' } })).toBe('(بدون عنوان)');
  });
  it('picks a medium thumbnail when embedded', () => {
    const p = {
      _embedded: { 'wp:featuredmedia': [{ source_url: 'full.jpg', media_details: { sizes: { medium: { source_url: 'm.jpg' } } } }] },
    } as unknown as WpPost;
    expect(featuredImageUrl(p)).toBe('m.jpg');
    expect(featuredImageUrl({} as WpPost)).toBeNull();
  });
});
