import { normalizeAppPassword } from '../../services/wordpress/connect';
import { UrlError, normalizeApiBase, normalizeSiteUrl } from '../../services/wordpress/url';

export interface ConnectFormValues {
  siteUrl: string;
  username: string;
  appPassword: string;
  apiBaseOverride?: string;
}

export type ConnectFieldErrors = Partial<Record<keyof ConnectFormValues, string>>;

export const MIN_APP_PASSWORD_LENGTH = 12;

/** Pure validation shared by the form (via zod) and by tests. */
export function validateConnectFields(
  v: ConnectFormValues,
  opts: { allowInsecureHttp?: boolean } = {},
): ConnectFieldErrors {
  const errors: ConnectFieldErrors = {};
  try {
    normalizeSiteUrl(v.siteUrl, opts);
  } catch (e) {
    errors.siteUrl = e instanceof UrlError ? e.message : 'آدرس سایت معتبر نیست.';
  }
  if (!v.username.trim()) errors.username = 'نام کاربری وردپرس را وارد کنید.';
  const pw = normalizeAppPassword(v.appPassword);
  if (!pw) errors.appPassword = 'Application Password را وارد کنید.';
  else if (pw.length < MIN_APP_PASSWORD_LENGTH) {
    errors.appPassword =
      'این مقدار کوتاه‌تر از یک Application Password معمول است. رمز اصلی حساب را وارد نکنید.';
  }
  if (v.apiBaseOverride?.trim()) {
    try {
      normalizeApiBase(v.apiBaseOverride, opts);
    } catch (e) {
      errors.apiBaseOverride = e instanceof UrlError ? e.message : 'آدرس API معتبر نیست.';
    }
  }
  return errors;
}
