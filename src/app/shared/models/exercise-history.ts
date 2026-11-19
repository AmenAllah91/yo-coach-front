/**
 * Ce qu'un client a vraiment fait, exercice par exercice, au fil du temps (CE ExerciseHistoryService) :
 * la progression pour le coach, et « la dernière fois » dans l'éditeur de séance.
 */

export type ExerciseMetric = 'WEIGHT' | 'SEC' | 'MIN' | 'REPS';
export type ExerciseDifficulty = 'EASY' | 'GOOD' | 'HARD';

export interface HistorySet {
  setNumber: number | null;
  status: string | null;
  reps: number | null;
  /** kg */
  weight: number | null;
  duration: number | null;
  durationSec: number | null;
  plannedReps: number | null;
  plannedWeight: number | null;
  plannedDuration: number | null;
  plannedDurationSec: number | null;
  /** 1 = 1re fois de l'exercice dans la séance, 2 = le même exercice plus loin (ex. squat lourd puis léger). Absent sur un ancien serveur. */
  occurrence?: number | null;
}

export interface HistorySession {
  /** yyyy-MM-dd */
  date: string;
  planId: string | null;
  dayId: string | null;
  difficulty: ExerciseDifficulty | null;
  note: string | null;
  /** Le chiffre comparé d'une séance à l'autre, dans l'unité de `metric` (kg pour WEIGHT). */
  value: number | null;
  sets: HistorySet[];
}

export interface ExerciseHistory {
  key: string;
  name: string;
  refId: string | null;
  metric: ExerciseMetric;
  /** Muscle principal de la bibliothèque (CHEST, BACK…) ; null pour un exercice écrit à la main. */
  muscle: string | null;
  /** De la plus ancienne à la plus récente. */
  sessions: HistorySession[];
}

/** RECORD : nouveau record (14 derniers jours) ; DOWN : en baisse 2 fois de suite ; STALLED : même chiffre 3 fois ; HARD : « Dur » 2 fois. */
export type ExerciseFlag = 'RECORD' | 'DOWN' | 'STALLED' | 'HARD';

/** Une ligne de la page Progression, sans les séances (un client peut avoir des centaines d'exercices). */
export interface ExerciseSummary {
  key: string;
  name: string;
  refId: string | null;
  metric: ExerciseMetric;
  muscle: string | null;
  /** Nombre de séances gardées (40 au plus). */
  count: number;
  firstDate: string;
  lastDate: string;
  firstValue: number | null;
  lastValue: number | null;
  best: number | null;
  /** Les 8 dernières valeurs, pour la petite courbe. */
  recent: number[];
  /** La dernière séance, entière (« Dernière fois » dans l'éditeur). */
  last: HistorySession;
  flags: ExerciseFlag[];
}

export interface ExerciseSummaryList {
  /** Clés des exercices épinglés par le coach, dans l'ordre. */
  pinned: string[];
  exercises: ExerciseSummary[];
}

/** La clé d'un exercice : son nom en minuscules (le même exercice d'un programme à l'autre). */
/**
 * La séance vue pour le n-ième passage de l'exercice : le 2e squat se compare au 2e squat de la dernière fois.
 * null si ce passage n'existait pas la dernière fois. Sans rang dans les séries (ancien serveur) : la séance entière.
 */
export function sessionForOccurrence(session: HistorySession, occurrence: number): HistorySession | null {
  if (!session.sets.some((set) => set.occurrence != null)) return occurrence === 1 ? session : null;
  const sets = session.sets.filter((set) => (set.occurrence ?? 1) === occurrence);
  return sets.length ? { ...session, sets } : null;
}

