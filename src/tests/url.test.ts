import {
  UrlError,
  apiBaseCandidates,
  buildQueryString,
  joinApiUrl,
  normalizeApiBase,
  normalizeSiteUrl,
  resolveUrl,
  sameOrigin,
  siteIdFromUrl,
  storageKeyForSite,
} from '../services/wordpress/url';

function code(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (e) {
    return e instanceof UrlError ? e.code : 'other';
  }
  return undefined;
}

describe('normalizeSiteUrl', () => {
  it('adds https and strips trailing slash', () => {
    expect(normalizeSiteUrl('example.com/')).toBe('https://example.com');
  });
  it('lowercases host but preserves path case (sub-directory install)', () => {
    expect(normalizeSiteUrl('https://Example.COM/Blog/')).toBe('https://example.com/Blog');
  });
  it('strips admin / api / login paths but keeps the sub-directory', () => {
    expect(normalizeSiteUrl('example.com/blog/wp-admin/edit.php')).toBe('https://example.com/blog');
    expect(normalizeSiteUrl('https://example.com/blog/wp-json/wp/v2/posts')).toBe(
      'https://example.com/blog',
    );
    expect(normalizeSiteUrl('https://example.com/wp-login.php')).toBe('https://example.com');
  });
  it('does not strip look-alike directory names', () => {
    expect(normalizeSiteUrl('https://example.com/wp-content-news')).toBe(
      'https://example.com/wp-content-news',
    );
  });
  it('drops query and hash, removes default port, keeps custom port', () => {
    expect(normalizeSiteUrl('https://example.com:443/?a=1#x')).toBe('https://example.com');
    expect(normalizeSiteUrl('https://example.com:8443/blog')).toBe('https://example.com:8443/blog');
  });
  it('rejects empty, spaces, other schemes and credentials', () => {
    expect(code(() => normalizeSiteUrl('  '))).toBe('empty');
    expect(code(() => normalizeSiteUrl('exa mple.com'))).toBe('invalid');
    expect(code(() => normalizeSiteUrl('ftp://example.com'))).toBe('unsupported_scheme');
    expect(code(() => normalizeSiteUrl('https://user:pass@example.com'))).toBe('invalid');
  });
  it('requires https unless explicitly allowed for development', () => {
    expect(code(() => normalizeSiteUrl('http://example.com'))).toBe('insecure');
    expect(normalizeSiteUrl('http://localhost:8080', { allowInsecureHttp: true })).toBe(
      'http://localhost:8080',
    );
  });
});

describe('normalizeApiBase', () => {
  it('adds a trailing slash', () => {
    expect(normalizeApiBase('https://example.com/blog/wp-json')).toBe(
      'https://example.com/blog/wp-json/',
    );
  });
  it('keeps rest_route style', () => {
    expect(normalizeApiBase('https://example.com/?rest_route=/wp/v2')).toBe(
      'https://example.com/?rest_route=/',
    );
  });
});

describe('joinApiUrl', () => {
  it('works for root and sub-directory installs', () => {
    expect(joinApiUrl('https://example.com/wp-json/', '/wp/v2/posts')).toBe(
      'https://example.com/wp-json/wp/v2/posts',
    );
    expect(joinApiUrl('https://example.com/blog/wp-json/', 'wp/v2/posts', { per_page: 10 })).toBe(
      'https://example.com/blog/wp-json/wp/v2/posts?per_page=10',
    );
  });
  it('supports ?rest_route= bases using & for extra params', () => {
    expect(joinApiUrl('https://example.com/?rest_route=/', '/wp/v2/users/me', { context: 'edit' })).toBe(
      'https://example.com/?rest_route=/wp/v2/users/me&context=edit',
    );
  });
  it('candidates cover pretty, index.php and rest_route forms', () => {
    expect(apiBaseCandidates('https://example.com/blog')).toEqual([
      'https://example.com/blog/wp-json/',
      'https://example.com/blog/index.php/wp-json/',
      'https://example.com/blog/?rest_route=/',
    ]);
  });
});

describe('buildQueryString', () => {
  it('skips null/undefined/empty arrays, joins arrays, stringifies booleans', () => {
    expect(
      buildQueryString({ a: undefined, b: null, c: [], d: [1, 2, 3], e: true, f: 0 }),
    ).toBe('d=1%2C2%2C3&e=true&f=0');
  });
  it('encodes Persian text and reserved characters', () => {
    expect(buildQueryString({ search: 'دزفول & اخبار' })).toBe(
      `search=${encodeURIComponent('دزفول & اخبار')}`,
    );
    expect(buildQueryString(undefined)).toBe('');
  });
});

describe('origins and redirects', () => {
  it('sameOrigin compares scheme, host and port', () => {
    expect(sameOrigin('https://a.com/x', 'https://a.com/y')).toBe(true);
    expect(sameOrigin('https://a.com', 'https://www.a.com')).toBe(false);
    expect(sameOrigin('https://a.com', 'http://a.com')).toBe(false);
    expect(sameOrigin('https://a.com:444', 'https://a.com')).toBe(false);
  });
  it('resolveUrl handles absolute, root-relative and relative locations', () => {
    expect(resolveUrl('https://a.com/blog/wp-json/', 'https://b.com/x')).toBe('https://b.com/x');
    expect(resolveUrl('https://a.com/blog/wp-json/', '/other')).toBe('https://a.com/other');
    expect(resolveUrl('https://a.com/blog/wp-json/', 'x')).toBe('https://a.com/blog/wp-json/x');
  });
});

describe('site ids', () => {
  it('derives stable ids and safe storage keys', () => {
    expect(siteIdFromUrl('https://Example.com/blog')).toBe('example.com/blog');
    const key = storageKeyForSite('example.com:8443/blog');
    expect(/^[A-Za-z0-9._-]+$/.test(key)).toBe(true);
    expect(storageKeyForSite('a.com/x') === storageKeyForSite('a.com_x')).toBe(false);
  });
});
