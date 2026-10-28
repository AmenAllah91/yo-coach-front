import { QuestionBE } from '../components/forms/services/forms-api.service';

export type ClientOnboardingStep = 'language' | 'profile' | 'units' | 'form' | 'completed';

export interface ClientOnboardingState {
  clientId: string;
  coachId?: string;
  currentStep: ClientOnboardingStep;
  completedSteps: string[];
  completed: boolean;
  /** Onboarding finished before these profile fields existed: only the profile step is left. */
  profileUpdate?: boolean;
  coachName?: string;
  language: 'English' | 'French';
  birthDate?: string;
  gender?: 'MALE' | 'FEMALE';
  phoneNumber?: string;
  currentWeight?: number;
  goalWeight?: number;
  mainObjective?: string;
  weightUnit: 'kg' | 'lbs';
  distanceUnit: 'km' | 'miles';
  measurementUnit: 'cm' | 'in';
  signupFormId?: string;
  signupFormTitle?: string;
  signupFormQuestions: QuestionBE[];
}
