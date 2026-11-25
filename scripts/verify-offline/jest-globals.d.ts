// Types for the offline runner only. In the real project @types/jest provides these.
interface Matchers {
  not: Matchers;
  toBe(v: unknown): void;
  toEqual(v: unknown): void;
  toBeNull(): void;
  toBeUndefined(): void;
  toBeTruthy(): void;
  toBeFalsy(): void;
  toContain(v: unknown): void;
  toThrow(): void;
}
declare function describe(name: string, fn: () => void): void;
declare function it(name: string, fn: () => unknown): void;
declare function test(name: string, fn: () => unknown): void;
declare function expect(actual: unknown): Matchers;
declare const Buffer: { from(s: string, enc: string): { toString(enc: string): string } };
