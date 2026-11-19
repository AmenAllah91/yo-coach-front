import { Exercise, ExerciseSet } from './exercice.models';

/**
 * Superset et circuit.
 *
 * Un groupe = des exercices qui se suivent avec le même `supersetGroupId`.
 * - superset : 2-3 exercices enchaînés, compte en séries (une série = A puis B), repos après le groupe ;
 * - circuit : plusieurs exercices en boucle, compte en tours (un tour = tous les exercices), repos entre les tours.
 * Tous les exercices d'un groupe ont le même nombre de séries, le même type et le même repos de groupe.
 */
export type GroupType = 'SUPERSET' | 'CIRCUIT';
export type Measure = 'REPS' | 'TIME';

export const SUPERSET_MAX = 3;
const DEFAULT_REST: Record<GroupType, number> = { SUPERSET: 90, CIRCUIT: 60 };

export function groupTypeOf(ex: Exercise | null | undefined): GroupType {
  return String(ex?.groupType || '').toUpperCase() === 'CIRCUIT' ? 'CIRCUIT' : 'SUPERSET';
}

export function measureOf(ex: Exercise | null | undefined): Measure {
  return String(ex?.measure || '').toUpperCase() === 'TIME' ? 'TIME' : 'REPS';
}

export function isCircuit(ex: Exercise | null | undefined): boolean {
  return !!ex?.supersetGroupId && groupTypeOf(ex) === 'CIRCUIT';
}

// ---------- Échauffement ----------
// Pas de champ en plus : un exercice d'échauffement est un exercice seul dont toutes les séries sont de type WARM_UP.
// Le bloc « Échauffement » de la séance = les exercices d'échauffement placés tout en haut, à la suite.

