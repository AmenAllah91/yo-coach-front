/**
 * What the « Workout complete! » / « Day complete! » celebration shows (same texts and figures as the mobile app:
 * workout_celebration_screen.dart, nutrition_celebration_screen.dart). Only facts the day already has.
 */

export interface CelebrationMessage { headline: string; body: string; }

/** An icon of the summary, drawn inline (Lucide paths, as on mobile). */
export type CelebrationIcon = 'timer' | 'list-checks' | 'dumbbell' | 'flame' | 'drumstick' | 'circle-check' | 'utensils';

export interface CelebrationStat { icon: CelebrationIcon; value: string; label: string; }

export interface CelebrationView {
  kind: 'workout' | 'nutrition';
  title: string;
  message: CelebrationMessage;
  summaryTitle: string;
  summarySubtitle?: string;
  summaryIcon: CelebrationIcon;
  stats: CelebrationStat[];
  /** One arc per meal around the check (nutrition), by colour; empty: one soft ring that fades out. */
  ring: string[];
  /** What the colours of the ring mean, only when the day was not all as planned. */
  legend: { color: string; label: string }[];
  doneLabel: string;
  /** The same message and confetti for the same day. */
  seed: string;
}

const WORKOUT_EN: CelebrationMessage[] = [
  { headline: 'Another step closer to your goals.', body: "Every workout counts. Every effort matters. Keep showing up — you're building a stronger you." },
  { headline: 'Progress is built one workout at a time.', body: 'Today you added one more. Keep stacking them.' },
  { headline: 'You showed up. You put in the work.', body: "That's what counts. See you at the next one." },
  { headline: 'Your future self will thank you.', body: "Today's effort is part of what's coming. Keep going." },
  { headline: 'Small wins. Big results.', body: 'One finished workout at a time. Keep going.' },
  { headline: 'Consistency is your superpower.', body: 'Workout after workout, it adds up. Keep showing up.' },
  { headline: "You're building a stronger you.", body: "You're not just completing workouts. Every one of them moves you forward." },
];

const WORKOUT_FR: CelebrationMessage[] = [
  { headline: 'Un pas de plus vers vos objectifs.', body: 'Chaque séance compte. Chaque effort compte. Continuez à vous présenter : vous construisez une version plus forte de vous-même.' },
  { headline: 'Le progrès se construit séance après séance.', body: 'Vous venez d’en ajouter une. Continuez sur cette lancée.' },
  { headline: 'Vous étiez là. Vous avez fait le travail.', body: 'C’est ce qui compte. À la prochaine séance.' },
  { headline: 'Votre « vous » de demain vous remerciera.', body: 'L’effort d’aujourd’hui prépare la suite. Continuez.' },
  { headline: 'Petites victoires, grands résultats.', body: 'Une séance terminée à la fois. Continuez.' },
  { headline: 'La régularité est votre super-pouvoir.', body: 'Séance après séance, tout s’additionne. Continuez à vous présenter.' },
  { headline: 'Vous devenez plus fort, séance après séance.', body: 'Vous ne faites pas que terminer des séances : chacune vous fait avancer.' },
];

const NUTRITION_EN: CelebrationMessage[] = [
  { headline: 'Fuel well, feel well.', body: 'Every meal you log helps your coach guide you better. Keep it up.' },
  { headline: 'One more day done.', body: 'Good habits are built one plate at a time.' },
  { headline: 'Your body thanks you.', body: "What you eat today fuels tomorrow's training." },
  { headline: 'Consistency, at the table too.', body: 'Day after day, these choices turn into results.' },
  { headline: 'Small choices, big results.', body: 'Each meal brings you closer to your goals. Keep going.' },
  { headline: 'Nicely fuelled.', body: 'Your coach can now see how your day went.' },
  { headline: 'Healthy habits, real progress.', body: 'Keep logging your meals — it all adds up.' },
];

const NUTRITION_FR: CelebrationMessage[] = [
  { headline: 'Bien manger, bien se sentir.', body: 'Chaque repas renseigné aide votre coach à mieux vous accompagner. Continuez.' },
  { headline: 'Une journée de plus de bouclée.', body: 'Les bonnes habitudes se construisent une assiette à la fois.' },
  { headline: 'Votre corps vous dit merci.', body: 'Ce que vous mangez aujourd’hui nourrit l’entraînement de demain.' },
  { headline: 'La régularité, aussi à table.', body: 'Jour après jour, ces choix deviennent des résultats.' },
  { headline: 'Petits choix, grands résultats.', body: 'Chaque repas vous rapproche de vos objectifs. Continuez.' },
  { headline: 'Bien nourri, bien parti.', body: 'Votre coach peut maintenant voir comment s’est passée votre journée.' },
  { headline: 'De bonnes habitudes, de vrais progrès.', body: 'Continuez à renseigner vos repas : tout compte.' },
];

