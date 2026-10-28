/**
 * Look of a coach website, chosen piece by piece. A preset only fills these values in: the coach can then change
 * any of them (layout, fonts, corners, colors, order of the sections) and get a site that looks like no other.
 * Mirrors `WebsiteDesign` on the API: the words accepted here are the ones it validates.
 */
export type HeroLayout = 'split' | 'centered' | 'cover' | 'card';
export type FontPairing = 'modern' | 'editorial' | 'bold' | 'friendly' | 'classic';
export type Radius = 'sharp' | 'soft' | 'round';
export type ButtonStyle = 'square' | 'rounded' | 'pill';
export type SiteMode = 'light' | 'dark';
export type HeroBackground = 'solid' | 'gradient' | 'image';
export type SectionKey = 'video' | 'about' | 'stats' | 'services' | 'results' | 'certificates' | 'testimonials' | 'contact';

export interface WebsiteDesign {
  layout: HeroLayout;
  font: FontPairing;
  radius: Radius;
  buttonStyle: ButtonStyle;
  mode: SiteMode;
  heroBackground: HeroBackground;
  heroImage: string;
  sectionOrder: SectionKey[];
  hiddenSections: SectionKey[];
}

export interface SiteColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
  announcementBg: string;
  announcementText: string;
}

export interface SocialLinks {
  instagram: string;
  facebook: string;
  tiktok: string;
  youtube: string;
  linkedin: string;
  whatsapp: string;
}

export interface StatItem {
  value: string;
  label: string;
}

export interface ThemePreset {
  /** Stored as `themeKey`; also the id of the preset. */
  key: string;
  name: string;
  /** i18n key of the one-line description. */
  description: string;
  tags: string[];
  design: Omit<WebsiteDesign, 'heroImage' | 'sectionOrder' | 'hiddenSections'>;
  colors: SiteColors;
}

/** Order of the page when the coach has not moved anything; the contact form is always last by default. */
export const SECTION_KEYS: SectionKey[] = ['video', 'about', 'stats', 'services', 'results', 'certificates', 'testimonials', 'contact'];

export const DEFAULT_DESIGN: WebsiteDesign = {
  layout: 'split',
  font: 'modern',
  radius: 'soft',
  buttonStyle: 'rounded',
  mode: 'light',
  heroBackground: 'solid',
  heroImage: '',
  sectionOrder: [...SECTION_KEYS],
  hiddenSections: [],
};

export const EMPTY_SOCIAL_LINKS: SocialLinks = { instagram: '', facebook: '', tiktok: '', youtube: '', linkedin: '', whatsapp: '' };

/** Google Fonts pairings; the stacks keep the page readable while the fonts load (or offline). */
export const FONT_PAIRINGS: Record<FontPairing, { heading: string; body: string; families: string[] }> = {
  modern: { heading: "'Inter', 'Segoe UI', Roboto, sans-serif", body: "'Inter', 'Segoe UI', Roboto, sans-serif", families: ['Inter:wght@400;500;600;700;800'] },
  editorial: { heading: "'Playfair Display', Georgia, serif", body: "'Source Sans 3', 'Segoe UI', sans-serif", families: ['Playfair+Display:wght@500;600;700', 'Source+Sans+3:wght@400;600'] },
  bold: { heading: "'Montserrat', 'Segoe UI', sans-serif", body: "'Inter', 'Segoe UI', sans-serif", families: ['Montserrat:wght@700;800;900', 'Inter:wght@400;500;600'] },
  friendly: { heading: "'Nunito', 'Segoe UI', sans-serif", body: "'Nunito', 'Segoe UI', sans-serif", families: ['Nunito:wght@400;600;700;800'] },
  classic: { heading: "'Cormorant Garamond', Georgia, serif", body: "'Lato', 'Segoe UI', sans-serif", families: ['Cormorant+Garamond:wght@600;700', 'Lato:wght@400;700'] },
};

