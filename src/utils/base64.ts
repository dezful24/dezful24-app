const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function utf8Bytes(str: string): number[] {
  const out: number[] = [];
  for (const ch of str) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp < 0x80) out.push(cp);
    else if (cp < 0x800) out.push(0xc0 | (cp >> 6), 0x80 | (cp & 63));
    else if (cp < 0x10000)
      out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
    else
      out.push(
        0xf0 | (cp >> 18),
        0x80 | ((cp >> 12) & 63),
        0x80 | ((cp >> 6) & 63),
        0x80 | (cp & 63),
      );
  }
  return out;
}

/** Base64 of the UTF-8 bytes of `str` (safe for non-ASCII usernames). */
export function base64EncodeUtf8(str: string): string {
  const b = utf8Bytes(str);
  let r = '';
  for (let i = 0; i < b.length; i += 3) {
    const b0 = b[i] ?? 0;
    const b1 = b[i + 1] ?? 0;
    const b2 = b[i + 2] ?? 0;
    const n = (b0 << 16) | (b1 << 8) | b2;
    r += CHARS[(n >> 18) & 63];
    r += CHARS[(n >> 12) & 63];
    r += i + 1 < b.length ? CHARS[(n >> 6) & 63] : '=';
    r += i + 2 < b.length ? CHARS[n & 63] : '=';
  }
  return r;
}
