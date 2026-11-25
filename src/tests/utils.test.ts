import { base64EncodeUtf8 } from '../utils/base64';
import { redactSecrets } from '../utils/redact';
import { singleFlight } from '../utils/singleFlight';

describe('base64EncodeUtf8', () => {
  it('matches Buffer for ASCII, Persian and emoji', () => {
    for (const s of ['a', 'ab', 'abc', 'user:pass word', 'کاربر:رمز', 'x😀y', '']) {
      expect(base64EncodeUtf8(s)).toBe(Buffer.from(s, 'utf8').toString('base64'));
    }
  });
});

describe('redactSecrets', () => {
  it('masks auth headers and password fields', () => {
    const out = redactSecrets('Authorization: Basic dXNlcjpwYXNzd29yZA== appPassword="abcd efgh"');
    expect(out).not.toContain('dXNlcjpw');
    expect(out).not.toContain('abcd');
    expect(out).toContain('[REDACTED]');
  });
  it('leaves harmless text alone', () => {
    expect(redactSecrets('GET /wp/v2/posts 200')).toBe('GET /wp/v2/posts 200');
  });
});

describe('singleFlight', () => {
  it('runs once for repeated calls while pending, then allows a new run', async () => {
    let runs = 0;
    let release: () => void = () => undefined;
    const action = singleFlight(
      () =>
        new Promise<number>((resolve) => {
          runs++;
          release = () => resolve(runs);
        }),
    );
    const p1 = action();
    const p2 = action();
    const p3 = action();
    expect(action.isPending()).toBe(true);
    release();
    await Promise.all([p1, p2, p3]);
    expect(runs).toBe(1);
    expect(action.isPending()).toBe(false);
    const p4 = action();
    release();
    await p4;
    expect(runs).toBe(2);
  });
  it('resets after a failure so the user can retry', async () => {
    let n = 0;
    const action = singleFlight(async () => {
      n++;
      if (n === 1) throw new Error('boom');
      return n;
    });
    let failed = false;
    try {
      await action();
    } catch {
      failed = true;
    }
    expect(failed).toBe(true);
    expect(await action()).toBe(2);
  });
});
