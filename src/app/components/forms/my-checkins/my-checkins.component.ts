import { Component } from '@angular/core';
import {CommonModule} from "@angular/common";
import {FormsModule} from "@angular/forms";

type Tab = 'pending' | 'completed';

export enum QuestionType {
  MULTIPLE_CHOICE = 'MULTIPLE_CHOICE',
  STAR_RATING = 'STAR_RATING',
  YES_NO = 'YES_NO',
  TEXT = 'TEXT',
  DATE = 'DATE'
}

export interface OptionItem {
  id: string;
  label: string;
}

export interface Question {
  id: string;
  type: QuestionType;
  label: string;
  required: boolean;
  order: number;
  helpText?: string;

  // MULTIPLE_CHOICE
  options?: OptionItem[];

  // STAR_RATING
  minStars?: number;
  maxStars?: number;

  // TEXT
  minLength?: number;
  maxLength?: number;
  regex?: string;

  // DATE
  minDate?: string;
  maxDate?: string;
}

export interface Answer {
  questionId: string;
  type: QuestionType;
  selectedOptionId?: string;
  rating?: number;
  yes?: boolean;
  text?: string;
  date?: string;
}

interface CheckInItem {
  id: string;
  formName: string;
  dueDate: string;
  assignedDate: string;
  status: 'pending' | 'completed';
  submittedDate?: string;
  questions?: Question[];
  answers?: Answer[];
  coachFeedback?: string;
}


@Component({
  selector: 'app-my-checkins',
  standalone: true,
  imports: [CommonModule,FormsModule],
  templateUrl: './my-checkins.component.html',
  styleUrl: './my-checkins.component.scss'
})
export class MyCheckinsComponent {
  activeTab: Tab = 'pending';
  selectedCheckIn: CheckInItem | null = null;
  isModalOpen = false;
  isViewMode = false; // false = completion mode, true = view mode
  formAnswers: Map<string, any> = new Map();
  QuestionType = QuestionType;

  // Mock questions pour la démo
  mockQuestions: Question[] = [
    {
      id: 'q1',
      type: QuestionType.TEXT,
      label: 'What was your biggest win this week?',
      required: true,
      order: 1,
      helpText: 'Share your most significant achievement'
    },
    {
      id: 'q2',
      type: QuestionType.MULTIPLE_CHOICE,
      label: 'Which area of fitness routine do you feel improved the most this week?',
      required: true,
      order: 2,
      options: [
        { id: 'opt1', label: 'Strength Training' },
        { id: 'opt2', label: 'Cardio Endurance' },
        { id: 'opt3', label: 'Flexibility' },
        { id: 'opt4', label: 'Nutrition' }
      ]
    },
    {
      id: 'q3',
      type: QuestionType.YES_NO,
      label: 'Did you achieve your target weight or body composition for the week?',
      required: true,
      order: 3
    },
    {
      id: 'q4',
      type: QuestionType.STAR_RATING,
      label: "Rate your overall satisfaction with this week's progress",
      required: true,
      order: 4,
      minStars: 1,
      maxStars: 5
    },
    {
      id: 'q5',
      type: QuestionType.DATE,
      label: 'On which date this week did you feel most energized and productive?',
      required: false,
      order: 5
    }
  ];

  // Mock answers pour les formulaires complétés
  mockCompletedAnswers: Answer[] = [
    {
      questionId: 'q1',
      type: QuestionType.TEXT,
      text: 'I managed to complete all 5 of my scheduled workouts, which is a first for me! Also improved my diet consistency.'
    },
    {
      questionId: 'q2',
      type: QuestionType.MULTIPLE_CHOICE,
      selectedOptionId: 'opt1'
    },
    {
      questionId: 'q3',
      type: QuestionType.YES_NO,
      yes: true
    },
    {
      questionId: 'q4',
      type: QuestionType.STAR_RATING,
      rating: 4
    },
    {
      questionId: 'q5',
      type: QuestionType.DATE,
      date: '2025-01-14'
    }
  ];

