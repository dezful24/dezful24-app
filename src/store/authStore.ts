import { create } from 'zustand';

import { ALLOW_INSECURE_HTTP, REQUEST_TIMEOUT_MS } from '../config';
import { queryClient } from '../services/queryClient';
import { WordPressClient } from '../services/wordpress/client';
import { connectToSite, type ConnectInput } from '../services/wordpress/connect';
import type { SiteSession } from '../services/wordpress/types';
import { secureKeyValueStore } from '../storage/secureStore';
import { createSessionStorage } from '../storage/session';

const storage = createSessionStorage(secureKeyValueStore);

type AuthStatus = 'restoring' | 'signedOut' | 'signedIn';

interface AuthState {
  status: AuthStatus;
  session: SiteSession | null;
  client: WordPressClient | null;
  restore: () => Promise<void>;
  connect: (input: ConnectInput) => Promise<void>;
  disconnect: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'restoring',
  session: null,
  client: null,

  restore: async () => {
    try {
      const stored = await storage.load();
      if (!stored) return set({ status: 'signedOut', session: null, client: null });
      const client = new WordPressClient({
        siteId: stored.session.siteId,
        apiBase: stored.session.apiBase,
        username: stored.session.username,
        appPassword: stored.appPassword,
        allowInsecureHttp: ALLOW_INSECURE_HTTP,
        timeoutMs: REQUEST_TIMEOUT_MS,
      });
      set({ status: 'signedIn', session: stored.session, client });
    } catch {
      set({ status: 'signedOut', session: null, client: null });
    }
  },

  connect: async (input) => {
    const result = await connectToSite(input, {
      allowInsecureHttp: ALLOW_INSECURE_HTTP,
      timeoutMs: REQUEST_TIMEOUT_MS,
    });
    // Persist first; only show success once the credentials are really stored.
    await storage.save(result.session, result.appPassword);
    set({ status: 'signedIn', session: result.session, client: result.client });
  },

  disconnect: async () => {
    await storage.clear();
    queryClient.clear();
    set({ status: 'signedOut', session: null, client: null });
  },
}));
