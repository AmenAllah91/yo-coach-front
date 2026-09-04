export type WorkoutSetType = 'REGULAR' | 'WARM_UP' | 'DROP_SET' | 'FAILURE';

export interface ExerciseSet {
  reps?: string;
  weight?: number | null;
  duration?: number;
  restMin?: number;
  restSec?: number;
  setNumber?: number;
  type?: WorkoutSetType;
}

export interface ExerciseRef {
  id?: string;
  name?: string;
  videoLink?: string;
  videoUrl?: string;
  imageUrl?: string;
  image?: string;
  thumbnailUrl?: string;
  photoUrl?: string;
  description?: string;
  type?: string;
  muscle?: string;
  equipment?: string;
  createdBy?: string;
  isTemplate?: boolean;
}

export interface Exercise {
  id?: string;
  name?: string;
  dayOfWeek?: string;
  restDay?: boolean;
  exerciseRef?: ExerciseRef;
  type?: string;
  duration?: number;

  supersetGroupId?: string | null;
  sets?: ExerciseSet[];

  image?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  photoUrl?: string;
  videoUrl?: string;
  videoLink?: string;
  description?: string;
  coachNote?: string;
  notes?: string;

  equipment?: string;
  muscle?: string;
  isTemplate?: boolean;
  createdBy?: string;
}

export interface WorkoutSession {
  name?: string;
  exercises: Exercise[];
  totalSets?: number;
  totalReps?: number;
  totalDurationMin?: number;
}

export interface EnumResponse {
  typeExercise: string[];
  equipment: string[];
  muscleGroup: string[];
}
