import {
  Vazirmatn_400Regular,
  Vazirmatn_700Bold,
  useFonts,
} from '@expo-google-fonts/vazirmatn';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, type ReactNode } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui';
import { queryClient } from '@/services/queryClient';
import { useAuthStore } from '@/store/authStore';
import { useUiStore } from '@/store/uiStore';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';
import { ensureRtl } from '@/utils/rtl';

void SplashScreen.preventAutoHideAsync();
const rtlReady = ensureRtl();

function AuthGate({ children }: { children: ReactNode }) {
  const status = useAuthStore((s) => s.status);
  const segments = useSegments();
  const router = useRouter();
  useEffect(() => {
    if (status === 'restoring') return;
    const onConnect = (segments[0] as string | undefined) === 'connect';
    if (status === 'signedOut' && !onConnect) router.replace('/connect');
    if (status === 'signedIn' && onConnect) router.replace('/');
  }, [status, segments, router]);
  return <>{children}</>;
}

function Shell() {
  const { colors, isDark } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }} />
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Vazirmatn_400Regular, Vazirmatn_700Bold });
  const status = useAuthStore((s) => s.status);
  const restore = useAuthStore((s) => s.restore);
  const hydrateUi = useUiStore((s) => s.hydrate);

  useEffect(() => {
    void hydrateUi();
    void restore();
  }, [hydrateUi, restore]);

  const ready = fontsLoaded && status !== 'restoring';
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  if (!rtlReady) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <AppText weight="bold" size={18}>
          برای اعمال چیدمان راست‌به‌چپ، برنامه را یک‌بار ببندید و دوباره باز کنید.
        </AppText>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthGate>
            <Shell />
          </AuthGate>
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
