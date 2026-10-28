/**
 * Store pages of the YoCoach mobile app, offered to clients after they sign up on the web.
 * Empty until the published links are known: the page then tells the client to search "YoCoach" in the store.
 */
export const APP_STORE_URL = '';
export const PLAY_STORE_URL = '';

export type MobilePlatform = 'ios' | 'android' | 'other';

export function mobilePlatform(userAgent = navigator.userAgent): MobilePlatform {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return 'ios';
  if (/Android/i.test(userAgent)) return 'android';
  return 'other';
}