  checkIns: CheckInItem[] = [
    {
      id: '1',
      formName: 'Weekly Progress Check-in',
      dueDate: 'January 18, 2025',
      assignedDate: 'January 15, 2025',
      status: 'pending',
      questions: this.mockQuestions
    },
    {
      id: '2',
      formName: 'Nutrition Assessment',
      dueDate: 'January 20, 2025',
      assignedDate: 'January 15, 2025',
      status: 'pending',
      questions: this.mockQuestions
    },
    {
      id: '3',
      formName: 'Weekly Progress Check-in',
      dueDate: 'January 11, 2025',
      assignedDate: 'January 8, 2025',
      status: 'completed',
      submittedDate: 'January 10, 2025',
      questions: this.mockQuestions,
      answers: this.mockCompletedAnswers,
      coachFeedback: 'Great progress this week! Keep up the good work. Your consistency with workouts is impressive!'
    },
    {
      id: '4',
      formName: 'Monthly Review',
      dueDate: 'January 5, 2025',
      assignedDate: 'January 1, 2025',
      status: 'completed',
      submittedDate: 'January 4, 2025',
      questions: this.mockQuestions,
      answers: this.mockCompletedAnswers,
      coachFeedback: 'Excellent work this month! You\'ve shown remarkable dedication.'
    },
  ];

  setTab(tab: Tab) {
    this.activeTab = tab;
  }

  get pendingCheckIns(): CheckInItem[] {
    return this.checkIns.filter((c) => c.status === 'pending');
  }

  get completedCheckIns(): CheckInItem[] {
    return this.checkIns.filter((c) => c.status === 'completed');
  }

  get pendingCount(): number {
    return this.pendingCheckIns.length;
  }

  isOverdue(dueDate: string): boolean {
    return new Date(dueDate) < new Date();
  }

  onOpenCheckIn(checkIn: CheckInItem) {
    this.selectedCheckIn = checkIn;
    this.isModalOpen = true;

    if (checkIn.status === 'completed') {
      // Mode visualisation
      this.isViewMode = true;
      this.formAnswers.clear();
    } else {
      // Mode complétion
      this.isViewMode = false;
      this.formAnswers.clear();
    }
  }

  closeModal() {
    this.isModalOpen = false;
    this.selectedCheckIn = null;
    this.isViewMode = false;
    this.formAnswers.clear();
  }

  handleAnswerChange(questionId: string, value: any) {
    this.formAnswers.set(questionId, value);
  }

  getAnswerValue(questionId: string): any {
    return this.formAnswers.get(questionId);
  }

  // Récupère la réponse soumise pour une question
  getSubmittedAnswer(questionId: string): Answer | undefined {
    return this.selectedCheckIn?.answers?.find(a => a.questionId === questionId);
  }

  // Récupère le label d'une option pour MULTIPLE_CHOICE
  getOptionLabel(question: Question, optionId: string): string {
    return question.options?.find(opt => opt.id === optionId)?.label || '';
  }

  getStarsArray(max: number = 5): number[] {
    return Array.from({ length: max }, (_, i) => i + 1);
  }

  isStarFilled(questionId: string, starValue: number): boolean {
    if (this.isViewMode) {
      const answer = this.getSubmittedAnswer(questionId);
      return starValue <= (answer?.rating || 0);
    }
    const rating = this.getAnswerValue(questionId) || 0;
    return starValue <= rating;
  }

  onSubmitCheckIn() {
    if (!this.selectedCheckIn) return;

    const answers: Answer[] = [];

    this.selectedCheckIn.questions?.forEach(question => {
      const value = this.formAnswers.get(question.id);

      const answer: Answer = {
        questionId: question.id,
        type: question.type
      };

      switch (question.type) {
        case QuestionType.TEXT:
          answer.text = value || '';
          break;
        case QuestionType.MULTIPLE_CHOICE:
          answer.selectedOptionId = value || '';
          break;
        case QuestionType.YES_NO:
          answer.yes = value === 'Yes';
          break;
        case QuestionType.STAR_RATING:
          answer.rating = value || 0;
          break;
        case QuestionType.DATE:
          answer.date = value || '';
          break;
      }

      answers.push(answer);
    });

    console.log('Submitting check-in:', {
      checkInId: this.selectedCheckIn.id,
      answers
    });

    // TODO: Appel API pour soumettre les réponses
    // this.checkInService.submitCheckIn(this.selectedCheckIn.id, answers).subscribe(...)

    this.closeModal();
  }

  trackById(_: number, item: CheckInItem) {
    return item.id;
  }
}
