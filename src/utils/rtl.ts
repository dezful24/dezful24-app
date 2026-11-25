import { I18nManager } from 'react-native';

/**
 * Forces RTL. On Android the layout direction only changes after a reload, so this
 * returns false on the very first launch; the root layout then asks for a restart.
 */
export function ensureRtl(): boolean {
  if (I18nManager.isRTL) return true;
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(true);
  return false;
}
