// Dark version of a coach's app theme. Same rules as yo-coach-mobile lib/core/theme/dark_palette.dart:
// the coach's brand colors stay (primary, status colors), the neutrals become dark surfaces lightly
// tinted with the primary hue, so a client in dark mode still sees their coach's identity.

type Rgb = [number, number, number];

const toLin = (c: number) => {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};
const fromLin = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055) * 255;

export function parseHexColor(value: string | null | undefined): Rgb | null {
  const hex = (value ?? '').trim().replace(/#/g, '');
  if (/^[0-9a-f]{6}$/i.test(hex)) return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
  // #AARRGGBB (mobile format): the alpha is dropped.
  if (/^[0-9a-f]{8}$/i.test(hex)) return [2, 4, 6].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
  return null;
}

export function toHex([r, g, b]: Rgb): string {
  return '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
}

/** [L 0..1, C, h degrees] */
export function rgbToOklch(rgb: Rgb): [number, number, number] {
  const [r, g, b] = rgb.map(toLin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return [L, Math.hypot(A, B), ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360];
}

function oklchRaw(L: number, C: number, h: number): Rgb {
  const A = C * Math.cos((h * Math.PI) / 180);
  const B = C * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

/** Out-of-gamut colors keep their lightness and hue, with less chroma. */
export function oklchToRgb(L: number, C: number, h: number): Rgb {
  const inGamut = (v: Rgb) => v.every((x) => x >= -0.0005 && x <= 1.0005);
  let rgb = oklchRaw(L, C, h);
  if (!inGamut(rgb)) {
    let lo = 0;
    let hi = C;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(oklchRaw(L, mid, h))) lo = mid;
      else hi = mid;
    }
    rgb = oklchRaw(L, lo, h);
  }
  return rgb.map((v) => Math.min(255, Math.max(0, fromLin(Math.min(1, Math.max(0, v)))))) as Rgb;
}

const mix = (a: Rgb, b: Rgb, amountOfA: number): Rgb =>
  a.map((v, i) => v * amountOfA + b[i] * (1 - amountOfA)) as Rgb;

const luminance = (rgb: Rgb) => {
  const [r, g, b] = rgb.map(toLin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const contrast = (a: Rgb, b: Rgb) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

/** A theme whose background is already dark is shown as the coach made it. */
export function isDarkTheme(colors: Record<string, string | undefined | null>): boolean {
  const bg = parseHexColor(colors['background']);
  return !!bg && rgbToOklch(bg)[0] < 0.45;
}

const DEFAULT_PRIMARY: Rgb = [0x0c, 0x86, 0xc8];

/**
 * Dark colors from the light theme (keys of AppThemeColors / AppColors). Missing keys use the YoCoach defaults.
 */
export function darkThemeColors(colors: Record<string, string | undefined | null>): Record<string, string> {
  if (isDarkTheme(colors)) {
    const kept: Record<string, string> = {};
    for (const [key, value] of Object.entries(colors)) {
      const rgb = parseHexColor(value ?? '');
      if (rgb) kept[key] = toHex(rgb);
    }
    return kept;
  }

  let primary = parseHexColor(colors['primary']) ?? DEFAULT_PRIMARY;
  const [pL, pC, hue] = rgbToOklch(primary);
  // A very dark or very light brand color would disappear on dark surfaces.
  if (pL < 0.5) primary = oklchToRgb(0.62, Math.max(pC, 0.02), hue);
  else if (pL > 0.9) primary = oklchToRgb(0.82, pC, hue);
  const tint = pC < 0.02 ? 0.004 : 0.009;
  const neutral = (L: number, C = tint) => oklchToRgb(L, C, hue);

  const surface = neutral(0.245);
  let buttonText = parseHexColor(colors['buttonText']) ?? [255, 255, 255];
  if (contrast(primary, buttonText) < 3) {
    buttonText = contrast(primary, [255, 255, 255]) >= contrast(primary, [15, 18, 22]) ? [255, 255, 255] : [15, 18, 22];
  }

  const status = (key: string, fallback: Rgb): Rgb => {
    const rgb = parseHexColor(colors[key]) ?? fallback;
    const [L, C, h] = rgbToOklch(rgb);
    return L < 0.62 ? oklchToRgb(0.66, C, h) : rgb;
  };
  const success = status('success', [0x22, 0xc5, 0x5e]);
  const error = status('error', [0xef, 0x44, 0x44]);
  const warning = status('warning', [0xf5, 0x9e, 0x0b]);

  const out: Record<string, Rgb> = {
    primary,
    secondary: neutral(0.94, 0.006),
    background: neutral(0.2),
    surface,
    card: surface,
    cardSurface: neutral(0.225),
    textPrimary: neutral(0.94, 0.006),
    textSecondary: neutral(0.76),
    textHint: neutral(0.63),
    success,
    successLight: mix(success, surface, 0.16),
    error,
    errorLight: mix(error, surface, 0.16),
    warning,
    warningLight: mix(warning, surface, 0.16),
    border: neutral(0.34, tint + 0.002),
    divider: neutral(0.31),
    disabled: neutral(0.45),
    dragHandle: neutral(0.42),
    emptyStateBg: neutral(0.225),
    buttonText,
    selectedTabBg: mix(primary, surface, 0.2),
    activeBg: neutral(0.4, Math.max(tint, 0.03)),
    headerStart: neutral(0.18),
    headerMid: neutral(0.2),
    headerEnd: neutral(0.22),
  };
  return Object.fromEntries(Object.entries(out).map(([key, rgb]) => [key, toHex(rgb)]));
}
