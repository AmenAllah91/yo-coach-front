export interface MeasurementTypeItem {
  key: string;
  label: string;
  unit: string;
  icon: string;
  min: number;
  max: number;
  /** Derived from other data (e.g. BMI from weight and height), so a client never records it by hand. */
  derived?: boolean;
}

/** Measurement types of the Measurements module (single source for every screen that lists them). */
export const MEASUREMENT_TYPES: MeasurementTypeItem[] = [
  { key: 'BODYWEIGHT', label: 'BODYWEIGHT', unit: 'kg', icon: 'fa-weight-scale', min: 20, max: 500 },
  { key: 'BMI', label: 'BMI', unit: '', icon: 'fa-person', min: 5, max: 100, derived: true },
  { key: 'BODY_FAT_INDEX', label: 'BODY_FAT_INDEX', unit: '%', icon: 'fa-person', min: 1, max: 70 },
  { key: 'WAIST', label: 'WAIST', unit: 'cm', icon: 'fa-ruler-horizontal', min: 20, max: 300 },
  { key: 'CHEST', label: 'CHEST', unit: 'cm', icon: 'fa-ruler-horizontal', min: 20, max: 300 },
  { key: 'SHOULDERS', label: 'SHOULDERS', unit: 'cm', icon: 'fa-ruler-horizontal', min: 20, max: 300 },
  { key: 'BICEPS_RIGHT', label: 'BICEPS_RIGHT', unit: 'cm', icon: 'fa-ruler-horizontal', min: 5, max: 100 },
  { key: 'BICEPS_LEFT', label: 'BICEPS_LEFT', unit: 'cm', icon: 'fa-ruler-horizontal', min: 5, max: 100 },
  { key: 'QUADRICEPS_RIGHT', label: 'QUADRICEPS_RIGHT', unit: 'cm', icon: 'fa-ruler-horizontal', min: 10, max: 150 },
  { key: 'QUADRICEPS_LEFT', label: 'QUADRICEPS_LEFT', unit: 'cm', icon: 'fa-ruler-horizontal', min: 10, max: 150 },
  { key: 'NECK', label: 'NECK', unit: 'cm', icon: 'fa-ruler-horizontal', min: 10, max: 100 },
];

/** Types a client records by hand: the only ones a coach can ask for in a "Body metrics" task. */
export const MANUAL_MEASUREMENT_TYPES = MEASUREMENT_TYPES.filter((type) => !type.derived);
