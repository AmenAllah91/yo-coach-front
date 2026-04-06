// -------------------------
// 📌 ENUMS
// -------------------------

export enum TypeExercise {
  CARDIO = 'CARDIO',
  MUSCULATION = 'MUSCULATION',
  STRENGTH = 'STRENGTH'
}

export enum TypeWorkoutPlan {
  STRENGTH_TRAINING = 'STRENGTH_TRAINING',
  CARDIOVASCULAR_TRAINING = 'CARDIOVASCULAR_TRAINING',
  FLEXIBILITY_MOBILITY = 'FLEXIBILITY_MOBILITY',
  FUNCTIONAL_FITNESS = 'FUNCTIONAL_FITNESS'
}

// Si tu as des enums MuscleGroup / Equipment :
export enum MuscleGroup {
  CHEST = 'CHEST',
  BACK = 'BACK',
  SHOULDERS = 'SHOULDERS',
  LEGS = 'LEGS',
  ARMS = 'ARMS',
  CORE = 'CORE'
}

export enum Equipment {
  NONE = 'NONE',
  DUMBBELL = 'DUMBBELL',
  BARBELL = 'BARBELL',
  MACHINE = 'MACHINE',
  KETTLEBELL = 'KETTLEBELL',
  BODYWEIGHT = 'BODYWEIGHT'
}

// -------------------------
// 📌 EXERCISE SET (si utilisé)
// -------------------------
export interface ExerciseSet {
  reps?: number;
  weight?: number;
  duration?: number;
  rest?: number;
}

// -------------------------
// 📌 EXERCISE REF
// -------------------------
export interface ExerciseRef {
  id?: string;
  code?: string;
  name?: string;
  videoLink?: string;
  type?: TypeExercise;
  muscle?: MuscleGroup;
  equipment?: Equipment;
  createdBy?: string;
  isTemplate?: boolean;
}

// -------------------------
// 📌 EXERCISE
// -------------------------
export interface Exercise {
  id?: string;
  name?: string;
  dayOfWeek?: string;
  restDay?: boolean;
  exerciseRef?: ExerciseRef;
  type?: TypeExercise;
  supersetGroupId?: string;
  sets?: ExerciseSet[];
}

// -------------------------
// 📌 WORKOUT SESSION
// -------------------------
export interface WorkoutSession {
  name?: string;
  exercises?: Exercise[];
}

// -------------------------
// 📌 WORKOUT DAY
// -------------------------
export interface WorkoutDay {
  date?: string;             // LocalDate → string
  dayOfWeek?: string;
  restDay?: boolean;
  dayNumber?: number;
  title?: string;
  description?: string;
  workoutSessions?: WorkoutSession[];
  status?: string;
}

// -------------------------
// 📌 WORKOUT PLAN
// -------------------------
export interface WorkoutPlan {
  id?: string;
  name?: string;
  details?: string;
  startDate?: string;
  endDate?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client?: any;
  workoutDays?: WorkoutDay[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  coach?: any;
  isWorkoutPlanTemplate?: boolean;
  typeWorkoutPlan?: TypeWorkoutPlan;
  createdBy?: string;
}

interface SaveWorkoutDayRequest {
  title: string;
  date: string; // yyyy-mm-dd
  restDay: boolean;
  exercises: SaveWorkoutExerciseRequest[];
}

interface SaveWorkoutExerciseRequest {
  name: string;
  type: 'CARDIO' | 'STRENGTH';
  duration?: number;
  sets: SaveWorkoutSetRequest[];
}

interface SaveWorkoutSetRequest {
  setNumber: number;
  reps: number | null;
  restMin: number;
  restSec: number;
}

interface UpdateWorkoutDayRequest extends SaveWorkoutDayRequest {}

interface WorkoutPlanRef {
  programId: string;
  programName: string;
}