export function isWarmupSetType(type: unknown): boolean {
  const value = String(type ?? '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  return value === 'W' || value === 'WARMUP' || value === 'WARM_UP';
}

export function isWarmupExercise(ex: { supersetGroupId?: string | null; sets?: { type?: unknown }[] | null } | null | undefined): boolean {
  const sets = ex?.sets || [];
  return !ex?.supersetGroupId && sets.length > 0 && sets.every((s) => isWarmupSetType(s?.type));
}

/** Nombre d'exercices du bloc « Échauffement » (0 = pas de bloc). */
export function warmupCount(list: Parameters<typeof isWarmupExercise>[0][] | null | undefined): number {
  const all = list || [];
  let n = 0;
  while (n < all.length && isWarmupExercise(all[n])) n += 1;
  return n;
}

/** Index de début et de fin du groupe qui contient l'exercice `index` (lui seul s'il n'est pas groupé). */
export function groupBounds(list: Exercise[], index: number): { start: number; end: number } {
  const id = list[index]?.supersetGroupId;
  if (!id) return { start: index, end: index };
  let start = index;
  let end = index;
  while (start > 0 && list[start - 1]?.supersetGroupId === id) start -= 1;
  while (end < list.length - 1 && list[end + 1]?.supersetGroupId === id) end += 1;
  return { start, end };
}

export function groupMembers(list: Exercise[], index: number): Exercise[] {
  if (!list[index]?.supersetGroupId) return [];
  const { start, end } = groupBounds(list, index);
  return list.slice(start, end + 1);
}

export function isGroupStart(list: Exercise[], index: number): boolean {
  const id = list[index]?.supersetGroupId;
  return !!id && list[index - 1]?.supersetGroupId !== id;
}

export function isGroupEnd(list: Exercise[], index: number): boolean {
  const id = list[index]?.supersetGroupId;
  return !!id && list[index + 1]?.supersetGroupId !== id;
}

/** Nombre de séries (superset) ou de tours (circuit) du groupe. */
export function groupCount(members: Exercise[]): number {
  return Math.max(1, ...members.map((m) => m.sets?.length || 0));
}

/** Repos de groupe, ou celui des anciennes séances (repos de la 1re série du dernier exercice). */
export function groupRest(members: Exercise[]): number {
  const first = members[0];
  if (first?.groupRestSec != null) return first.groupRestSec;
  const last = members[members.length - 1]?.sets?.[0];
  if (last && (last.restMin || last.restSec)) return (last.restMin || 0) * 60 + (last.restSec || 0);
  return DEFAULT_REST[groupTypeOf(first)];
}

/** Lettre (superset : A, B) ou numéro (circuit : 1, 2) d'un exercice dans son groupe. */
export function memberLabel(list: Exercise[], index: number): string {
  const { start } = groupBounds(list, index);
  const pos = index - start;
  return groupTypeOf(list[index]) === 'CIRCUIT' ? String(pos + 1) : String.fromCharCode(65 + pos);
}

function copySet(s: ExerciseSet | undefined, setNumber: number): ExerciseSet {
  return { ...(s || { reps: '10', weight: null, type: 'REGULAR' }), setNumber, restMin: s?.restMin ?? 0, restSec: s?.restSec ?? 0 };
}

/** Donne à tous les exercices du groupe le même type, le même repos et le même nombre de séries (sans en retirer). */
export function syncGroup(members: Exercise[], type?: GroupType): void {
  if (!members.length) return;
  const t = type || groupTypeOf(members[0]);
  const rest = groupRest(members);
  const count = groupCount(members);
  members.forEach((m) => {
    m.groupType = t;
    m.groupRestSec = rest;
    m.sets = m.sets || [];
    while (m.sets.length < count) m.sets.push(copySet(m.sets[m.sets.length - 1], m.sets.length + 1));
  });
}

/** Change le nombre de séries ou de tours : ajoute une copie de la dernière ligne, ou retire la dernière. */
export function setGroupCount(members: Exercise[], count: number): void {
  const n = Math.max(1, Math.min(20, Math.round(count)));
  members.forEach((m) => {
    m.sets = m.sets || [];
    while (m.sets.length < n) m.sets.push(copySet(m.sets[m.sets.length - 1], m.sets.length + 1));
    m.sets.length = n;
  });
}

export function setGroupRest(members: Exercise[], seconds: number): void {
  const rest = Math.max(0, Math.min(3600, Math.round(Number(seconds) || 0)));
  members.forEach((m) => (m.groupRestSec = rest));
}

export function ungroup(members: Exercise[]): void {
  const rest = groupRest(members);
  members.forEach((m) => {
    m.supersetGroupId = null;
    m.groupType = null;
    m.groupRestSec = null;
    (m.sets || []).forEach((s) => {
      s.restMin = Math.floor(rest / 60);
      s.restSec = rest % 60;
    });
  });
}

/** Valeur principale d'une série : reps, ou secondes si l'exercice est au temps. */
export function setValue(ex: Exercise, s: ExerciseSet | undefined): number | null {
  if (!s) return null;
  if (measureOf(ex) === 'TIME') return s.durationSec ?? null;
  const n = parseInt(String(s.reps ?? ''), 10);
  return Number.isFinite(n) ? n : null;
}

export function writeSetValue(ex: Exercise, s: ExerciseSet, value: number | null): void {
  if (measureOf(ex) === 'TIME') s.durationSec = value == null ? null : Math.max(1, Math.round(value));
  else s.reps = value == null ? '' : String(Math.max(0, Math.round(value)));
}

/** Toutes les séries ont la même valeur et le même poids : on peut les afficher sur une seule ligne. */
export function isUniform(ex: Exercise): boolean {
  const sets = ex.sets || [];
  if (sets.length < 2) return true;
  const v = setValue(ex, sets[0]);
  const w = sets[0].weight ?? null;
  return sets.every((s) => setValue(ex, s) === v && (s.weight ?? null) === w);
}

/** Recopie la 1re série sur toutes les autres (lien « Même valeur partout »). */
export function flattenSets(ex: Exercise): void {
  const first = ex.sets?.[0];
  if (!first) return;
  ex.sets!.forEach((s) => {
    writeSetValue(ex, s, setValue(ex, first));
    s.weight = first.weight ?? null;
  });
}

/** Poids de la 1re série + `step` à chaque série suivante. */
export function progressWeight(ex: Exercise, step: number): void {
  const base = Number(ex.sets?.[0]?.weight) || 0;
  (ex.sets || []).forEach((s, i) => (s.weight = Math.round((base + step * i) * 10) / 10));
}

export function changeMeasure(ex: Exercise, measure: Measure): void {
  if (measureOf(ex) === measure) return;
  ex.measure = measure === 'TIME' ? 'TIME' : null;
  (ex.sets || []).forEach((s) => {
    if (measure === 'TIME') {
      s.durationSec = s.durationSec || 30;
    } else if (!s.reps) {
      s.reps = '12';
    }
  });
}

/** Texte court d'un exercice de groupe : « 15 reps », « 30 s », « 12 / 10 / 8 reps · 50 / 60 / 70 kg ». */
export function setsSummary(ex: Exercise, weightUnit = 'kg'): string {
  const sets = ex.sets || [];
  if (!sets.length) return '';
  const unit = measureOf(ex) === 'TIME' ? 's' : 'reps';
  const values = sets.map((s) => setValue(ex, s) ?? 0);
  const weights = sets.map((s) => Number(s.weight) || 0);
  const same = (a: number[]) => a.every((x) => x === a[0]);
  const v = same(values) ? `${values[0]}` : values.join(' / ');
  const w = weights.some((x) => x > 0) ? ` · ${same(weights) ? weights[0] : weights.join(' / ')} ${weightUnit}` : '';
  return `${v} ${unit}${w}`;
}

// ---------- Déplacer (glisser-déposer et flèches ↑ ↓ des groupes) ----------

/** Les groupes coupés en morceaux (leurs exercices ne se suivent pas). */
function splitGroups(list: Exercise[]): Set<string> {
  const seen = new Set<string>();
  const split = new Set<string>();
  list.forEach((ex, index) => {
    const id = ex.supersetGroupId;
    if (!id) return;
    if (seen.has(id) && list[index - 1]?.supersetGroupId !== id) split.add(id);
    seen.add(id);
  });
  return split;
}

/**
 * Le glisser de l'exercice `from` vers la place `to` est-il permis ?
 * - les groupes restent entiers : on peut changer l'ordre à l'intérieur d'un groupe,
 *   mais pas faire entrer un exercice seul dans un groupe ni en faire sortir un membre ;
 * - un exercice du bloc « Échauffement » reste dans ce bloc, les autres restent en dessous.
 */
export function canMoveExercise(list: Exercise[], from: number, to: number): boolean {
  if (from === to || from < 0 || from >= list.length || to < 0 || to >= list.length) return false;
  const item = list[from];
  const inWarmup = from < warmupCount(list);
  const simulated = [...list];
  simulated.splice(from, 1);
  const warmupLeft = warmupCount(simulated);
  if (inWarmup ? to > warmupLeft : to < warmupLeft) return false;
  simulated.splice(to, 0, item);
  // Un déplacement ne change pas la taille des groupes : il suffit qu'aucun groupe ne soit coupé.
  // (Un groupe déjà coupé dans d'anciennes données ne bloque pas tout le reste.)
  const before = splitGroups(list);
  return [...splitGroups(simulated)].every((id) => before.has(id));
}

/** Flèche ↑ / ↓ d'un groupe : il passe au-dessus (ou en dessous) de l'exercice ou du groupe voisin. Jamais dans l'échauffement. */
export function canMoveGroup(list: Exercise[], index: number, direction: -1 | 1): boolean {
  if (!list[index]?.supersetGroupId) return false;
  const { start, end } = groupBounds(list, index);
  return direction < 0 ? start - 1 >= warmupCount(list) : end + 1 < list.length;
}

/** Déplace tout le groupe d'un cran. Renvoie false si ce n'est pas possible. */
export function moveGroup(list: Exercise[], index: number, direction: -1 | 1): boolean {
  if (!canMoveGroup(list, index, direction)) return false;
  const { start, end } = groupBounds(list, index);
  const block = list.splice(start, end - start + 1);
  if (direction < 0) {
    const prev = groupBounds(list, start - 1);
    list.splice(prev.start, 0, ...block);
  } else {
    const next = groupBounds(list, start);
    list.splice(next.end + 1, 0, ...block);
  }
  return true;
}
