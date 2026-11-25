export type WordPressErrorKind =
  | 'network'
  | 'timeout'
  | 'cancelled'
  | 'auth'
  | 'forbidden'
  | 'not_found'
  | 'rest_unavailable'
  | 'blocked'
  | 'validation'
  | 'server'
  | 'redirect'
  | 'invalid_response'
  | 'insecure'
  | 'unknown';

export interface WordPressErrorInit {
  kind: WordPressErrorKind;
  /** Persian, user-facing message. */
  message: string;
  status?: number;
  wpCode?: string;
  details?: unknown;
  retryable?: boolean;
}

export class WordPressError extends Error {
  readonly kind: WordPressErrorKind;
  readonly status: number | undefined;
  readonly wpCode: string | undefined;
  readonly details: unknown;
  readonly retryable: boolean;

  constructor(init: WordPressErrorInit) {
    super(init.message);
    this.name = 'WordPressError';
    this.kind = init.kind;
    this.status = init.status;
    this.wpCode = init.wpCode;
    this.details = init.details;
    this.retryable = init.retryable ?? false;
    Object.setPrototypeOf(this, WordPressError.prototype);
  }
}

export const errorMessages = {
  network:
    'اتصال به سایت برقرار نشد. اینترنت، آدرس سایت و اعتبار گواهی HTTPS را بررسی کنید.',
  timeout: 'پاسخ سایت بیش از حد طول کشید. دوباره تلاش کنید.',
  cancelled: 'درخواست لغو شد.',
  auth: 'نام کاربری یا Application Password درست نیست. اگر مطمئن هستید، ممکن است Application Passwords در سایت غیرفعال باشد (مثلاً روی HTTP یا با یک افزونهٔ امنیتی).',
  forbidden: 'این حساب مجوز انجام این کار را ندارد.',
  notFound: 'مورد درخواستی پیدا نشد.',
  restUnavailable:
    'REST API وردپرس در این آدرس در دسترس نیست. آدرس سایت و تنظیم «پیوندهای یکتا» را بررسی کنید، یا آدرس پایهٔ API را دستی وارد کنید.',
  blocked:
    'درخواست توسط سایت، فایروال یا یک افزونهٔ امنیتی مسدود شد. دسترسی REST API را برای این حساب یا دستگاه مجاز کنید.',
  redirect:
    'سایت درخواست را به آدرس دیگری منتقل کرد. برای حفاظت از اطلاعات ورود، درخواست دنبال نشد.',
  invalidResponse:
    'پاسخ سایت قابل فهم نبود (JSON معتبر نبود). ممکن است صفحهٔ نگهداری، یک افزونه یا خطای PHP پاسخ را خراب کرده باشد.',
  insecure: 'برای حفاظت از رمز، اتصال باید از طریق HTTPS باشد.',
  unknown: 'خطای ناشناخته‌ای رخ داد.',
} as const;

const MSG = errorMessages;

interface WpBody {
  code?: string;
  message?: string;
  data?: { status?: number; params?: Record<string, string> };
}

function parseBody(text: string): WpBody | null {
  const t = text.trim().replace(/^\uFEFF/, '');
  if (!t.startsWith('{')) return null;
  try {
    const v: unknown = JSON.parse(t);
    return typeof v === 'object' && v !== null ? (v as WpBody) : null;
  } catch {
    return null;
  }
}

const AUTH_CODES = new Set([
  'incorrect_password',
  'invalid_username',
  'invalid_email',
  'rest_not_logged_in',
  'application_password_invalid',
]);
const BLOCK_CODES = new Set(['rest_disabled', 'rest_login_required', 'rest_cannot_access']);
const RETRYABLE_STATUS = new Set([429, 502, 503, 504]);

export function mapHttpError(status: number, bodyText: string): WordPressError {
  const body = parseBody(bodyText);
  const isJson = body !== null;
  const wpCode = body?.code;
  const wpMessage = body?.message;
  const base = { status, wpCode, details: body ?? undefined } as const;

  if (status === 401 || (wpCode !== undefined && AUTH_CODES.has(wpCode))) {
    return new WordPressError({ ...base, kind: 'auth', message: MSG.auth });
  }
  if (wpCode !== undefined && BLOCK_CODES.has(wpCode)) {
    return new WordPressError({ ...base, kind: 'blocked', message: MSG.blocked });
  }
  if (wpCode === 'rest_no_route' || (status === 404 && !isJson)) {
    return new WordPressError({ ...base, kind: 'rest_unavailable', message: MSG.restUnavailable });
  }
  if (status === 403) {
    return isJson
      ? new WordPressError({ ...base, kind: 'forbidden', message: MSG.forbidden })
      : new WordPressError({ ...base, kind: 'blocked', message: MSG.blocked });
  }
  if (status === 406) {
    return new WordPressError({ ...base, kind: 'blocked', message: MSG.blocked });
  }
  if (status === 404) {
    return new WordPressError({ ...base, kind: 'not_found', message: MSG.notFound });
  }
  if (status === 400 || status === 422) {
    const fields = body?.data?.params ? Object.keys(body.data.params).join('، ') : '';
    const extra = [wpMessage, fields ? `فیلد: ${fields}` : ''].filter(Boolean).join(' — ');
    return new WordPressError({
      ...base,
      kind: 'validation',
      message: `اطلاعات ارسالی از طرف سایت پذیرفته نشد${extra ? `: ${extra}` : '.'}`,
    });
  }
  if (status === 429 || status >= 500) {
    return new WordPressError({
      ...base,
      kind: 'server',
      message: `سایت با خطا پاسخ داد (کد ${status}). کمی بعد دوباره تلاش کنید.`,
      retryable: RETRYABLE_STATUS.has(status),
    });
  }
  return new WordPressError({ ...base, kind: 'unknown', message: `${MSG.unknown} (کد ${status})` });
}

export function toWordPressError(
  e: unknown,
  flags: { timedOut?: boolean; cancelled?: boolean } = {},
): WordPressError {
  if (e instanceof WordPressError) return e;
  if (flags.timedOut) {
    return new WordPressError({ kind: 'timeout', message: MSG.timeout, retryable: true });
  }
  if (flags.cancelled) return new WordPressError({ kind: 'cancelled', message: MSG.cancelled });
  // React Native reports TLS/DNS/offline failures all as "Network request failed";
  // they cannot be told apart reliably, so the message lists the likely causes.
  return new WordPressError({ kind: 'network', message: MSG.network, retryable: true });
}
