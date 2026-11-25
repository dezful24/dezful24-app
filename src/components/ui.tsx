import { Ionicons } from '@expo/vector-icons';
import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
} from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { MIN_TOUCH, fonts, radius, spacing } from '../theme/tokens';

export function AppText({
  weight = 'regular',
  muted,
  size = 15,
  style,
  ...rest
}: TextProps & { weight?: 'regular' | 'bold'; muted?: boolean; size?: number }) {
  const { colors } = useTheme();
  const s: StyleProp<TextStyle> = [
    {
      color: muted ? colors.textMuted : colors.text,
      fontFamily: weight === 'bold' ? fonts.bold : fonts.regular,
      fontSize: size,
      lineHeight: Math.round(size * 1.6),
    },
    style,
  ];
  return <Text {...rest} style={s} />;
}

export function Button({
  title,
  onPress,
  loading,
  disabled,
  variant = 'primary',
  accessibilityLabel,
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
  accessibilityLabel?: string;
}) {
  const { colors } = useTheme();
  const bg =
    variant === 'primary' ? colors.primary : variant === 'danger' ? colors.danger : colors.surfaceAlt;
  const fg =
    variant === 'primary' ? colors.onPrimary : variant === 'danger' ? colors.onDanger : colors.text;
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: MIN_TOUCH,
        borderRadius: radius.md,
        backgroundColor: bg,
        opacity: inactive ? 0.6 : pressed ? 0.85 : 1,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: spacing.sm,
        paddingHorizontal: spacing.lg,
      })}
    >
      {loading ? <ActivityIndicator color={fg} /> : null}
      <AppText weight="bold" style={{ color: fg }}>
        {title}
      </AppText>
    </Pressable>
  );
}

export function TextField({
  label,
  error,
  hint,
  secure,
  ltr,
  ...rest
}: TextInputProps & { label: string; error?: string; hint?: string; secure?: boolean; ltr?: boolean }) {
  const { colors } = useTheme();
  const [hidden, setHidden] = useState(!!secure);
  return (
    <View style={{ gap: spacing.xs }}>
      <AppText weight="bold" size={14}>
        {label}
      </AppText>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: 1,
          borderColor: error ? colors.danger : colors.border,
          backgroundColor: colors.surface,
          borderRadius: radius.md,
          minHeight: MIN_TOUCH,
        }}
      >
        <TextInput
          {...rest}
          accessibilityLabel={label}
          secureTextEntry={secure ? hidden : false}
          placeholderTextColor={colors.textMuted}
          style={{
            flex: 1,
            color: colors.text,
            fontFamily: fonts.regular,
            fontSize: 15,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            writingDirection: ltr ? 'ltr' : 'rtl',
          }}
        />
        {secure ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'نمایش رمز' : 'مخفی‌کردن رمز'}
            onPress={() => setHidden((h) => !h)}
            style={{ width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={22} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <AppText size={13} style={{ color: colors.danger }} accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : hint ? (
        <AppText size={13} muted>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

export function ErrorBanner({ message, children }: { message: string; children?: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityRole="alert"
      style={{ backgroundColor: colors.dangerBg, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm }}
    >
      <AppText style={{ color: colors.danger }}>{message}</AppText>
      {children}
    </View>
  );
}

export function Card({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: radius.lg,
        padding: spacing.lg,
        gap: spacing.sm,
      }}
    >
      {children}
    </View>
  );
}

export function EmptyState({ icon, title, body }: { icon: keyof typeof Ionicons.glyphMap; title: string; body?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm }}>
      <Ionicons name={icon} size={44} color={colors.textMuted} />
      <AppText weight="bold" size={17}>
        {title}
      </AppText>
      {body ? (
        <AppText muted style={{ textAlign: 'center' }}>
          {body}
        </AppText>
      ) : null}
    </View>
  );
}