/** Stable for a seed (the same day shows the same message), varied across days; the same hash as on mobile. */
export function celebrationHash(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) & 0x7fffffff;
  return hash;
}

function pick(seed: string, messages: CelebrationMessage[]): CelebrationMessage {
  return messages[celebrationHash(seed) % messages.length];
}

export function workoutCelebrationMessage(seed: string, fr: boolean): CelebrationMessage {
  return pick(seed, fr ? WORKOUT_FR : WORKOUT_EN);
}

export function nutritionCelebrationMessage(seed: string, fr: boolean): CelebrationMessage {
  return pick(seed, fr ? NUTRITION_FR : NUTRITION_EN);
}

/** « 42 min », « 1 h 05 », « 45 s »; null when nothing was timed. */
export function celebrationDuration(seconds: number | null | undefined): string | null {
  if (!seconds || seconds <= 0) return null;
  if (seconds < 60) return `${Math.round(seconds)} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`;
}

export function workoutCelebration(input: {
  title: string; durationSeconds: number | null; doneSets: number; totalSets: number;
  doneExercises: number; totalExercises: number; seed: string;
}, fr: boolean): CelebrationView {
  const duration = celebrationDuration(input.durationSeconds);
  const stats: CelebrationStat[] = [];
  if (duration) stats.push({ icon: 'timer', value: duration, label: fr ? 'Durée' : 'Duration' });
  if (input.totalSets > 0) stats.push({ icon: 'list-checks', value: `${input.doneSets}/${input.totalSets}`, label: fr ? 'Séries' : 'Sets' });
  if (input.totalExercises > 0) {
    stats.push({ icon: 'dumbbell', value: `${input.doneExercises}/${input.totalExercises}`, label: fr ? 'Exercices' : 'Exercises' });
  }
  return {
    kind: 'workout',
    title: fr ? 'Séance terminée !' : 'Workout Complete!',
    message: workoutCelebrationMessage(input.seed, fr),
    summaryTitle: input.title,
    summaryIcon: 'dumbbell',
    stats,
    ring: [],
    legend: [],
    doneLabel: fr ? 'Terminé' : 'Done',
    seed: input.seed,
  };
}

/** The colour of a meal in the ring and the legend: as planned, modified, skipped. */
export const MEAL_COLORS: Record<string, string> = { AS_PLANNED: '#22B573', MODIFIED: '#F59E0B', SKIPPED: '#CBD5E1' };

export function nutritionCelebration(input: {
  title: string; date: Date; meals: string[]; calories: number; protein: number;
  targetCalories: number; targetProtein: number; seed: string;
}, fr: boolean): CelebrationView {
  const locale = fr ? 'fr-FR' : 'en-US';
  const number = (value: number) => new Intl.NumberFormat(locale).format(Math.round(value));
  const count = (status: string) => input.meals.filter(meal => meal === status).length;
  const asPlanned = count('AS_PLANNED'); const modified = count('MODIFIED'); const skipped = count('SKIPPED');
  const total = input.meals.length;
  const stats: CelebrationStat[] = [];
  if (input.calories > 0 || input.targetCalories > 0) stats.push({ icon: 'flame', value: number(input.calories), label: 'kcal' });
  if (input.protein > 0 || input.targetProtein > 0) {
    stats.push({ icon: 'drumstick', value: `${number(input.protein)} g`, label: fr ? 'Protéines' : 'Protein' });
  }
  if (total > 0) stats.push({ icon: 'circle-check', value: `${asPlanned}/${total}`, label: fr ? 'Comme prévu' : 'As planned' });
  const legend: { color: string; label: string }[] = [];
  if (modified + skipped > 0) {
    if (asPlanned > 0) legend.push({ color: MEAL_COLORS['AS_PLANNED'], label: fr ? `${asPlanned} comme prévu` : `${asPlanned} as planned` });
    if (modified > 0) legend.push({ color: MEAL_COLORS['MODIFIED'], label: fr ? `${modified} modifié${modified > 1 ? 's' : ''}` : `${modified} modified` });
    if (skipped > 0) legend.push({ color: MEAL_COLORS['SKIPPED'], label: fr ? `${skipped} sauté${skipped > 1 ? 's' : ''}` : `${skipped} skipped` });
  }
  const date = new Intl.DateTimeFormat(locale, { weekday: 'long', month: 'long', day: 'numeric' }).format(input.date);
  return {
    kind: 'nutrition',
    title: fr ? 'Journée terminée !' : 'Day Complete!',
    message: nutritionCelebrationMessage(input.seed, fr),
    summaryTitle: input.title,
    summarySubtitle: date ? date[0].toUpperCase() + date.slice(1) : '',
    summaryIcon: 'utensils',
    stats,
    ring: input.meals.map(meal => MEAL_COLORS[meal] || MEAL_COLORS['AS_PLANNED']),
    legend,
    doneLabel: fr ? 'Terminé' : 'Done',
    seed: input.seed,
  };
}
