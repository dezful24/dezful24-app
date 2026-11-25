import { Screen } from '@/components/Screen';
import { EmptyState } from '@/components/ui';

export default function Media() {
  return (
    <Screen scroll={false}>
      <EmptyState
        icon="images-outline"
        title="کتابخانهٔ رسانه هنوز پیاده‌سازی نشده"
        body="نمایش و آپلود رسانه در مرحلهٔ ۶ ساخته می‌شود."
      />
    </Screen>
  );
}
