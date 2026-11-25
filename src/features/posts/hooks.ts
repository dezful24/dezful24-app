import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  countPosts,
  listPosts,
  listTerms,
  restorePost,
  trashPost,
  type PostFilters,
  type PostStatus,
} from '../../services/wordpress/posts';
import { useAuthStore } from '../../store/authStore';

const PER_PAGE = 20;

function useSite() {
  const client = useAuthStore((s) => s.client);
  const session = useAuthStore((s) => s.session);
  return { client, siteId: session?.siteId, caps: session?.user.capabilities ?? {} };
}

export function usePostsList(filters: PostFilters, perPage = PER_PAGE) {
  const { client, siteId, caps } = useSite();
  return useInfiniteQuery({
    queryKey: ['posts', siteId, filters, perPage],
    enabled: !!client,
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) =>
      listPosts(client!, filters, pageParam, perPage, caps, signal),
    getNextPageParam: (last, all) =>
      all.length < last.pagination.totalPages ? all.length + 1 : undefined,
  });
}

export function usePostCount(status: PostStatus) {
  const { client, siteId } = useSite();
  return useQuery({
    queryKey: ['posts-count', siteId, status],
    enabled: !!client,
    queryFn: ({ signal }) => countPosts(client!, status, signal),
  });
}

export function useCategories(search: string, enabled: boolean) {
  const { client, siteId } = useSite();
  return useInfiniteQuery({
    queryKey: ['categories', siteId, search],
    enabled: !!client && enabled,
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => listTerms(client!, 'categories', pageParam, search, signal),
    getNextPageParam: (last, all) =>
      all.length < last.pagination.totalPages ? all.length + 1 : undefined,
  });
}

/** Success is only reported after the server confirmed; lists are then refetched. */
export function usePostStatusMutations() {
  const { client } = useSite();
  const qc = useQueryClient();
  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['posts'] }),
      qc.invalidateQueries({ queryKey: ['posts-count'] }),
    ]);
  const trash = useMutation({
    mutationFn: (id: number) => trashPost(client!, id),
    onSuccess: refresh,
  });
  const restore = useMutation({
    mutationFn: (id: number) => restorePost(client!, id),
    onSuccess: refresh,
  });
  return { trash, restore };
}
