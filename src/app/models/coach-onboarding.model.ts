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

  businessName: string;
  businessType: string;
  businessTypeOther: string;
  businessGoals: string[];
  businessGoalOther: string;
  clientManagementMethod: string;
  clientManagementOther: string;
  coachingSoftware: string;

  country: string;
  city: string;
  timezone: string;
  language: CoachLanguage;

  weightUnit: CoachWeightUnit;
  distanceUnit: CoachDistanceUnit;
  measurementUnit: CoachMeasurementUnit;
}

export interface CoachOnboardingStepPayload {
  businessName?: string;
  businessType?: string;
  businessTypeOther?: string;
  businessGoals?: string[];
  businessGoalOther?: string;
  clientManagementMethod?: string;
  clientManagementOther?: string;
  coachingSoftware?: string;

  country?: string;
  city?: string;
  timezone?: string;
  language?: CoachLanguage;

  weightUnit?: CoachWeightUnit;
  distanceUnit?: CoachDistanceUnit;
  measurementUnit?: CoachMeasurementUnit;
}
