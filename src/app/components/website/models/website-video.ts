/**
 * Embed URL of a YouTube or Vimeo link, or '' for anything else: the website only ever frames these two players, so a
 * coach cannot point the page's iframe at an arbitrary site.
 */
export function toWebsiteVideoEmbedUrl(url: string | null | undefined): string {
  const value = (url || '').trim();
  if (!value) return '';
  let parsed: URL;
  try {
    parsed = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    return '';
  }
  const host = parsed.hostname.toLowerCase().replace(/^(www\.|m\.)/, '');
  const id = /^[A-Za-z0-9_-]{6,20}$/;

  if (host === 'youtu.be') {
    const videoId = parsed.pathname.split('/').filter(Boolean)[0] || '';
    return id.test(videoId) ? `https://www.youtube.com/embed/${videoId}` : '';
  }
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const parts = parsed.pathname.split('/').filter(Boolean);
    const videoId = parsed.searchParams.get('v')
      || (['embed', 'shorts', 'live'].includes(parts[0]) ? parts[1] : '') || '';
    return id.test(videoId) ? `https://www.youtube.com/embed/${videoId}` : '';
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const videoId = parsed.pathname.split('/').filter(Boolean).find((part) => /^\d+$/.test(part)) || '';
    return videoId ? `https://player.vimeo.com/video/${videoId}` : '';
  }
  return '';
}
