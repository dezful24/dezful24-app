/** Masks credentials in any text before it can reach a log or error report. */
export function redactSecrets(input: string): string {
  return input
    .replace(/\b(Basic|Bearer)\s+[A-Za-z0-9+/=._-]{8,}/g, '$1 [REDACTED]')
    .replace(
      /((?:app[_-]?password|password|passwd|pwd)["']?\s*[:=]\s*["']?)[^\s"',}&]+/gi,
      '$1[REDACTED]',
    );
}
