import { connectToSite } from '../services/wordpress/connect';
import type { WordPressError } from '../services/wordpress/errors';
import { UrlError } from '../services/wordpress/url';
import { createMockFetch, expectReject, type MockSpec } from './helpers/mockFetch';

const root = {
  name: 'دزفول ۲۴',
  description: 'اخبار',
  url: 'https://example.com',
  home: 'https://example.com',
  gmt_offset: 3.5,
  timezone_string: 'Asia/Tehran',
  namespaces: ['oembed/1.0', 'wp/v2'],
};
const me = {
  id: 5,
  name: 'سردبیر',
  slug: 'editor',
  roles: ['editor'],
  capabilities: { edit_posts: true, publish_posts: true, read: true, switch_themes: false },
};

describe('connectToSite', () => {
  it('connects, discovers the API and builds a minimal session', async () => {
    const m = createMockFetch((c): MockSpec =>
      c.url === 'https://example.com/wp-json/' ? { body: root } : { body: me },
    );
    const r = await connectToSite(
      { siteUrl: 'example.com/wp-admin', username: ' editor ', appPassword: 'abcd efgh ijkl mnop' },
      { fetchImpl: m.fetch, now: () => new Date('2026-01-01T00:00:00Z') },
    );
    expect(r.session.siteUrl).toBe('https://example.com');
    expect(r.session.username).toBe('editor');
    expect(r.session.site.timezoneString).toBe('Asia/Tehran');
    expect(r.session.user.capabilities).toEqual({ edit_posts: true, publish_posts: true });
    expect(r.appPassword).toBe('abcdefghijklmnop');
    expect(m.calls[1]?.url).toBe('https://example.com/wp-json/wp/v2/users/me?context=edit');
    // discovery request must be anonymous
    expect(m.calls[0]?.headers.Authorization).toBeUndefined();
    expect(m.calls[1]?.headers.Authorization).toBeTruthy();
    // password must not be in the persisted profile
    expect(JSON.stringify(r.session)).not.toContain('abcdefgh');
  });

  it('falls back to ?rest_route= when /wp-json/ is not routed', async () => {
    const m = createMockFetch((c): MockSpec => {
      if (c.url.includes('rest_route=/wp/v2/users/me')) return { body: me };
      if (c.url === 'https://example.com/?rest_route=/') return { body: root };
      return { status: 404, body: '<html>nope</html>' };
    });
    const r = await connectToSite(
      { siteUrl: 'https://example.com', username: 'editor', appPassword: 'abcdefghijklmnop' },
      { fetchImpl: m.fetch },
    );
    expect(r.session.apiBase).toBe('https://example.com/?rest_route=/');
    expect(m.calls[m.calls.length - 1]?.url).toBe(
      'https://example.com/?rest_route=/wp/v2/users/me&context=edit',
    );
  });

  it('supports sub-directory installs', async () => {
    const m = createMockFetch((c): MockSpec =>
      c.url === 'https://example.com/blog/wp-json/' ? { body: root } : { body: me },
    );
    const r = await connectToSite(
      { siteUrl: 'https://example.com/blog/', username: 'e', appPassword: 'abcdefghijklmnop' },
      { fetchImpl: m.fetch },
    );
    expect(r.session.siteId).toBe('example.com/blog');
    expect(r.session.apiBase).toBe('https://example.com/blog/wp-json/');
  });

  it('rejects a site whose API lacks wp/v2', async () => {
    const m = createMockFetch([{ body: { ...root, namespaces: ['oembed/1.0'] } }]);
    const err = (await expectReject(
      connectToSite(
        { siteUrl: 'https://example.com', username: 'e', appPassword: 'abcdefghijklmnop' },
        { fetchImpl: m.fetch },
      ),
    )) as WordPressError;
    expect(err.kind).toBe('rest_unavailable');
  });

  it('reports wrong credentials as auth error', async () => {
    const m = createMockFetch((c): MockSpec =>
      c.url === 'https://example.com/wp-json/'
        ? { body: root }
        : { status: 401, body: { code: 'incorrect_password', message: 'x' } },
    );
    const err = (await expectReject(
      connectToSite(
        { siteUrl: 'https://example.com', username: 'e', appPassword: 'abcdefghijklmnop' },
        { fetchImpl: m.fetch },
      ),
    )) as WordPressError;
    expect(err.kind).toBe('auth');
  });

  it('rejects users who cannot edit posts', async () => {
    const m = createMockFetch((c): MockSpec =>
      c.url === 'https://example.com/wp-json/'
        ? { body: root }
        : { body: { ...me, roles: ['subscriber'], capabilities: { read: true, edit_posts: false } } },
    );
    const err = (await expectReject(
      connectToSite(
        { siteUrl: 'https://example.com', username: 'e', appPassword: 'abcdefghijklmnop' },
        { fetchImpl: m.fetch },
      ),
    )) as WordPressError;
    expect(err.kind).toBe('forbidden');
  });

  it('stops (does not send credentials) when the site redirects to another domain', async () => {
    const m = createMockFetch([
      { status: 301, headers: { Location: 'https://www.example.com/wp-json/' } },
    ]);
    const err = (await expectReject(
      connectToSite(
        { siteUrl: 'https://example.com', username: 'e', appPassword: 'abcdefghijklmnop' },
        { fetchImpl: m.fetch },
      ),
    )) as WordPressError;
    expect(err.kind).toBe('redirect');
    expect((err.details as { location: string }).location).toBe('https://www.example.com/wp-json/');
    expect(m.calls.length).toBe(1);
    expect(m.calls[0]?.headers.Authorization).toBeUndefined();
  });

  it('rejects http site URLs before any network call', async () => {
    const m = createMockFetch([{ body: root }]);
    const err = await expectReject(
      connectToSite(
        { siteUrl: 'http://example.com', username: 'e', appPassword: 'abcdefghijklmnop' },
        { fetchImpl: m.fetch },
      ),
    );
    expect(err instanceof UrlError).toBe(true);
    expect(m.calls.length).toBe(0);
  });

  it('requires the API base override to stay on the site origin', async () => {
    const m = createMockFetch([{ body: root }]);
    const err = await expectReject(
      connectToSite(
        {
          siteUrl: 'https://example.com',
          username: 'e',
          appPassword: 'abcdefghijklmnop',
          apiBaseOverride: 'https://other.com/wp-json/',
        },
        { fetchImpl: m.fetch },
      ),
    );
    expect(err instanceof UrlError).toBe(true);
    expect(m.calls.length).toBe(0);
  });
});
