import type { SiteSession } from '../services/wordpress/types';
import { storageKeyForSite } from '../services/wordpress/url';

/** Minimal async key-value contract; production uses expo-secure-store. */
export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  deleteItem(key: string): Promise<void>;
}

const ACTIVE_KEY = 'dz24.activeSite';
const sessionKey = (siteId: string) => `dz24.session.${storageKeyForSite(siteId)}`;
const passwordKey = (siteId: string) => `dz24.secret.${storageKeyForSite(siteId)}`;

export function isSiteSession(v: unknown): v is SiteSession {
  if (typeof v !== 'object' || v === null) return false;
  const s = v as Record<string, unknown>;
  return (
    typeof s.siteId === 'string' &&
    typeof s.siteUrl === 'string' &&
    typeof s.apiBase === 'string' &&
    typeof s.username === 'string' &&
    typeof s.site === 'object' &&
    s.site !== null &&
    typeof s.user === 'object' &&
    s.user !== null
  );
}

export interface StoredSession {
  session: SiteSession;
  appPassword: string;
}

/**
 * The password lives under its own key and never inside the session JSON, so the
 * profile can be read/logged without ever touching the secret.
 */
export function createSessionStorage(kv: KeyValueStore) {
  return {
    async save(session: SiteSession, appPassword: string): Promise<void> {
      await kv.setItem(passwordKey(session.siteId), appPassword);
      await kv.setItem(sessionKey(session.siteId), JSON.stringify(session));
      await kv.setItem(ACTIVE_KEY, session.siteId);
    },

    async load(): Promise<StoredSession | null> {
      const siteId = await kv.getItem(ACTIVE_KEY);
      if (!siteId) return null;
      const [raw, appPassword] = await Promise.all([
        kv.getItem(sessionKey(siteId)),
        kv.getItem(passwordKey(siteId)),
      ]);
      if (!raw || !appPassword) return null;
      try {
        const parsed: unknown = JSON.parse(raw);
        return isSiteSession(parsed) && parsed.siteId === siteId
          ? { session: parsed, appPassword }
          : null;
      } catch {
        return null;
      }
    },

    /** Removes credentials and profile. Local drafts are intentionally not touched here. */
    async clear(): Promise<void> {
      const siteId = await kv.getItem(ACTIVE_KEY);
      if (siteId) {
        await kv.deleteItem(passwordKey(siteId));
        await kv.deleteItem(sessionKey(siteId));
      }
      await kv.deleteItem(ACTIVE_KEY);
    },
  };
}