export function exerciseHistoryKey(name: string | null | undefined): string {
  return String(name ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export interface HistoryWords {
  fr: boolean;
  /** Un poids en kg, écrit dans l'unité du coach, avec l'unité (« 60 kg », « 132 lbs »). */
  weight: (kg: number) => string;
}

const done = (set: HistorySet) => set.status === 'COMPLETED';

function amount(metric: ExerciseMetric, reps: number | null, duration: number | null, durationSec: number | null): number | null {
  const value = metric === 'SEC' ? durationSec : metric === 'MIN' ? duration : reps;
  return value != null && value > 0 ? value : null;
}

function unit(metric: ExerciseMetric, fr: boolean): string {
  return metric === 'SEC' ? ' s' : metric === 'MIN' ? ' min' : fr ? ' rép.' : ' reps';
}

/** « 60 kg × 12, 10 · 62,5 kg × 9 », ou « 12, 10, 9 rép. » sans poids. */
function line(metric: ExerciseMetric, rows: { weight: number | null; amount: number | null }[], words: HistoryWords): string {
  const weighted = metric === 'WEIGHT';
  const groups: { weight: number | null; amounts: string[] }[] = [];
  rows.forEach(row => {
    const weight = weighted && row.weight != null && row.weight > 0 ? row.weight : null;
    const last = groups[groups.length - 1];
    const text = row.amount != null ? String(row.amount) : '—';
    if (last && last.weight === weight) last.amounts.push(text);
    else groups.push({ weight, amounts: [text] });
  });
  const suffix = weighted ? '' : unit(metric, words.fr);
  return groups.map(group => {
    const amounts = group.amounts.join(', ');
    if (!weighted) return amounts + suffix;
    return group.weight != null ? `${words.weight(group.weight)} × ${amounts}` : `${amounts}${unit('REPS', words.fr)}`;
  }).join(' · ');
}

/** Ce que le client a fait ce jour-là (les séries faites), plus les séries manquées s'il y en a. */
export function sessionDoneLine(session: HistorySession, metric: ExerciseMetric, words: HistoryWords): string {
  const rows = session.sets.filter(done).map(set => ({
    weight: set.weight, amount: amount(metric === 'WEIGHT' ? 'REPS' : metric, set.reps, set.duration, set.durationSec),
  }));
  const missed = session.sets.filter(set => set.status === 'MISSED').length;
  // Séries cochées sans chiffre : « 3 séries faites » plutôt que « —, —, — ».
  const noNumber = rows.every(row => row.amount == null && !(row.weight != null && row.weight > 0));
  const parts: string[] = [];
  if (rows.length) {
    parts.push(noNumber
      ? (words.fr ? `${rows.length} série${rows.length > 1 ? 's' : ''} faite${rows.length > 1 ? 's' : ''}` : `${rows.length} set${rows.length > 1 ? 's' : ''} done`)
      : line(metric, rows, words));
  }
  if (missed) parts.push(words.fr ? `${missed} manquée${missed > 1 ? 's' : ''}` : `${missed} missed`);
  return parts.join(' · ');
}

/**
 * La séance d'un jour, lue dans ce que le client a noté ce jour-là (`clientExerciseLogs` du jour) :
 * même forme que l'historique, pour l'écrire de la même façon. `plannedSets` = les séries du programme (si le log
 * n'a pas gardé le prévu).
 */
export function sessionFromDayLog(log: any, plannedSets: any[], date: string): HistorySession {
  const sets: HistorySet[] = (log?.sets || []).map((set: any, index: number) => {
    const raw = String(set?.status || '').toUpperCase();
    const hasValue = [set?.reps, set?.weight, set?.duration, set?.durationSec].some(value => value != null && Number(value) > 0);
    const status = raw === 'MISSED' || set?.missed === true ? 'MISSED'
      : raw === 'COMPLETED' || raw === 'DONE' || set?.completed === true || (!raw && hasValue) ? 'COMPLETED'
      : 'PENDING';
    const plan = plannedSets?.[index] || {};
    const num = (value: any) => value == null || value === '' || Number.isNaN(Number(value)) ? null : Number(value);
    return {
      setNumber: num(set?.setNumber) ?? index + 1,
      status,
      reps: num(set?.reps),
      weight: num(set?.weight),
      duration: num(set?.duration),
      durationSec: num(set?.durationSec),
      plannedReps: num(set?.plannedReps) ?? num(plan.reps),
      plannedWeight: num(set?.plannedWeight) ?? num(plan.weight),
      plannedDuration: num(set?.plannedDuration) ?? num(plan.duration),
      plannedDurationSec: num(set?.plannedDurationSec) ?? num(plan.durationSec),
    };
  });
  const difficulty = ['EASY', 'GOOD', 'HARD'].includes(log?.difficulty) ? log.difficulty as ExerciseDifficulty : null;
  return { date, planId: null, dayId: null, difficulty, note: log?.note || null, value: null, sets };
}

/** Ce que le coach avait prévu ce jour-là ; null si rien n'était noté. */
export function sessionPlannedLine(session: HistorySession, metric: ExerciseMetric, words: HistoryWords): string | null {
  const rows = session.sets.map(set => ({
    weight: set.plannedWeight,
    amount: amount(metric === 'WEIGHT' ? 'REPS' : metric, set.plannedReps, set.plannedDuration, set.plannedDurationSec),
  }));
  if (!rows.some(row => row.amount != null || (row.weight != null && row.weight > 0))) return null;
  return line(metric, rows, words);
}

/** Le client a fait moins que prévu sur au moins une série (répétitions, temps ou série manquée). */
export function sessionBelowPlan(session: HistorySession, metric: ExerciseMetric): boolean {
  const kind = metric === 'WEIGHT' ? 'REPS' : metric;
  return session.sets.some(set => {
    if (set.status === 'MISSED') return true;
    if (!done(set)) return false;
    const planned = amount(kind, set.plannedReps, set.plannedDuration, set.plannedDurationSec);
    const made = amount(kind, set.reps, set.duration, set.durationSec);
    return planned != null && made != null && made < planned;
  });
}

/** La valeur d'une séance, écrite avec son unité (« 70 kg », « 18 rép. », « 45 s », « 20 min »). */
export function metricText(value: number | null, metric: ExerciseMetric, words: HistoryWords): string {
  if (value == null) return '—';
  if (metric === 'WEIGHT') return words.weight(value);
  return `${Math.round(value)}${unit(metric, words.fr)}`;
}

/** Écart entre la première et la dernière séance qui ont une valeur ; null avec moins de deux séances. */
export function historyDelta(history: ExerciseHistory): number | null {
  const values = history.sessions.map(session => session.value).filter((value): value is number => value != null);
  return values.length < 2 ? null : values[values.length - 1] - values[0];
}

/** La meilleure séance (record). */
export function historyBest(history: ExerciseHistory): number | null {
  const values = history.sessions.map(session => session.value).filter((value): value is number => value != null);
  return values.length ? Math.max(...values) : null;
}

/** Les points d'une courbe dans un cadre `width` × `height` (les séances sans valeur sont sautées). */
export function historyChartPoints(values: (number | null)[], width: number, height: number, pad = 6): { x: number; y: number; value: number; index: number }[] {
  const known = values.map((value, index) => ({ value, index })).filter((item): item is { value: number; index: number } => item.value != null);
  if (!known.length) return [];
  const min = Math.min(...known.map(item => item.value));
  const max = Math.max(...known.map(item => item.value));
  const span = max - min || 1;
  const step = known.length > 1 ? (width - pad * 2) / (known.length - 1) : 0;
  return known.map((item, order) => ({
    x: known.length > 1 ? pad + order * step : width / 2,
    y: max === min ? height / 2 : height - pad - ((item.value - min) / span) * (height - pad * 2),
    value: item.value,
    index: item.index,
  }));
}
