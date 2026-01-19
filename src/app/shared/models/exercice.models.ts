export interface ExerciseSet {
  reps?: string;
  weight?: number;
  restMin?: number;
  restSec?: number;
  setNumber?: number;
}

export interface ExerciseRef {
  id?: string;
  name?: string;
  videoUrl?: string;
  description?: string;
}

export interface Exercise {
  id?: string;
  name?: string;
  dayOfWeek?: string;
  restDay?: boolean;
  exerciseRef?: ExerciseRef;
  type?: string;

  supersetGroupId?: string | null;
  sets?: ExerciseSet[];

  image?: string;
  videoUrl?: string;
  description?: string;

  equipment?: string;
  muscle?: string;
  isTemplate?: boolean;
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
