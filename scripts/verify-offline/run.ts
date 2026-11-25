/* Offline runner: executes the Jest-syntax tests with node:assert (no Jest needed).
   Only a sanity net for environments without npm access; `npm test` is the real runner. */
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

interface T { name: string; fn: () => unknown }
const tests: T[] = [];
const stack: string[] = [];

const g = globalThis as Record<string, unknown>;
g.describe = (name: string, fn: () => void) => { stack.push(name); fn(); stack.pop(); };
g.it = g.test = (name: string, fn: () => unknown) => tests.push({ name: [...stack, name].join(' › '), fn });

function make(actual: unknown, neg: boolean) {
  const chk = (pass: boolean, msg: string) => assert.ok(neg ? !pass : pass, (neg ? 'NOT ' : '') + msg);
  return {
    get not() { return make(actual, !neg); },
    toBe: (v: unknown) => chk(Object.is(actual, v), `expected ${String(actual)} toBe ${String(v)}`),
    toEqual: (v: unknown) => {
      let eq = true;
      try { assert.deepStrictEqual(actual, v); } catch { eq = false; }
      chk(eq, `expected ${JSON.stringify(actual)} toEqual ${JSON.stringify(v)}`);
    },
    toBeNull: () => chk(actual === null, `expected ${String(actual)} toBeNull`),
    toBeUndefined: () => chk(actual === undefined, `expected ${String(actual)} undefined`),
    toBeTruthy: () => chk(Boolean(actual), `expected ${String(actual)} truthy`),
    toBeFalsy: () => chk(!actual, `expected ${String(actual)} falsy`),
    toContain: (v: unknown) => chk(
      typeof actual === 'string' ? actual.includes(String(v)) : Array.isArray(actual) && actual.includes(v),
      `expected ${JSON.stringify(actual)} toContain ${String(v)}`),
    toThrow: () => { let t = false; try { (actual as () => void)(); } catch { t = true; } chk(t, 'toThrow'); },
  };
}
g.expect = (a: unknown) => make(a, false);

async function main() {
  const dir = resolve(process.cwd(), 'src/tests');
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.test.ts')).sort()) {
    await import(pathToFileURL(join(dir, f)).href);
  }
  let failed = 0;
  for (const t of tests) {
    try { await t.fn(); console.log('  ✓', t.name); }
    catch (e) { failed++; console.log('  ✗', t.name, '\n     ', (e as Error).message.split('\n')[0]); }
  }
  console.log(`\n${tests.length - failed}/${tests.length} passed`);
  process.exit(failed ? 1 : 0);
}
void main();
