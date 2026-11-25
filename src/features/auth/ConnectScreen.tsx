import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, View } from 'react-native';
import { z } from 'zod';

import { AppText, Button, Card, ErrorBanner, TextField } from '../../components/ui';
import { Screen } from '../../components/Screen';
import { ALLOW_INSECURE_HTTP } from '../../config';
import { WordPressError } from '../../services/wordpress/errors';
import { UrlError, originOf } from '../../services/wordpress/url';
import { useAuthStore } from '../../store/authStore';
import { singleFlight } from '../../utils/singleFlight';
import { validateConnectFields, type ConnectFormValues } from './validation';

const schema = z
  .object({
    siteUrl: z.string(),
    username: z.string(),
    appPassword: z.string(),
    apiBaseOverride: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    const errors = validateConnectFields(v, { allowInsecureHttp: ALLOW_INSECURE_HTTP });
    for (const [field, message] of Object.entries(errors)) {
      ctx.addIssue({ code: 'custom', path: [field], message });
    }
  });

export function ConnectScreen() {
  const connect = useAuthStore((s) => s.connect);
  const [formError, setFormError] = useState<string | null>(null);
  const [suggested, setSuggested] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ConnectFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { siteUrl: '', username: '', appPassword: '', apiBaseOverride: '' },
  });

  // Repeated taps while a connection attempt is running share one attempt.
  const submit = useRef(
    singleFlight(async (values: ConnectFormValues) => {
      setFormError(null);
      setSuggested(null);
      try {
        await connect(values);
      } catch (e) {
        if (e instanceof UrlError) setFormError(e.message);
        else if (e instanceof WordPressError) {
          setFormError(e.message);
          const loc = (e.details as { location?: string } | undefined)?.location;
          if (e.kind === 'redirect' && loc) {
            const o = originOf(loc);
            if (o) setSuggested(o);
          }
        } else setFormError('اتصال انجام نشد. دوباره تلاش کنید.');
      }
    }),
  ).current;

  const onSubmit = useMemo(() => handleSubmit((v) => submit(v)), [handleSubmit, submit]);

  return (
    <Screen>
      <View style={{ gap: 4 }}>
        <AppText weight="bold" size={24}>
          اتصال به وردپرس
        </AppText>
        <AppText muted>
          برای مدیریت نوشته‌ها، آدرس سایت و یک Application Password وارد کنید. رمز اصلی حساب را وارد نکنید.
        </AppText>
      </View>

      {formError ? (
        <ErrorBanner message={formError}>
          {suggested ? (
            <Button
              variant="secondary"
              title={`استفاده از ${suggested}`}
              onPress={() => {
                setValue('siteUrl', suggested);
                setFormError(null);
                setSuggested(null);
              }}
            />
          ) : null}
        </ErrorBanner>
      ) : null}

      <Controller
        control={control}
        name="siteUrl"
        render={({ field }) => (
          <TextField
            label="آدرس سایت"
            placeholder="https://example.com"
            hint="اگر وردپرس در زیرپوشه نصب است، آن را هم بنویسید؛ مثل https://example.com/blog"
            error={errors.siteUrl?.message}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            textContentType="URL"
            ltr
          />
        )}
      />
      <Controller
        control={control}
        name="username"
        render={({ field }) => (
          <TextField
            label="نام کاربری وردپرس"
            error={errors.username?.message}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="username"
            ltr
          />
        )}
      />
      <Controller
        control={control}
        name="appPassword"
        render={({ field }) => (
          <TextField
            label="Application Password"
            error={errors.appPassword?.message}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            autoCapitalize="none"
            autoCorrect={false}
            secure
            ltr
          />
        )}
      />

      <Pressable accessibilityRole="button" onPress={() => setShowGuide((s) => !s)}>
        <AppText style={{ color: '#0B5FD1' }} weight="bold">
          {showGuide ? '▾' : '◂'} راهنمای ساخت Application Password
        </AppText>
      </Pressable>
      {showGuide ? (
        <Card>
          <AppText>۱. در پیشخوان وردپرس به «کاربران ← پروفایل» بروید.</AppText>
          <AppText>۲. بخش «Application Passwords» را پیدا کنید.</AppText>
          <AppText>۳. نامی مثل «دزفول 24» بنویسید و «افزودن» را بزنید.</AppText>
          <AppText>۴. رمز نمایش‌داده‌شده را همین‌جا وارد کنید؛ فاصله‌ها اشکالی ندارند.</AppText>
          <AppText muted size={13}>
            اگر این بخش را نمی‌بینید، سایت باید HTTPS داشته باشد و ممکن است افزونه‌ای آن را غیرفعال کرده باشد.
          </AppText>
        </Card>
      ) : null}

      <Pressable accessibilityRole="button" onPress={() => setShowAdvanced((s) => !s)}>
        <AppText muted weight="bold">
          {showAdvanced ? '▾' : '◂'} تنظیمات پیشرفته
        </AppText>
      </Pressable>
      {showAdvanced ? (
        <Controller
          control={control}
          name="apiBaseOverride"
          render={({ field }) => (
            <TextField
              label="آدرس پایهٔ API (اختیاری)"
              placeholder="https://example.com/wp-json/"
              hint="فقط اگر اتصال خودکار شکست خورد؛ باید روی همان دامنهٔ سایت باشد."
              error={errors.apiBaseOverride?.message}
              value={field.value ?? ''}
              onChangeText={field.onChange}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              ltr
            />
          )}
        />
      ) : null}

      <Button title="بررسی اتصال" onPress={onSubmit} loading={isSubmitting} />
    </Screen>
  );
}
