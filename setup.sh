#!/usr/bin/env bash
# نصب وابستگی‌ها با نسخه‌های سازگار با SDK انتخاب‌شده توسط Expo.
# شماره نسخه‌ها عمداً در package.json حدس زده نشده‌اند؛ expo install آن‌ها را تعیین می‌کند.
set -euo pipefail

npm install expo@latest --save --no-fund --no-audit

npx expo install \
  expo-router react react-native react-native-safe-area-context react-native-screens \
  expo-linking expo-constants expo-status-bar expo-splash-screen expo-font \
  expo-secure-store expo-sqlite expo-image-picker expo-image-manipulator \
  expo-localization @react-native-community/netinfo @expo/vector-icons

npm install --save @tanstack/react-query zustand react-hook-form zod @hookform/resolvers \
  @expo-google-fonts/vazirmatn

npx expo install --dev -- jest-expo jest @types/jest @testing-library/react-native \
  typescript @types/react eslint eslint-config-expo prettier

npx expo install --fix
echo "✓ نصب تمام شد. حالا: npm run typecheck && npm test"
