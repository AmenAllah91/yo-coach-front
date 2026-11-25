import { allExercises, isRestDay } from './client-plan-utils';

/**
 * What the workout program PDF shows (audit PDF/Excel 2026-11-23, lot 4), worked out once, in plain data:
 * - the warm-up in its own block, never numbered with the working sets;
 * - a superset (« 2A, 2B ») and a circuit (« Circuit · 3 tours · 90 s entre les tours ») titled as such;
 * - a timed set in seconds (« 45 s », « 1 min 30 »), never « — »;
 * - a day without exercise that is not a rest day says « À compléter », not « Repos ».
 */
export interface PdfSetRow { label: string; value: string; weight: string; rest: string; warmup: boolean; }
export interface PdfExercise { label: string; name: string; note: string; measure: 'REPS' | 'TIME' | 'CARDIO'; rows: PdfSetRow[]; }
export interface PdfBlock { kind: 'SINGLE' | 'SUPERSET' | 'CIRCUIT'; title: string; exercises: PdfExercise[]; }
export interface PdfDay {
  date: Date;
  title: string;
  state: 'WORKOUT' | 'REST' | 'EMPTY';
  note: string;
  warmup: PdfExercise[];
  blocks: PdfBlock[];
}

export interface WorkoutPdfOptions {
  fr: boolean;
  dateOf: (day: any) => Date;
  /** The weight as the client reads it (kg or lbs), '' when none. */
  weight: (kg: number) => string;
  showWeight: boolean;
}

const WARM = new Set(['W', 'WARMUP', 'WARM_UP']);

function isWarmupSet(set: any): boolean {
  return WARM.has(String(set?.type || '').trim().toUpperCase().replace('-', '_'));
}

function int(value: unknown): number | null {
  const n = Number(value);
  return value === null || value === undefined || value === '' || !Number.isFinite(n) ? null : Math.round(n);
}

/** « 45 s », « 1 min », « 1 min 30 ». */
export function formatSeconds(seconds: number | null, fr: boolean): string {
  if (seconds == null || seconds <= 0) return '';
  if (seconds < 60) return `${seconds} s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s ? `${m} min ${String(s).padStart(2, '0')}` : `${m} min`;
}

function restOf(set: any, fr: boolean): string {
  const seconds = (int(set?.restMin) || 0) * 60 + (int(set?.restSec) || 0);
  return formatSeconds(seconds, fr);
}

function measureOf(exercise: any): PdfExercise['measure'] {
  if (String(exercise?.measure || '').toUpperCase() === 'TIME') return 'TIME';
  return exercise?.type === 'CARDIO' ? 'CARDIO' : 'REPS';
}

function valueOf(exercise: any, set: any, measure: PdfExercise['measure'], fr: boolean): string {
  if (measure === 'TIME') return formatSeconds(int(set?.durationSec), fr) || '—';
  if (measure === 'CARDIO') {
    const minutes = int(set?.duration) ?? int(exercise?.duration);
    return minutes != null ? `${minutes} min` : '—';
  }
  const reps = int(set?.reps);
  return reps == null ? '—' : `${reps}`;
}

function groupId(exercise: any): string {
  return String(exercise?.supersetGroupId ?? exercise?.supersetWith ?? '').trim();
}

function pdfExercise(exercise: any, label: string, options: WorkoutPdfOptions, onlyWarmup: boolean): PdfExercise {
  const measure = measureOf(exercise);
  let work = 0;
  let warm = 0;
  const rows: PdfSetRow[] = (exercise?.sets || []).map((set: any) => {
    const warmup = onlyWarmup || isWarmupSet(set);
    const weightKg = Number(set?.weight);
    return {
      label: warmup ? (options.fr ? `É${++warm}` : `W${++warm}`) : `${++work}`,
      value: valueOf(exercise, set, measure, options.fr),
      weight: options.showWeight && measure === 'REPS' && weightKg > 0 ? options.weight(weightKg) : '',
      rest: restOf(set, options.fr),
      warmup,
    };
  });
  // The warm-up rows first, then the working sets numbered from 1.
  rows.sort((a, b) => Number(b.warmup) - Number(a.warmup));
  const note = String(exercise?.coachNote || exercise?.notes || exercise?.exerciseRef?.coachNote || '').trim();
  return { label, name: String(exercise?.name || exercise?.exerciseRef?.name || '').trim(), note, measure, rows };
}

export function workoutPdfDays(plan: any, options: WorkoutPdfOptions): PdfDay[] {
  const t = (en: string, fr: string) => (options.fr ? fr : en);
  return (plan?.workoutDays || [])
    .map((day: any) => {
      const exercises = allExercises(day);
      const title = String(
        (day?.workoutSessions || []).map((s: any) => s?.name).find((name: unknown) => String(name || '').trim())
          || day?.title || day?.name || '',
      ).trim();
      const note = String(day?.description || '').trim();
      const state: PdfDay['state'] = isRestDay(day) ? 'REST' : exercises.length ? 'WORKOUT' : 'EMPTY';
      const warmup: PdfExercise[] = [];
      const blocks: PdfBlock[] = [];
      let number = 0;
      let i = 0;
      while (i < exercises.length) {
        const id = groupId(exercises[i]);
        let j = i + 1;
        if (id) while (j < exercises.length && groupId(exercises[j]) === id) j += 1;
        const members = exercises.slice(i, j);
        i = j;
        // A whole exercise of warm-up sets: the warm-up block.
        if (members.length === 1 && (members[0]?.sets || []).length && (members[0].sets as any[]).every(isWarmupSet)) {
          warmup.push(pdfExercise(members[0], '', options, true));
          continue;
        }
        number += 1;
        const circuit = !!id && String(members[0]?.groupType || '').toUpperCase() === 'CIRCUIT';
        const grouped = circuit || members.length > 1;
        const labels = members.map((_, k) => (grouped ? `${number}${String.fromCharCode(65 + k)}` : `${number}`));
        const list = members.map((exercise, k) => pdfExercise(exercise, labels[k], options, false));
        let title = '';
        if (circuit) {
          const rounds = Math.max(0, ...members.map((m: any) => (m?.sets || []).filter((s: any) => !isWarmupSet(s)).length));
          const between = formatSeconds(int(members[0]?.groupRestSec), options.fr);
          title = [t('Circuit', 'Circuit'),
            rounds ? (options.fr ? `${rounds} tour${rounds > 1 ? 's' : ''}` : `${rounds} round${rounds > 1 ? 's' : ''}`) : '',
            between ? t(`${between} between rounds`, `${between} entre les tours`) : ''].filter(Boolean).join(' · ');
        } else if (grouped) {
          title = t('Superset', 'Superset');
        }
        blocks.push({ kind: circuit ? 'CIRCUIT' : grouped ? 'SUPERSET' : 'SINGLE', title, exercises: list });
      }
      return { date: options.dateOf(day), title, state, note, warmup, blocks } as PdfDay;
    })
    .sort((a: PdfDay, b: PdfDay) => a.date.getTime() - b.date.getTime());
}
