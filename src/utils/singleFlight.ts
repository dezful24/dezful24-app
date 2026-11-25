/**
 * Wraps an async action so repeated taps while it is running share the in-flight
 * promise instead of triggering the operation again (no double submit).
 */
export function singleFlight<A extends unknown[], R>(fn: (...args: A) => Promise<R>) {
  let inFlight: Promise<R> | null = null;
  const wrapped = (...args: A): Promise<R> => {
    if (inFlight) return inFlight;
    const p = fn(...args).finally(() => {
      if (inFlight === p) inFlight = null;
    });
    inFlight = p;
    return p;
  };
  wrapped.isPending = (): boolean => inFlight !== null;
  return wrapped;
}
