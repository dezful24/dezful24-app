#!/usr/bin/env bash
# ساخت APK آزمایشی با EAS (روی ماشین دارای اینترنت و حساب Expo).
set -euo pipefail
./setup.sh                       # نصب وابستگی‌های سازگار
npm run typecheck && npm test    # قبل از build باید سبز باشند
npx eas-cli@latest login         # ورود به حساب Expo (تعاملی)
npx eas-cli@latest build:configure   # فقط بار اول: ساخت projectId
npx eas-cli@latest build -p android --profile preview   # خروجی: APK (لینک دانلود در پایان)
# AAB انتشار: npx eas-cli@latest build -p android --profile production
