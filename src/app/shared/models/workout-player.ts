/**
 * Mode guidé de la séance du client (même logique que l'appli mobile, workout_player_screen.dart) :
 * l'ordre des séries et le repos entre deux séries.
 */

export interface PlayerSet {
  status: 'PENDING' | 'COMPLETED' | 'MISSED';
  restMin?: number | null;
  restSec?: number | null;
}

export interface PlayerExercise {
  sets: PlayerSet[];
}

/** Un exercice seul, un superset ou un circuit. */
export interface PlayerGroup {
  exercises: PlayerExercise[];
  /** Superset ou circuit : les exercices s'enchaînent, tour par tour. */
  grouped: boolean;
  circuit: boolean;
  /** Repos du groupe en secondes (null = anciennes séances : le repos de la série). */
  restSec: number | null;
  /** Exercice du bloc « Échauffement » en haut de la séance : le client peut le passer d'un coup. */
  warmup?: boolean;
}

/** Une série à faire : quel groupe, quel exercice du groupe, quelle série (ou quel tour). */
export interface PlayerStep {
  group: number;
  exercise: number;
  set: number;
}

/** L'ordre de la séance. Exercice seul : série 1, 2, 3. Superset et circuit : A1, B1, puis A2, B2… */
export function buildPlayerSteps(groups: PlayerGroup[]): PlayerStep[] {
  const steps: PlayerStep[] = [];
  groups.forEach((group, g) => {
    if (!group.grouped) {
      group.exercises.forEach((exercise, e) => exercise.sets.forEach((_, s) => steps.push({ group: g, exercise: e, set: s })));
      return;
    }
    const rounds = Math.max(0, ...group.exercises.map((exercise) => exercise.sets.length));
    for (let round = 0; round < rounds; round++) {
      group.exercises.forEach((exercise, e) => {
        if (round < exercise.sets.length) steps.push({ group: g, exercise: e, set: round });
      });
    }
  });
  return steps;
}

/**
 * Repos (en secondes) entre la série `done` et la série `next`. Dans un superset ou un circuit, pas de repos entre deux
 * exercices du même tour : le repos vient à la fin du tour.
 */
export function playerRestAfter(groups: PlayerGroup[], done: PlayerStep, next: PlayerStep): number {
  const group = groups[done.group];
  const set = group.exercises[done.exercise].sets[done.set];
  const own = (Number(set?.restMin) || 0) * 60 + (Number(set?.restSec) || 0);
  if (!group.grouped) return own;
  if (next.group === done.group && next.set === done.set && next.exercise > done.exercise) return 0;
  return group.restSec ?? (own > 0 ? own : group.circuit ? 60 : 0);
}

/** La prochaine série pas encore faite : après celle-ci d'abord, sinon une série laissée plus haut. */
export function nextPendingStep(groups: PlayerGroup[], steps: PlayerStep[], from: number): number | null {
  const pending = (index: number) => groups[steps[index].group].exercises[steps[index].exercise].sets[steps[index].set].status === 'PENDING';
  for (let i = from + 1; i < steps.length; i++) if (pending(i)) return i;
  for (let i = 0; i < Math.min(from, steps.length); i++) if (pending(i)) return i;
  return null;
}

/** Les séries d'échauffement pas encore faites (bouton « Passer l'échauffement »). */
export function pendingWarmupSteps(groups: PlayerGroup[], steps: PlayerStep[]): PlayerStep[] {
  return steps.filter((step) => groups[step.group].warmup && groups[step.group].exercises[step.exercise].sets[step.set].status === 'PENDING');
}
