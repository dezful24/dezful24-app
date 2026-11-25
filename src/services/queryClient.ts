import { QueryClient } from '@tanstack/react-query';

import { WordPressError } from './wordpress/errors';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // The WordPress client already retries safe requests itself.
      retry: false,
      refetchOnWindowFocus: false,
    },
    mutations: { retry: false },
  },
});

export function errorMessage(e: unknown): string {
  if (e instanceof WordPressError) return e.message;
  if (e instanceof Error && e.message) return e.message;
  return 'خطای ناشناخته‌ای رخ داد.';
}
