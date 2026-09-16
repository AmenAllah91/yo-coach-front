export function youtubeVideoId(value: string): string {
  try {
    const url = new URL(value.trim());
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port) return '';
    const parts = url.pathname.split('/').filter(Boolean);
    let id = '';
    if (url.hostname === 'youtu.be' && parts.length === 1) id = parts[0];
    if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com'].includes(url.hostname)) {
      if (url.pathname === '/watch') id = url.searchParams.get('v') || '';
      else if (parts.length === 2 && ['embed', 'shorts', 'live'].includes(parts[0])) id = parts[1];
    }
    return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : '';
  } catch { return ''; }
}

export function exerciseErrors(input: {
  name: string; type: string; equipment: string; muscle: string;
  description: string; youtube: string; hasVideo: boolean; existingNames: string[];
}): Record<string, string> {
  const errors: Record<string, string> = {};
  const name = input.name.trim();
  if (!name) errors['name'] = 'EX_VALID_NAME_REQUIRED';
  else if (Array.from(name).length > 100) errors['name'] = 'EX_VALID_NAME_LENGTH';
  else if (input.existingNames.some(n => n.trim().toLowerCase() === name.toLowerCase())) errors['name'] = 'EX_VALID_DUPLICATE';
  for (const field of ['type', 'equipment', 'muscle'] as const) {
    if (!input[field].trim()) errors[field] = 'EX_VALID_REQUIRED';
  }
  if (Array.from(input.description).length > 1000) errors['description'] = 'EX_VALID_DESCRIPTION_LENGTH';
  if (input.youtube.trim() && !youtubeVideoId(input.youtube)) errors['youtube'] = 'EX_VALID_YOUTUBE';
  if (input.hasVideo && input.youtube.trim()) {
    errors['youtube'] = 'EX_VALID_VIDEO_EXCLUSIVE';
    errors['video'] = 'EX_VALID_VIDEO_EXCLUSIVE';
  }
  return errors;
}

export function exerciseMediaError(file: { name: string; type: string; size: number }, kind: 'image' | 'video'): string {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  const types = kind === 'image' ? ['jpg', 'jpeg', 'png', 'webp'] : ['mp4'];
  const mimeTypes = kind === 'image' ? ['image/jpeg', 'image/png', 'image/webp'] : ['video/mp4'];
  if (!types.includes(extension) || (file.type && !mimeTypes.includes(file.type))) return kind === 'image' ? 'EX_VALID_IMAGE_TYPE' : 'EX_VALID_VIDEO_TYPE';
  if (file.size > (kind === 'image' ? 10 : 100) * 1024 * 1024) return kind === 'image' ? 'EX_VALID_IMAGE_SIZE' : 'EX_VALID_VIDEO_SIZE';
  return '';
}
