import { Ionicons } from '@expo/vector-icons';
import { Image, Linking, View } from 'react-native';

import { AppText, Button } from '../../components/ui';
import {
  STATUS_LABELS,
  featuredImageUrl,
  isSafeWebUrl,
  postAuthorName,
  postTitle,
  type WpPost,
} from '../../services/wordpress/posts';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, spacing } from '../../theme/tokens';

function formatDate(local: string): string {
  // `date` is the site's wall-clock time without an offset; format it without converting.
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return local.slice(0, 10);
  try {
    return d.toLocaleDateString('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return local.slice(0, 10);
  }
}

export function PostRow({
  post,
  busy,
  onTrash,
  onRestore,
}: {
  post: WpPost;
  busy: boolean;
  onTrash: (p: WpPost) => void;
  onRestore: (p: WpPost) => void;
}) {
  const { colors } = useTheme();
  const image = featuredImageUrl(post);
  const author = postAuthorName(post);
  const isTrash = post.status === 'trash';
  const canView = post.status === 'publish' && isSafeWebUrl(post.link);

  return (
    <View
      accessible
      accessibilityLabel={`${postTitle(post)}، ${STATUS_LABELS[post.status]}`}
      style={{
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: radius.lg,
        padding: spacing.md,
        gap: spacing.sm,
      }}
    >
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        {image ? (
          <Image
            source={{ uri: image }}
            accessibilityIgnoresInvertColors
            style={{ width: 72, height: 72, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt }}
          />
        ) : (
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: radius.sm,
              backgroundColor: colors.surfaceAlt,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="image-outline" size={24} color={colors.textMuted} />
          </View>
        )}
        <View style={{ flex: 1, gap: 2 }}>
          <AppText weight="bold" numberOfLines={2}>
            {postTitle(post)}
          </AppText>
          <AppText size={13} muted>
            {STATUS_LABELS[post.status]} · {formatDate(post.date)}
          </AppText>
          {author ? (
            <AppText size={13} muted>
              {author}
            </AppText>
          ) : null}
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {canView ? (
          <View style={{ flex: 1 }}>
            <Button variant="secondary" title="مشاهده در سایت" onPress={() => void Linking.openURL(post.link)} />
          </View>
        ) : null}
        <View style={{ flex: 1 }}>
          {isTrash ? (
            <Button variant="secondary" title="بازیابی" loading={busy} onPress={() => onRestore(post)} />
          ) : (
            <Button variant="secondary" title="انتقال به زباله‌دان" loading={busy} onPress={() => onTrash(post)} />
          )}
        </View>
      </View>
    </View>
  );
}
