/**
 * 2026-11-13: the base food catalog has a French name ({@code name}) and an English one ({@code nameEn}), and its
 * servings a French label ({@code unit}) and an English one ({@code unitEn}).
 *
 * In English the screens show the English texts in {@code name} / {@code unit}, so no template changes. The French
 * texts are kept in {@code nameFr} / {@code unitFr}: before a food is sent back, {@link toServerLanguage} puts them
 * back, and what was typed in English goes to the English fields.
 */

/** The language of the app ('fr' when unknown; Arabic shows the French names). */
export function appLanguage(): string {
  try {
    return localStorage.getItem('lang') === 'en' ? 'en' : 'fr';
  } catch {
    return 'fr';
  }
}

export function localizeFood<T>(food: T, lang: string = appLanguage()): T {
  const f: any = food;
  if (!f || lang !== 'en' || f.nameFr !== undefined) return food; // French, or already done
  const servings = Array.isArray(f.servings)
    ? f.servings.map((s: any) => (s?.unitEn ? { ...s, unitFr: s.unit, unit: s.unitEn } : s))
    : f.servings;
  const localized: any = { ...f, servings };
  if (f.nameEn) {
    localized.nameFr = f.name;
    localized.name = f.nameEn;
  }
  const main = Array.isArray(servings) ? servings.find((s: any) => s?.id && s.id === f.defaultServingId) : null;
  if (main?.unitFr !== undefined && f.servingDescription === main.unitFr) localized.servingDescription = main.unit;
  return localized as T;
}

export function toServerLanguage<T>(food: T): T {
  const f: any = food;
  if (!f) return food;
  const out: any = { ...f };
  if (f.nameFr !== undefined) {
    out.nameEn = f.name;
    out.name = f.nameFr;
    delete out.nameFr;
  }
  if (Array.isArray(f.servings)) {
    out.servings = f.servings.map((s: any) => {
      if (!s || s.unitFr === undefined) return s;
      const { unitFr, ...rest } = s;
      return { ...rest, unitEn: s.unit, unit: unitFr };
    });
  }
  return out as T;
}
