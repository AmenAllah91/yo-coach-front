/** The client's main goal, saved by code in `mainObjective` (same list on the server and in the mobile app). */
export const CLIENT_OBJECTIVES = [
  { code: 'LOSE_WEIGHT', fr: 'Perdre du poids', en: 'Lose weight' },
  { code: 'BUILD_MUSCLE', fr: 'Prendre du muscle', en: 'Build muscle' },
  { code: 'GET_FIT', fr: 'Me remettre en forme', en: 'Get fit' },
  { code: 'IMPROVE_PERFORMANCE', fr: 'Améliorer mes performances', en: 'Improve performance' },
  { code: 'STAY_HEALTHY', fr: 'Rester en bonne santé', en: 'Stay healthy' },
] as const;

export function isClientObjective(value: unknown): boolean {
  return CLIENT_OBJECTIVES.some(objective => objective.code === value);
}

/** Label of a goal code; a goal written as free text before the list keeps its text. */
export function clientObjectiveLabel(value: unknown, fr: boolean): string {
  const text = String(value ?? '').trim();
  const objective = CLIENT_OBJECTIVES.find(o => o.code === text);
  return objective ? (fr ? objective.fr : objective.en) : text;
}
