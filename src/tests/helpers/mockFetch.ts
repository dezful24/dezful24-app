export interface RecordedCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

export interface MockSpec {
  status?: number;
  body?: unknown;
  headers?: Record<string, string>;
  /** Simulates a platform that followed a redirect itself. */
  finalUrl?: string;
  /** Never resolves; rejects when aborted. */
  hang?: boolean;
  /** Reject like a dropped connection. */
  networkError?: boolean;
}

export type Responder = (call: RecordedCall, index: number) => MockSpec;

function toResponse(spec: MockSpec, requestedUrl: string): Response {
  const status = spec.status ?? 200;
  const isString = typeof spec.body === 'string';
  const text = isString
    ? (spec.body as string)
    : spec.body === undefined
      ? ''
      : JSON.stringify(spec.body);
  const map = new Map<string, string>();
  if (!isString && spec.body !== undefined) map.set('content-type', 'application/json');
  for (const [k, v] of Object.entries(spec.headers ?? {})) map.set(k.toLowerCase(), v);
  return {
    status,
    ok: status >= 200 && status < 300,
    url: spec.finalUrl ?? requestedUrl,
    type: 'basic',
    headers: { get: (n: string) => map.get(n.toLowerCase()) ?? null },
    text: async () => text,
  } as unknown as Response;
}

export function createMockFetch(responder: Responder | MockSpec[]) {
  const calls: RecordedCall[] = [];
  const fn = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    const call: RecordedCall = {
      url,
      method: init?.method ?? 'GET',
      headers: { ...((init?.headers as Record<string, string>) ?? {}) },
      body: init?.body,
    };
    const index = calls.length;
    calls.push(call);
    const spec = Array.isArray(responder)
      ? (responder[Math.min(index, responder.length - 1)] ?? {})
      : responder(call, index);
    if (spec.networkError) throw new TypeError('Network request failed');
    if (spec.hang) {
      return new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      });
    }
    return toResponse(spec, url);
  }) as typeof fetch;
  return { fetch: fn, calls };
}

export async function expectReject(p: Promise<unknown>): Promise<unknown> {
  try {
    await p;
  } catch (e) {
    return e;
  }
  throw new Error('expected promise to reject');
}

export const noSleep = async (): Promise<void> => undefined;
