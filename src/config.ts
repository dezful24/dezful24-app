/** Plain http is allowed only in development and only when explicitly enabled. */
export const ALLOW_INSECURE_HTTP: boolean =
  typeof __DEV__ !== 'undefined' &&
  __DEV__ &&
  process.env.EXPO_PUBLIC_ALLOW_INSECURE_HTTP === 'true';

export const REQUEST_TIMEOUT_MS: number =
  Number(process.env.EXPO_PUBLIC_REQUEST_TIMEOUT_MS) > 0
    ? Number(process.env.EXPO_PUBLIC_REQUEST_TIMEOUT_MS)
    : 20000;
