import { QuestionBE } from '../components/forms/services/forms-api.service';

export type ClientOnboardingStep = 'language' | 'goals' | 'units' | 'form' | 'completed';

export interface ClientOnboardingState {
  clientId: string;
  coachId?: string;
  currentStep: ClientOnboardingStep;
  completedSteps: string[];
  completed: boolean;
  language: 'English' | 'French';
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
