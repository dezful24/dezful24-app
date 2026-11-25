import Constants from 'expo-constants';
import { Alert, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { AppText, Button, Card } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import { useUiStore, type ThemePreference } from '@/store/uiStore';

const THEMES: Array<{ value: ThemePreference; label: string }> = [
  { value: 'system', label: 'پیروی از سیستم' },
  { value: 'light', label: 'روشن' },
  { value: 'dark', label: 'تاریک' },
];

export default function Settings() {
  const session = useAuthStore((s) => s.session);
  const disconnect = useAuthStore((s) => s.disconnect);
  const pref = useUiStore((s) => s.themePreference);
  const setPref = useUiStore((s) => s.setThemePreference);

  const confirmDisconnect = () =>
    Alert.alert(
      'قطع اتصال',
      'رمز و اطلاعات ورود از این دستگاه حذف می‌شود. (پیش‌نویس‌های محلی در مراحل بعد جداگانه و با تأیید شما مدیریت می‌شوند.)',
      [
        { text: 'انصراف', style: 'cancel' },
        { text: 'قطع اتصال', style: 'destructive', onPress: () => void disconnect() },
      ],
    );

  return (
    <Screen>
      <AppText weight="bold" size={24}>
        تنظیمات
      </AppText>

      {session ? (
        <Card>
          <AppText weight="bold">سایت و کاربر</AppText>
          <AppText>{session.site.name}</AppText>
          <AppText muted style={{ writingDirection: 'ltr', textAlign: 'left' }}>
            {session.siteUrl}
          </AppText>
          <AppText>
            کاربر: {session.user.name} ({session.username})
          </AppText>
          <AppText muted size={13}>
            منطقهٔ زمانی سایت: {session.site.timezoneString ?? 'در دسترس نیست'}
          </AppText>
        </Card>
      ) : null}

      <Card>
        <AppText weight="bold">پوسته</AppText>
        <View style={{ gap: 8 }}>
          {THEMES.map((t) => (
            <Button
              key={t.value}
              variant={pref === t.value ? 'primary' : 'secondary'}
              title={t.label}
              onPress={() => void setPref(t.value)}
            />
          ))}
        </View>
      </Card>

      <Button variant="danger" title="قطع اتصال" onPress={confirmDisconnect} />
      <AppText muted size={13}>
        نسخهٔ برنامه: {Constants.expoConfig?.version ?? '—'}
      </AppText>
    </Screen>
  );
}
