export interface Palette {
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  primary: string;
  onPrimary: string;
  danger: string;
  onDanger: string;
  dangerBg: string;
  success: string;
}

export const lightPalette: Palette = {
  background: '#F6F7F9',
  surface: '#FFFFFF',
  surfaceAlt: '#EEF0F4',
  border: '#D5D9E0',
  text: '#14171F',
  textMuted: '#555C6B',
  primary: '#0B5FD1',
  onPrimary: '#FFFFFF',
  danger: '#B3261E',
  onDanger: '#FFFFFF',
  dangerBg: '#FCE8E6',
  success: '#1B7F3B',
};

export const darkPalette: Palette = {
  background: '#0F1115',
  surface: '#181B21',
  surfaceAlt: '#222630',
  border: '#343A47',
  text: '#F1F3F7',
  textMuted: '#A9B0BF',
  primary: '#6EA8FF',
  onPrimary: '#06214A',
  danger: '#FFB4AB',
  onDanger: '#4A0B07',
  dangerBg: '#3A1814',
  success: '#7FD99A',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16 } as const;
export const MIN_TOUCH = 48;

export const fonts = {
  regular: 'Vazirmatn_400Regular',
  bold: 'Vazirmatn_700Bold',
} as const;
