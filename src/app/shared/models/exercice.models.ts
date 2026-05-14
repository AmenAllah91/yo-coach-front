export interface ExerciseSet {
  reps?: string;
  weight?: number;
  duration?: number;
  restMin?: number;
  restSec?: number;
  setNumber?: number;
}

export interface ExerciseRef {
  id?: string;
  name?: string;
  videoLink?: string;
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
  videoUrl?: string;
  videoLink?: string;
  description?: string;

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
