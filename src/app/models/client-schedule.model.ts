export type ClientScheduleKind = 'ASSIGNED' | 'PLANNED';

export interface FormScheduleDto {
  frequency?: string;
  time?: string;
  daysOfWeek?: string[];
  biweeklyWeeks?: string;
  monthlyMode?: string;
  monthlyDay?: number;
}

export interface FormOptionDto {
  id?: string;
  label: string;
}

export interface FormQuestionDto {
  id: string;
  type: string;
  label: string;
  required: boolean;
  order?: number;
  options?: FormOptionDto[];
}

export interface ClientScheduleItemDto {
  kind: ClientScheduleKind;
  id: string;
  formId: string;
  formTitle: string;
  dueAt: string;
  createdAt: string;
  source?: string;
  status?: string;
  schedule?: FormScheduleDto | null;
  questions?: FormQuestionDto[];
}
