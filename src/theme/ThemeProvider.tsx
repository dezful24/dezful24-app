import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { useUiStore, type ThemePreference } from '../store/uiStore';
import { darkPalette, lightPalette, type Palette } from './tokens';

interface ThemeValue {
  colors: Palette;
  isDark: boolean;
  preference: ThemePreference;
}

const ThemeContext = createContext<ThemeValue>({
  colors: lightPalette,
  isDark: false,
  preference: 'system',
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const preference = useUiStore((s) => s.themePreference);
  const value = useMemo<ThemeValue>(() => {
    const isDark = preference === 'system' ? system === 'dark' : preference === 'dark';
    return { colors: isDark ? darkPalette : lightPalette, isDark, preference };
  }, [system, preference]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
