import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Button, EmptyState, ErrorBanner, TextField } from '../../components/ui';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { errorMessage } from '../../services/queryClient';
import {
  DEFAULT_FILTERS,
  STATUS_LABELS,
  postTitle,
  type PostFilters,
  type StatusFilter,
  type WpPost,
} from '../../services/wordpress/posts';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../theme/ThemeProvider';
import { MIN_TOUCH, radius, spacing } from '../../theme/tokens';
import { CategoryPicker } from './CategoryPicker';
import { usePostStatusMutations, usePostsList } from './hooks';
import { PostRow } from './PostRow';

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={{
        minHeight: 40,
        paddingHorizontal: spacing.md,
        borderRadius: radius.lg,
        justifyContent: 'center',
        backgroundColor: active ? colors.primary : colors.surfaceAlt,
      }}
    >
      <AppText size={14} weight={active ? 'bold' : 'regular'} style={{ color: active ? colors.onPrimary : colors.text }}>
        {label}
      </AppText>
    </Pressable>
  );
}

export function PostsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const caps = useAuthStore((s) => s.session?.user.capabilities ?? {});
  const [searchText, setSearchText] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [orderBy, setOrderBy] = useState<PostFilters['orderBy']>('date');
  const [pickerOpen, setPickerOpen] = useState(false);

  const search = useDebouncedValue(searchText, 400);
  const filters = useMemo<PostFilters>(
    () => ({ ...DEFAULT_FILTERS, search, status, categoryId, orderBy }),
    [search, status, categoryId, orderBy],
  );
  const list = usePostsList(filters);
  const { trash, restore } = usePostStatusMutations();
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];
  const busyId = trash.isPending ? trash.variables : restore.isPending ? restore.variables : null;

  const statuses: StatusFilter[] = [
    'all',
    'publish',
    'draft',
    'pending',
    'future',
    ...(caps.read_private_posts === true ? (['private'] as const) : []),
    'trash',
  ];

  const confirmTrash = (p: WpPost) =>
    Alert.alert('انتقال به زباله‌دان', `«${postTitle(p)}» به زباله‌دان منتقل شود؟ بعداً می‌توانید آن را بازیابی کنید.`, [
      { text: 'انصراف', style: 'cancel' },
      {
        text: 'انتقال',
        style: 'destructive',
        onPress: () =>
          trash.mutate(p.id, { onError: (e) => Alert.alert('انتقال انجام نشد', errorMessage(e)) }),
      },
    ]);

  const doRestore = (p: WpPost) =>
    restore.mutate(p.id, { onError: (e) => Alert.alert('بازیابی انجام نشد', errorMessage(e)) });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <View style={{ padding: spacing.lg, gap: spacing.md }}>
        <AppText weight="bold" size={24}>
          نوشته‌ها
        </AppText>
        <TextField label="جست‌وجو" value={searchText} onChangeText={setSearchText} returnKeyType="search" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
          {statuses.map((s) => (
            <Chip key={s} label={s === 'all' ? 'همه' : STATUS_LABELS[s]} active={status === s} onPress={() => setStatus(s)} />
          ))}
        </ScrollView>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Button
              variant="secondary"
              title={categoryId === null ? 'دسته‌بندی: همه' : 'دسته‌بندی: انتخاب‌شده'}
              onPress={() => setPickerOpen(true)}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              variant="secondary"
              title={orderBy === 'date' ? 'مرتب‌سازی: تاریخ ایجاد' : 'مرتب‌سازی: تاریخ ویرایش'}
              onPress={() => setOrderBy((o) => (o === 'date' ? 'modified' : 'date'))}
            />
          </View>
        </View>
      </View>

      {list.isPending ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : list.isError && items.length === 0 ? (
        <View style={{ padding: spacing.lg }}>
          <ErrorBanner message={errorMessage(list.error)}>
            <Button variant="secondary" title="تلاش دوباره" onPress={() => void list.refetch()} />
          </ErrorBanner>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(p) => String(p.id)}
          contentContainerStyle={{ padding: spacing.lg, paddingTop: 0, gap: spacing.md, flexGrow: 1, minHeight: MIN_TOUCH }}
          renderItem={({ item }) => (
            <PostRow post={item} busy={busyId === item.id} onTrash={confirmTrash} onRestore={doRestore} />
          )}
          refreshControl={
            <RefreshControl refreshing={list.isRefetching && !list.isFetchingNextPage} onRefresh={() => void list.refetch()} />
          }
          onEndReachedThreshold={0.5}
          onEndReached={() => {
            if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage();
          }}
          ListFooterComponent={
            list.isFetchingNextPage ? (
              <ActivityIndicator color={colors.primary} />
            ) : list.isError ? (
              <ErrorBanner message={errorMessage(list.error)} />
            ) : null
          }
          ListEmptyComponent={
            <EmptyState icon="document-text-outline" title="نوشته‌ای پیدا نشد" body="فیلترها یا عبارت جست‌وجو را تغییر دهید." />
          }
        />
      )}

      <CategoryPicker
        visible={pickerOpen}
        selectedId={categoryId}
        onSelect={(id) => {
          setCategoryId(id);
          setPickerOpen(false);
        }}
        onClose={() => setPickerOpen(false)}
      />
    </View>
  );
}
