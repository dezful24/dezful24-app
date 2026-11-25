import { mapHttpError, toWordPressError } from '../services/wordpress/errors';

const json = (o: unknown) => JSON.stringify(o);

describe('mapHttpError', () => {
  it('maps 401 and WP auth codes to auth', () => {
    expect(mapHttpError(401, json({ code: 'rest_not_logged_in' })).kind).toBe('auth');
    expect(mapHttpError(200, json({ code: 'incorrect_password' })).kind).toBe('auth');
  });
  it('403 JSON is forbidden, 403 HTML is a blocked request', () => {
    expect(mapHttpError(403, json({ code: 'rest_forbidden' })).kind).toBe('forbidden');
    expect(mapHttpError(403, '<html>Access denied</html>').kind).toBe('blocked');
    expect(mapHttpError(406, '').kind).toBe('blocked');
  });
  it('detects disabled REST API', () => {
    expect(mapHttpError(404, json({ code: 'rest_no_route' })).kind).toBe('rest_unavailable');
    expect(mapHttpError(404, '<html>Not found</html>').kind).toBe('rest_unavailable');
    expect(mapHttpError(401, json({ code: 'rest_disabled' })).kind).toBe('auth');
    expect(mapHttpError(200, json({ code: 'rest_disabled' })).kind).toBe('blocked');
  });
  it('404 JSON for a missing item is not_found', () => {
    expect(mapHttpError(404, json({ code: 'rest_post_invalid_id' })).kind).toBe('not_found');
  });
  it('validation errors include the field names', () => {
    const e = mapHttpError(
      400,
      json({ code: 'rest_invalid_param', message: 'Invalid parameter(s): slug', data: { params: { slug: 'x' } } }),
    );
    expect(e.kind).toBe('validation');
    expect(e.message).toContain('slug');
  });
  it('keeps term_exists code for later duplicate handling', () => {
    expect(mapHttpError(400, json({ code: 'term_exists', data: { term_id: 7 } })).wpCode).toBe(
      'term_exists',
    );
  });
  it('only transient server statuses are retryable', () => {
    expect(mapHttpError(503, '').retryable).toBe(true);
    expect(mapHttpError(429, '').retryable).toBe(true);
    expect(mapHttpError(500, '').retryable).toBe(false);
    expect(mapHttpError(401, '').retryable).toBe(false);
  });
  it('toWordPressError maps flags', () => {
    expect(toWordPressError(new Error('x'), { timedOut: true }).kind).toBe('timeout');
    expect(toWordPressError(new Error('x'), { cancelled: true }).kind).toBe('cancelled');
    expect(toWordPressError(new TypeError('Network request failed')).kind).toBe('network');
  });
});