export const THEME_PRESETS: ThemePreset[] = [
  {
    key: 'studio', name: 'Studio', description: 'WB_PRESET_STUDIO', tags: ['fitness', 'business'],
    design: { layout: 'split', font: 'modern', radius: 'soft', buttonStyle: 'rounded', mode: 'light', heroBackground: 'solid' },
    colors: { primary: '#0f172a', secondary: '#eef2f7', accent: '#2563eb', background: '#ffffff', text: '#0f172a', announcementBg: '#0f172a', announcementText: '#ffffff' },
  },
  {
    key: 'editorial', name: 'Éditorial', description: 'WB_PRESET_EDITORIAL', tags: ['mindset', 'premium'],
    design: { layout: 'centered', font: 'editorial', radius: 'sharp', buttonStyle: 'square', mode: 'light', heroBackground: 'solid' },
    colors: { primary: '#1c1917', secondary: '#f3ede3', accent: '#b45309', background: '#fffdf9', text: '#1c1917', announcementBg: '#1c1917', announcementText: '#fffdf9' },
  },
  {
    key: 'noir', name: 'Noir', description: 'WB_PRESET_NOIR', tags: ['performance', 'dark'],
    design: { layout: 'cover', font: 'bold', radius: 'round', buttonStyle: 'pill', mode: 'dark', heroBackground: 'gradient' },
    colors: { primary: '#111827', secondary: '#1b2232', accent: '#f59e0b', background: '#0b0f19', text: '#e5e7eb', announcementBg: '#f59e0b', announcementText: '#0b0f19' },
  },
  {
    key: 'energy', name: 'Énergie', description: 'WB_PRESET_ENERGY', tags: ['sport', 'motivation'],
    design: { layout: 'split', font: 'bold', radius: 'round', buttonStyle: 'pill', mode: 'light', heroBackground: 'solid' },
    colors: { primary: '#111827', secondary: '#fff1ec', accent: '#f04e23', background: '#ffffff', text: '#111827', announcementBg: '#f04e23', announcementText: '#ffffff' },
  },
  {
    key: 'nature', name: 'Nature', description: 'WB_PRESET_NATURE', tags: ['nutrition', 'wellbeing'],
    design: { layout: 'centered', font: 'friendly', radius: 'round', buttonStyle: 'pill', mode: 'light', heroBackground: 'gradient' },
    colors: { primary: '#2f5d50', secondary: '#e8f3ec', accent: '#d97706', background: '#fbfdfb', text: '#243b35', announcementBg: '#2f5d50', announcementText: '#ffffff' },
  },
  {
    key: 'prestige', name: 'Prestige', description: 'WB_PRESET_PRESTIGE', tags: ['executive', 'B2B'],
    design: { layout: 'card', font: 'classic', radius: 'sharp', buttonStyle: 'square', mode: 'light', heroBackground: 'solid' },
    colors: { primary: '#10233f', secondary: '#edf2f7', accent: '#b7791f', background: '#f7fafc', text: '#1f2937', announcementBg: '#10233f', announcementText: '#ffffff' },
  },
  {
    key: 'minimal', name: 'Minimal', description: 'WB_PRESET_MINIMAL', tags: ['simple', 'clean'],
    design: { layout: 'centered', font: 'modern', radius: 'soft', buttonStyle: 'rounded', mode: 'light', heroBackground: 'solid' },
    colors: { primary: '#18181b', secondary: '#f4f4f5', accent: '#18181b', background: '#ffffff', text: '#27272a', announcementBg: '#18181b', announcementText: '#ffffff' },
  },
  {
    key: 'ocean', name: 'Océan', description: 'WB_PRESET_OCEAN', tags: ['running', 'online'],
    design: { layout: 'cover', font: 'modern', radius: 'soft', buttonStyle: 'rounded', mode: 'light', heroBackground: 'gradient' },
    colors: { primary: '#0c4a6e', secondary: '#e0f2fe', accent: '#0ea5e9', background: '#ffffff', text: '#0f172a', announcementBg: '#0c4a6e', announcementText: '#ffffff' },
  },
  {
    key: 'violet', name: 'Nuit', description: 'WB_PRESET_VIOLET', tags: ['yoga', 'dark'],
    design: { layout: 'split', font: 'friendly', radius: 'round', buttonStyle: 'pill', mode: 'dark', heroBackground: 'gradient' },
    colors: { primary: '#1f1744', secondary: '#241b4d', accent: '#a78bfa', background: '#140f2d', text: '#ece9fb', announcementBg: '#a78bfa', announcementText: '#140f2d' },
  },
  {
    key: 'terracotta', name: 'Terracotta', description: 'WB_PRESET_TERRACOTTA', tags: ['pilates', 'warm'],
    design: { layout: 'card', font: 'editorial', radius: 'soft', buttonStyle: 'rounded', mode: 'light', heroBackground: 'solid' },
    colors: { primary: '#7c2d12', secondary: '#fdf2ec', accent: '#c2410c', background: '#fffaf7', text: '#292524', announcementBg: '#7c2d12', announcementText: '#fffaf7' },
  },
];

