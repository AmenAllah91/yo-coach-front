import { Exercise } from './exercice.models';

export interface WorkoutSession {
  name?: string;
  exercises: Exercise[];
  totalSets?: number;
  totalReps?: number;
  totalDurationMin?: number;
}

export enum TypeWorkoutPlan {
  STRENGTH_TRAINING = 'STRENGTH_TRAINING',
  CARDIOVASCULAR_TRAINING = 'CARDIOVASCULAR_TRAINING',
  FLEXIBILITY_MOBILITY = 'FLEXIBILITY_MOBILITY',
  FUNCTIONAL_FITNESS = 'FUNCTIONAL_FITNESS',
}

export interface WorkoutDay {
  id?: string;
  name?: string;
  date?: string;
  title?: string;
  description?: string;
  dayNumber?: number;
  dayOfWeek?: string;
  isRestDay?: boolean;
  restDay?: boolean;
  status: string;
  showDescription?: boolean;
  workoutSessions?: WorkoutSession[];
  session?: WorkoutSession | null;
}

export type WorkoutStatus = 'upcoming' | 'active' | 'completed';

export interface WorkoutPlan {
  id?: string;
  name: string;
  details: string;
  startDate?: string;
  endDate?: string;
  workoutDays: WorkoutDay[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  coach?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client?: any;
  isWorkoutPlanTemplate?: boolean;
  typeWorkoutPlan?: TypeWorkoutPlan;
  createdBy?: string;

  status?: WorkoutStatus;
  totalDays?: number;
  currentDay?: number;
  progressPercent?: number;

  workoutPlanMode?: 'NORMAL' | 'FILE' | string;
  resourceType?: string;
  fileName?: string;
  originalFileName?: string;
  fileUrl?: string;
  fileContentType?: string;
  fileSizeBytes?: number;
  fileUploadedAt?: string;
  sourceWorkoutPlanId?: string;
  overlap?: boolean;
  /** One-based week numbers explicitly published by the coach. */
  publishedWeeks?: number[];
}
