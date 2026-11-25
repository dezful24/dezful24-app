import { validateConnectFields } from '../features/auth/validation';

const ok = { siteUrl: 'example.com', username: 'editor', appPassword: 'abcd efgh ijkl mnop' };

describe('connect form validation', () => {
  it('accepts valid input', () => {
    expect(validateConnectFields(ok)).toEqual({});
  });
  it('reports each missing field in Persian', () => {
    const e = validateConnectFields({ siteUrl: '', username: ' ', appPassword: '' });
    expect(e.siteUrl).toBeTruthy();
    expect(e.username).toBeTruthy();
    expect(e.appPassword).toBeTruthy();
  });
  it('flags http and short (likely main) passwords', () => {
    expect(validateConnectFields({ ...ok, siteUrl: 'http://example.com' }).siteUrl).toBeTruthy();
    expect(validateConnectFields({ ...ok, appPassword: 'pass1234' }).appPassword).toContain('رمز اصلی');
  });
  it('allows http only in dev mode', () => {
    expect(
      validateConnectFields({ ...ok, siteUrl: 'http://localhost:8080' }, { allowInsecureHttp: true }),
    ).toEqual({});
  });
  it('validates the optional API base', () => {
    expect(validateConnectFields({ ...ok, apiBaseOverride: 'ht!tp:/x' }).apiBaseOverride).toBeTruthy();
    expect(validateConnectFields({ ...ok, apiBaseOverride: '' })).toEqual({});
  });
});
