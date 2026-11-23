/**
 * Meta (Facebook) Pixel on a coach's public site. The script is Meta's standard loader, built here from the id:
 * the coach only gives digits, so no code typed by a coach ever runs on the page.
 */
const PIXEL_ID = /^\d{10,20}$/;

let loadedId: string | null = null;

export function loadMetaPixel(pixelId: string | null | undefined): void {
  const id = (pixelId || '').trim();
  if (!PIXEL_ID.test(id) || loadedId === id) return;
  const w = window as any;

  if (!w.fbq) {
    const fbq: any = function (...args: any[]) {
      fbq.callMethod ? fbq.callMethod(...args) : fbq.queue.push(args);
    };
    if (!w._fbq) w._fbq = fbq;
    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = '2.0';
    fbq.queue = [];
    w.fbq = fbq;

    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://connect.facebook.net/en_US/fbevents.js';
    document.head.appendChild(script);
  }

  w.fbq('init', id);
  w.fbq('track', 'PageView');
  loadedId = id;
}

/** Standard event (Lead, Contact…); nothing happens when the site has no pixel. */
export function trackMetaPixelEvent(event: string): void {
  const w = window as any;
  if (loadedId && typeof w.fbq === 'function') w.fbq('track', event);
}
