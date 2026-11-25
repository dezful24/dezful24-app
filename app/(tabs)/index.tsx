import { useQuery } from '@tanstack/react-query';
import { View } from 'react-native';

import { Screen } from '@/components/Screen';
import { AppText, Button, Card, ErrorBanner } from '@/components/ui';
import { usePostCount, usePostsList } from '@/features/posts/hooks';
import { errorMessage } from '@/services/queryClient';
import { DEFAULT_FILTERS, STATUS_LABELS, postTitle } from '@/services/wordpress/posts';
import { useAuthStore } from '@/store/authStore';

interface MeBrief {
  id: number;
  name: string;
  roles: string[];
}

export default function Home() {
  const session = useAuthStore((s) => s.session);
  const client = useAuthStore((s) => s.client);

  const me = useQuery({
    queryKey: ['me', session?.siteId],
    enabled: !!client,
    queryFn: async () =>
      (await client!.get<MeBrief>('/wp/v2/users/me', { query: { context: 'edit', _fields: 'id,name,roles' } })).data,
  });
  const recent = usePostsList(DEFAULT_FILTERS, 5);
  const published = usePostCount('publish');
  const drafts = usePostCount('draft');

  if (!session) return null;
  const recentItems = recent.data?.pages[0]?.items ?? [];
  const count = (q: { data?: number | null; isPending: boolean; isError: boolean }) =>
    q.isPending ? '…' : q.isError || q.data == null ? 'نامشخص' : String(q.data);

  return (
    <Screen>
      <View>
        <AppText muted>{session.site.name}</AppText>
        <AppText weight="bold" size={24}>
          سلام، {session.user.name}
        </AppText>
      </View>

      <Card>
        <AppText weight="bold">وضعیت اتصال</AppText>
        {me.isPending ? (
          <AppText muted>در حال بررسی اتصال…</AppText>
        ) : me.isError ? (
          <ErrorBanner message={errorMessage(me.error)}>
            <Button variant="secondary" title="تلاش دوباره" onPress={() => void me.refetch()} />
          </ErrorBanner>
        ) : (
          <AppText>اتصال برقرار است. نقش: {me.data.roles.join('، ') || 'نامشخص'}</AppText>
        )}
      </Card>

      <Card>
        <AppText weight="bold">خلاصهٔ نوشته‌ها</AppText>
        <AppText>
          {STATUS_LABELS.publish}: {count(published)} · {STATUS_LABELS.draft}: {count(drafts)}
        </AppText>
        <AppText muted size={13}>
          فقط شمارهایی که از REST API قابل دریافت است؛ آمار بازدید در دسترس نیست.
        </AppText>
      </Card>

      <Card>
        <AppText weight="bold">آخرین نوشته‌ها</AppText>
        {recent.isPending ? (
          <AppText muted>در حال دریافت…</AppText>
        ) : recent.isError ? (
          <ErrorBanner message={errorMessage(recent.error)} />
        ) : recentItems.length === 0 ? (
          <AppText muted>هنوز نوشته‌ای وجود ندارد.</AppText>
        ) : (
          recentItems.map((p) => (
            <AppText key={p.id} numberOfLines={1}>
              • {postTitle(p)}
            </AppText>
          ))
        )}
      </Card>

      <Card>
        <AppText weight="bold">به‌زودی</AppText>
        <AppText muted>
          ساخت و ویرایش نوشته، پیش‌نویس‌های محلی و ویرایشگر در مراحل بعدی ساخته می‌شوند و هنوز وجود ندارند.
        </AppText>
      </Card>
    </Screen>
  );
}
