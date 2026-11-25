import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { useTheme } from '@/theme/ThemeProvider';
import { fonts } from '@/theme/tokens';

type IconName = keyof typeof Ionicons.glyphMap;
const tab = (title: string, icon: IconName, iconActive: IconName) => ({
  title,
  tabBarAccessibilityLabel: title,
  tabBarIcon: ({ color, size, focused }: { color: string; size: number; focused: boolean }) => (
    <Ionicons name={focused ? iconActive : icon} size={size} color={color} />
  ),
});

export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarLabelStyle: { fontFamily: fonts.regular, fontSize: 12 },
      }}
    >
      <Tabs.Screen name="index" options={tab('خانه', 'home-outline', 'home')} />
      <Tabs.Screen name="posts" options={tab('نوشته‌ها', 'document-text-outline', 'document-text')} />
      <Tabs.Screen name="media" options={tab('رسانه‌ها', 'images-outline', 'images')} />
      <Tabs.Screen name="settings" options={tab('تنظیمات', 'settings-outline', 'settings')} />
    </Tabs>
  );
}
