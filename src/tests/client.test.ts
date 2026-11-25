import { WordPressClient } from '../services/wordpress/client';
import { WordPressError } from '../services/wordpress/errors';
import { createMockFetch, expectReject, noSleep } from './helpers/mockFetch';

const BASE = 'https://example.com/wp-json/';

function make(fetchImpl: typeof fetch, extra: Partial<ConstructorParameters<typeof WordPressClient>[0]> = {}) {
  return new WordPressClient({
    siteId: 'example.com',
    apiBase: BASE,
    username: 'editor',
    appPassword: 'abcd efgh ijkl',
    fetchImpl,
    sleep: noSleep,
    ...extra,
  });
}

describe('WordPressClient', () => {
  it('sends Basic auth with UTF-8 safe base64 and no cookies', async () => {
    const m = createMockFetch([{ body: { ok: true } }]);
    await make(m.fetch, { username: 'کاربر', appPassword: 'pw123456789012' }).get('/wp/v2/users/me');
    const expected = `Basic ${Buffer.from('کاربر:pw123456789012', 'utf8').toString('base64')}`;
    expect(m.calls[0]?.headers.Authorization).toBe(expected);
  });

  it('builds URLs relative to the API base incl. sub-directory', async () => {
    const m = createMockFetch([{ body: [] }]);
    await make(m.fetch, { apiBase: 'https://example.com/blog/wp-json/' }).get('/wp/v2/posts', {
      query: { per_page: 20, status: ['draft', 'publish'] as string[] },
    });
    expect(m.calls[0]?.url).toBe(
      'https://example.com/blog/wp-json/wp/v2/posts?per_page=20&status=draft%2Cpublish',
    );
  });

  it('reads pagination headers', async () => {
    const m = createMockFetch([
      { body: [], headers: { 'X-WP-Total': '45', 'X-WP-TotalPages': '3' } },
    ]);
    const res = await make(m.fetch).get('/wp/v2/posts');
    expect(res.pagination).toEqual({ total: 45, totalPages: 3 });
  });

  it('serialises JSON bodies with a content type', async () => {
    const m = createMockFetch([{ status: 201, body: { id: 1 } }]);
    await make(m.fetch).post('/wp/v2/posts', { body: { title: 'سلام', status: 'draft' } });
    expect(m.calls[0]?.headers['Content-Type']).toContain('application/json');
    expect(m.calls[0]?.body).toBe(JSON.stringify({ title: 'سلام', status: 'draft' }));
  });

  it('refuses plain http API bases unless explicitly allowed', () => {
    let err: unknown;
    try {
      make(createMockFetch([{}]).fetch, { apiBase: 'http://example.com/wp-json/' });
    } catch (e) {
      err = e;
    }
    expect((err as WordPressError).kind).toBe('insecure');
    expect(
      make(createMockFetch([{}]).fetch, {
        apiBase: 'http://localhost:8080/wp-json/',
        allowInsecureHttp: true,
      }),
    ).toBeTruthy();
  });

  it('never leaks the password through JSON.stringify', () => {
    const c = make(createMockFetch([{}]).fetch, { appPassword: 'SUPERSECRETVALUE123' });
    expect(JSON.stringify(c)).not.toContain('SUPERSECRET');
    expect(JSON.stringify(c)).not.toContain('Basic');
  });

  describe('redirect safety', () => {
    it('does not follow a cross-origin redirect and sends nothing to the other origin', async () => {
      const m = createMockFetch([
        { status: 302, headers: { Location: 'https://evil.example.net/steal' } },
        { body: { leaked: true } },
      ]);
      const err = (await expectReject(make(m.fetch).get('/wp/v2/users/me'))) as WordPressError;
      expect(err.kind).toBe('redirect');
      expect(m.calls.length).toBe(1);
    });

    it('follows same-origin redirects and keeps auth on them', async () => {
      const m = createMockFetch([
        { status: 301, headers: { Location: '/wp-json/wp/v2/users/me/' } },
        { body: { id: 1 } },
      ]);
      const res = await make(m.fetch).get<{ id: number }>('/wp/v2/users/me');
      expect(res.data.id).toBe(1);
      expect(m.calls.length).toBe(2);
      expect(m.calls[1]?.headers.Authorization).toBeTruthy();
    });

    it('detects a redirect the platform already followed to another origin', async () => {
      const m = createMockFetch([{ body: {}, finalUrl: 'https://other.example.org/x' }]);
      const err = (await expectReject(make(m.fetch).get('/wp/v2/users/me'))) as WordPressError;
      expect(err.kind).toBe('redirect');
    });

    it('does not replay a POST across 301/302', async () => {
      const m = createMockFetch([{ status: 302, headers: { Location: '/elsewhere' } }, { body: {} }]);
      const err = (await expectReject(make(m.fetch).post('/wp/v2/posts', { body: {} }))) as WordPressError;
      expect(err.kind).toBe('redirect');
      expect(m.calls.length).toBe(1);
    });
  });

  describe('retry policy', () => {
    it('retries GET on transient failures', async () => {
      const m = createMockFetch([{ status: 503, body: '' }, { networkError: true }, { body: [1] }]);
      const res = await make(m.fetch).get('/wp/v2/posts');
      expect(res.data).toEqual([1]);
      expect(m.calls.length).toBe(3);
    });

    it('never retries POST (no duplicate posts/uploads)', async () => {
      const m = createMockFetch([{ status: 503, body: '' }, { status: 201, body: { id: 9 } }]);
      const err = (await expectReject(make(m.fetch).post('/wp/v2/posts', { body: {} }))) as WordPressError;
      expect(err.kind).toBe('server');
      expect(m.calls.length).toBe(1);
    });

    it('never retries POST after a network error', async () => {
      const m = createMockFetch([{ networkError: true }, { body: {} }]);
      await expectReject(make(m.fetch).post('/wp/v2/media', { body: {} }));
      expect(m.calls.length).toBe(1);
    });

    it('does not retry auth errors', async () => {
      const m = createMockFetch([{ status: 401, body: { code: 'rest_not_logged_in' } }]);
      const err = (await expectReject(make(m.fetch).get('/wp/v2/users/me'))) as WordPressError;
      expect(err.kind).toBe('auth');
      expect(m.calls.length).toBe(1);
    });

    it('gives up after maxRetries', async () => {
      const m = createMockFetch([{ status: 503, body: '' }]);
      await expectReject(make(m.fetch, { maxRetries: 1 }).get('/wp/v2/posts'));
      expect(m.calls.length).toBe(2);
    });
  });

  describe('timeouts and cancellation', () => {
    it('times out hanging requests', async () => {
      const m = createMockFetch([{ hang: true }]);
      const err = (await expectReject(
        make(m.fetch, { timeoutMs: 20, maxRetries: 0 }).get('/wp/v2/posts'),
      )) as WordPressError;
      expect(err.kind).toBe('timeout');
    });

    it('supports caller cancellation', async () => {
      const m = createMockFetch([{ hang: true }]);
      const ctrl = new AbortController();
      const p = make(m.fetch, { timeoutMs: 5000 }).get('/wp/v2/posts', { signal: ctrl.signal });
      setTimeout(() => ctrl.abort(), 10);
      expect(((await expectReject(p)) as WordPressError).kind).toBe('cancelled');
    });
  });

  it('reports non-JSON success bodies as invalid_response', async () => {
    const m = createMockFetch([{ body: '<html>Maintenance</html>' }]);
    const err = (await expectReject(make(m.fetch).get('/wp/v2/posts', { retry: false }))) as WordPressError;
    expect(err.kind).toBe('invalid_response');
  });
});
