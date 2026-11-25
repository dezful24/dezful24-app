import { useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Button, ErrorBanner, TextField } from '../../components/ui';
import { errorMessage } from '../../services/queryClient';
import { orderTermsHierarchically } from '../../services/wordpress/posts';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useTheme } from '../../theme/ThemeProvider';
import { MIN_TOUCH, spacing } from '../../theme/tokens';
import { useCategories } from './hooks';

export function CategoryPicker({
  visible,
  selectedId,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const q = useCategories(useDebouncedValue(search, 400), visible);
  const items = orderTermsHierarchically(q.data?.pages.flatMap((p) => p.items) ?? []);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.background, padding: spacing.lg, paddingTop: spacing.lg + insets.top, gap: spacing.md }}>
        <AppText weight="bold" size={20}>
          فیلتر دسته‌بندی
        </AppText>
        <TextField label="جست‌وجوی دسته‌بندی" value={search} onChangeText={setSearch} />
        {q.isError ? <ErrorBanner message={errorMessage(q.error)} /> : null}
        <FlatList
          data={items}
          keyExtractor={(i) => String(i.term.id)}
          ListHeaderComponent={
            <Pressable
              accessibilityRole="button"
              onPress={() => onSelect(null)}
              style={{ minHeight: MIN_TOUCH, justifyContent: 'center' }}
            >
              <AppText weight={selectedId === null ? 'bold' : 'regular'}>همهٔ دسته‌بندی‌ها</AppText>
            </Pressable>
          }
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: item.term.id === selectedId }}
              onPress={() => onSelect(item.term.id)}
              style={{ minHeight: MIN_TOUCH, justifyContent: 'center', paddingStart: item.depth * 16 }}
            >
              <AppText weight={item.term.id === selectedId ? 'bold' : 'regular'}>
                {item.depth > 0 ? '— ' : ''}
                {item.term.name} ({item.term.count})
              </AppText>
            </Pressable>
          )}
          onEndReached={() => {
            if (q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage();
          }}
          ListFooterComponent={q.isFetching ? <ActivityIndicator color={colors.primary} /> : null}
          ListEmptyComponent={!q.isFetching ? <AppText muted>دسته‌بندی‌ای پیدا نشد.</AppText> : null}
        />
        <Button variant="secondary" title="بستن" onPress={onClose} />
      </View>
    </Modal>
  );
}
