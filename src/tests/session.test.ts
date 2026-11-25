import { createSessionStorage, type KeyValueStore } from '../storage/session';
import type { SiteSession } from '../services/wordpress/types';

function memoryKv() {
  const map = new Map<string, string>();
  const kv: KeyValueStore = {
    getItem: async (k) => map.get(k) ?? null,
    setItem: async (k, v) => void map.set(k, v),
    deleteItem: async (k) => void map.delete(k),
  };
  return { kv, map };
}

const mk = (siteId: string): SiteSession => ({
  siteId,
  siteUrl: `https://${siteId}`,
  apiBase: `https://${siteId}/wp-json/`,
  username: 'editor',
  site: { name: 'n', description: '', url: '', home: '', gmtOffset: null, timezoneString: null },
  user: { id: 1, name: 'u', slug: 'u', roles: [], capabilities: {} },
  connectedAt: '2026-01-01T00:00:00.000Z',
});

describe('session storage', () => {
  it('round-trips a session and keeps the password out of the profile JSON', async () => {
    const { kv, map } = memoryKv();
    const s = createSessionStorage(kv);
    await s.save(mk('example.com'), 'TOPSECRETPASSWORD');
    const loaded = await s.load();
    expect(loaded?.appPassword).toBe('TOPSECRETPASSWORD');
    expect(loaded?.session.siteId).toBe('example.com');
    const profileEntries = [...map.entries()].filter(([k]) => k.startsWith('dz24.session.'));
    expect(profileEntries.length).toBe(1);
    expect(profileEntries[0]?.[1]).not.toContain('TOPSECRET');
  });

  it('clear removes secret, profile and active pointer', async () => {
    const { kv, map } = memoryKv();
    const s = createSessionStorage(kv);
    await s.save(mk('example.com'), 'pw');
    await s.clear();
    expect(map.size).toBe(0);
    expect(await s.load()).toBeNull();
  });

  it('returns null for corrupt data instead of throwing', async () => {
    const { kv, map } = memoryKv();
    const s = createSessionStorage(kv);
    await s.save(mk('example.com'), 'pw');
    for (const k of [...map.keys()]) if (k.startsWith('dz24.session.')) map.set(k, '{broken');
    expect(await s.load()).toBeNull();
  });

  it('does not mix two sites: the active site wins and clear affects only it', async () => {
    const { kv, map } = memoryKv();
    const s = createSessionStorage(kv);
    await s.save(mk('a.com'), 'pwA');
    await s.save(mk('b.com'), 'pwB');
    expect((await s.load())?.session.siteId).toBe('b.com');
    await s.clear();
    expect([...map.keys()].some((k) => k.startsWith('dz24.secret.'))).toBe(true); // a.com's remains
    expect(await s.load()).toBeNull();
  });
});