/** Sites saved before the design options existed only have the old theme key: the closest design is used. */
export function designFromLegacyTheme(themeKey?: string): WebsiteDesign {
  const byKey: Record<string, Partial<WebsiteDesign>> = {
    elegance: { layout: 'centered', font: 'editorial', radius: 'soft', buttonStyle: 'square' },
    dynamic: { layout: 'split', font: 'bold', radius: 'round', buttonStyle: 'pill' },
    trust: { layout: 'card', font: 'classic', radius: 'soft', buttonStyle: 'rounded' },
    serenity: { layout: 'centered', font: 'friendly', radius: 'round', buttonStyle: 'pill', heroBackground: 'gradient' },
  };
  return { ...DEFAULT_DESIGN, sectionOrder: [...SECTION_KEYS], hiddenSections: [], ...(byKey[themeKey || ''] || {}) };
}

/** A complete design from whatever was saved (missing or unknown values fall back to the defaults). */
export function normalizeDesign(raw: Partial<WebsiteDesign> | null | undefined, themeKey?: string): WebsiteDesign {
  const base = raw ? { ...DEFAULT_DESIGN, ...raw } : designFromLegacyTheme(themeKey);
  const pick = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
    (allowed as readonly string[]).includes(value as string) ? (value as T) : fallback;
  const order = Array.isArray(base.sectionOrder) ? base.sectionOrder.filter((k): k is SectionKey => SECTION_KEYS.includes(k)) : [];
  const hidden = Array.isArray(base.hiddenSections) ? base.hiddenSections.filter((k): k is SectionKey => SECTION_KEYS.includes(k) && k !== 'contact') : [];
  return {
    layout: pick(base.layout, ['split', 'centered', 'cover', 'card'] as const, 'split'),
    font: pick(base.font, ['modern', 'editorial', 'bold', 'friendly', 'classic'] as const, 'modern'),
    radius: pick(base.radius, ['sharp', 'soft', 'round'] as const, 'soft'),
    buttonStyle: pick(base.buttonStyle, ['square', 'rounded', 'pill'] as const, 'rounded'),
    mode: pick(base.mode, ['light', 'dark'] as const, 'light'),
    heroBackground: pick(base.heroBackground, ['solid', 'gradient', 'image'] as const, 'solid'),
    heroImage: typeof base.heroImage === 'string' ? base.heroImage : '',
    sectionOrder: [...order, ...SECTION_KEYS.filter((k) => !order.includes(k))],
    hiddenSections: Array.from(new Set(hidden)),
  };
}

/** Loads the Google Fonts of a pairing once per page; nothing happens when they are already requested. */
export function ensureWebsiteFontsLoaded(font: FontPairing): void {
  if (typeof document === 'undefined') return;
  const pairing = FONT_PAIRINGS[font] || FONT_PAIRINGS.modern;
  const id = `yc-font-${font}`;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?${pairing.families.map((f) => `family=${f}`).join('&')}&display=swap`;
  document.head.appendChild(link);
}

/** White or near-black, whichever reads better on the given hex color. */
export function readableTextOn(hex: string | undefined, dark = '#111827', light = '#ffffff'): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return dark;
  const [r, g, b] = rgb.map((c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  // Black reads better above ~0.18; the threshold is kept a bit higher so warm CTA colors keep white text.
  return luminance > 0.3 ? dark : light;
}

export function hexToRgb(hex: string | undefined): [number, number, number] | null {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec((hex || '').trim());
  if (!match) return null;
  let value = match[1];
  if (value.length === 3) value = value.split('').map((c) => c + c).join('');
  const n = parseInt(value, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** "Sami Ben Ali" → "SB"; "?" when there is no name yet. */
export function initialsOf(name: string | undefined): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return parts.slice(0, 2).map((p) => p.charAt(0)).join('').toUpperCase();
}

/** wa.me link from a phone number typed with spaces, dots or a leading +. */
export function whatsappLink(phone: string | undefined): string {
  const digits = (phone || '').replace(/[^0-9]/g, '');
  return digits ? `https://wa.me/${digits}` : '';
}
