export type CoachOnboardingStep = 'business-goals' | 'location-timezone' | 'units' | 'completed';
export type CoachWeightUnit = 'kg' | 'lbs';
export type CoachDistanceUnit = 'km' | 'miles';
export type CoachMeasurementUnit = 'cm' | 'in';
export type CoachLanguage = 'English' | 'French';

export interface CoachOnboardingState {
  coachId: string;
  currentStep: CoachOnboardingStep;
  completedSteps: CoachOnboardingStep[];
  completed: boolean;

  coachRole: string;
  coachRoleOther: string;
  coachingMode: string;
  activeClientsRange: string;
  managementTools: string[];
  managementOther: string;
  coachingSoftware: string;
  biggestChallenge: string;
  biggestChallengeOther: string;
  businessGoals: string[];
  targetClientsRange: string;

  country: string;
  city: string;
  timezone: string;
  language: CoachLanguage;

  weightUnit: CoachWeightUnit;
  distanceUnit: CoachDistanceUnit;
  measurementUnit: CoachMeasurementUnit;
}

export interface CoachOnboardingStepPayload {
  coachRole?: string;
  coachRoleOther?: string;
  coachingMode?: string;
  activeClientsRange?: string;
  managementTools?: string[];
  managementOther?: string;
  coachingSoftware?: string;
  biggestChallenge?: string;
  biggestChallengeOther?: string;
  businessGoals?: string[];
  targetClientsRange?: string;

  country?: string;
  city?: string;
  timezone?: string;
  language?: CoachLanguage;

  weightUnit?: CoachWeightUnit;
  distanceUnit?: CoachDistanceUnit;
  measurementUnit?: CoachMeasurementUnit;
}
