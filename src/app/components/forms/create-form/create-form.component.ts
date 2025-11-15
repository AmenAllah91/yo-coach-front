import {Component, EventEmitter, Input, Output} from '@angular/core';
import {CommonModule} from "@angular/common";
import {FormsModule} from "@angular/forms";
import {FeatherModule} from "angular-feather";
export type QuestionType =
  | 'scale'
  | 'multiple-choice'
  | 'star-rating'
  | 'yes-no'
  | 'input-text'
  | 'opinion-rating'
  | 'signature'
  | 'media'
  | 'date'
  | 'progress-photo';

export interface QuestionItem {
  id: string;
  type: QuestionType;
  text: string;
  isRequired: boolean;
  options?: string[];
}

export interface QuestionItem {
  id: string
  type: QuestionType
  text: string
  isRequired: boolean
  options?: string[]
}

interface QuestionTypeItem {
  id: QuestionType
  label: string
}
type Tab = 'form' | 'details' | 'schedule';
type ScheduleFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly'
type BiweeklyWeekOption = '1-3' | '2-4';
type MonthlyMode = 'start' | 'end' | 'specific';

@Component({
  selector: 'app-create-form',
  standalone: true,
  imports: [CommonModule, FormsModule, FeatherModule],
  templateUrl: './create-form.component.html',
  styleUrl: './create-form.component.scss'
})
export class CreateFormComponent {

  isEditingTitle = false;
  isDefaultQuestionnaire = false; // pour l’onglet Details
  showPreview = false;


  // --- helpers ---
  nowId = () => `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  // --- actions ---
  setActiveTab(tab: Tab) {
    this.activeTab = tab;
  }

  startEditTitle() {
    this.isEditingTitle = true;
  }
  finishEditTitle() {
    this.isEditingTitle = false;
  }
  titleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') this.finishEditTitle();
  }

  openPreview() {
    this.showPreview = true;
  }
  closePreview() {
    this.showPreview = false;
  }


  deleteQuestion(id: string) {
    this.questions = this.questions.filter((q) => q.id !== id);
  }

  updateQuestion(id: string, updates: Partial<QuestionItem>) {
    this.questions = this.questions.map((q) =>
      q.id === id ? { ...q, ...updates } : q
    );
  }

  // options pour multiple-choice
  addOption(id: string) {
    this.questions = this.questions.map((q) => {
      if (q.id !== id) return q;
      const opts = q.options ? [...q.options, 'New Option'] : ['New Option'];
      return { ...q, options: opts };
    });
  }

  updateOption(id: string, index: number, value: string) {
    this.questions = this.questions.map((q) => {
      if (q.id !== id || !q.options) return q;
      const opts = [...q.options];
      opts[index] = value;
      return { ...q, options: opts };
    });
  }

  deleteOption(id: string, index: number) {
    this.questions = this.questions.map((q) => {
      if (q.id !== id || !q.options) return q;
      const opts = [...q.options];
      opts.splice(index, 1);
      return { ...q, options: opts };
    });
  }

  saveForm() {
    // remplace cette logique par ton appel API si besoin
    console.log('Saving form…', {
      activeTab: this.activeTab,
      title: this.formTitle,
      questions: this.questions,
    });
  }

  back() {
    history.back();
  }

  // pour *ngFor trackBy
  trackById = (_: number, q: QuestionItem) => q.id;



  activeTab: 'form' | 'details' | 'schedule' = 'form'
  formTitle = 'Form Title'
  showQuestionSidebar = false

  questions: QuestionItem[] = []

  questionTypes = [
    { id: 'scale' as QuestionType, label: 'Scale' },
    { id: 'multiple-choice' as QuestionType, label: 'Multiple Choice' },
    { id: 'star-rating' as QuestionType, label: 'Star Rating' },
    { id: 'yes-no' as QuestionType, label: 'Yes/No' },
    { id: 'input-text' as QuestionType, label: 'Text Input' },
    { id: 'opinion-rating' as QuestionType, label: 'Opinion Rating' },
    { id: 'media' as QuestionType, label: 'Add Media' },
    { id: 'date' as QuestionType, label: 'Date' },
    { id: 'progress-photo' as QuestionType, label: 'Progress Photo' },
  ]

  setTab(tab: 'form' | 'details' | 'schedule') {
    this.activeTab = tab
  }

  openTypeDrawer() {
    this.showQuestionSidebar = true
  }

  closeTypeDrawer() {
    this.showQuestionSidebar = false
  }

  addQuestion(type: QuestionType) {
    const newQuestion: QuestionItem = {
      id: `question-${Date.now()}`,
      type,
      text: `Question ${this.questions.length + 1}`,
      isRequired: true,
      options: type === 'multiple-choice' ? ['New Option'] : undefined,
    }
    this.questions = [...this.questions, newQuestion]
    this.showQuestionSidebar = false
  }

  removeQuestion(index: number): void {
    this.questions = this.questions.filter((_, i) => i !== index);
  }

  addMcOption(q: QuestionItem) {
    if (!q.options) q.options = []
    q.options.push('New Option')
  }

  removeMcOption(q: QuestionItem, index: number) {
    if (!q.options) return
    q.options.splice(index, 1)
  }

  trackByIndex(index: number) {
    return index
  }

  // options de fréquence
  scheduleFrequency: ScheduleFrequency = 'daily'
  scheduleFrequencyOptions = [
    { id: 'daily' as ScheduleFrequency, label: 'Daily' },
    { id: 'weekly' as ScheduleFrequency, label: 'Weekly' },
    { id: 'biweekly' as ScheduleFrequency, label: 'Biweekly' },
    { id: 'monthly' as ScheduleFrequency, label: 'Monthly' },
  ]

  // jours de la semaine
  scheduleWeekDays: string[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  // jours sélectionnés
  scheduleSelectedDays: string[] = [...this.scheduleWeekDays]

  // heure
  scheduleTime: string = '09:00'

  setScheduleFrequency(freq: ScheduleFrequency): void {
    this.scheduleFrequency = freq

    if (freq === 'daily') {
      // Daily → tous les jours sélectionnés
      this.scheduleSelectedDays = [...this.scheduleWeekDays]
    } else if (this.scheduleSelectedDays.length === 0) {
      // au moins 1 jour sélectionné
      this.scheduleSelectedDays = ['Mon']
    }
  }

  toggleScheduleDay(day: string): void {
    // Pour Daily les jours sont figés
    if (this.scheduleFrequency === 'daily') {
      return
    }

    const idx = this.scheduleSelectedDays.indexOf(day)
    if (idx > -1) {
      this.scheduleSelectedDays = this.scheduleSelectedDays.filter(
        (d) => d !== day,
      )
    } else {
      this.scheduleSelectedDays = [...this.scheduleSelectedDays, day]
    }
  }

  isScheduleDaySelected(day: string): boolean {
    return this.scheduleSelectedDays.includes(day)
  }

  isScheduleDayDisabled(): boolean {
    return this.scheduleFrequency === 'daily'
  }


  // Daily : multi-sélection
  dailySelectedDays: string[] = ['Mon'];

  // Weekly : un seul jour
  weeklySelectedDay: string = 'Mon';

  // Biweekly : option de semaine + un jour
  biweeklyWeekOption: BiweeklyWeekOption = '1-3';
  biweeklySelectedDay: string = 'Mon';

  // Monthly : mode + jour du mois
  monthlyMode: MonthlyMode = 'specific';
  monthDays: number[] = Array.from({ length: 31 }, (_, i) => i + 1);
  monthlyDay: number = 10;


  setBiweeklyWeek(option: BiweeklyWeekOption): void {
    this.biweeklyWeekOption = option;
  }

  setMonthlyMode(mode: MonthlyMode): void {
    this.monthlyMode = mode;
  }

  /** Titre "Select Days" / "Day of Week" selon le mode */
  get daySectionTitle(): string {
    if (this.scheduleFrequency === 'daily') return 'Select Days';
    if (this.scheduleFrequency === 'weekly' || this.scheduleFrequency === 'biweekly') {
      return 'Day of Week';
    }
    return '';
  }

  /** Pour *ngFor trackBy sur les jours */
  trackByDay = (_: number, day: string) => day;

  /** Est-ce que le jour est actif, selon la fréquence ? */
  isDayActive(day: string): boolean {
    switch (this.scheduleFrequency) {
      case 'daily':
        return this.dailySelectedDays.includes(day);
      case 'weekly':
        return this.weeklySelectedDay === day;
      case 'biweekly':
        return this.biweeklySelectedDay === day;
      default:
        return false;
    }
  }

  /** Click sur un jour, comportement différent selon le mode */
  onDayClick(day: string): void {
    switch (this.scheduleFrequency) {
      case 'daily':
        if (this.dailySelectedDays.includes(day)) {
          this.dailySelectedDays = this.dailySelectedDays.filter(d => d !== day);
        } else {
          this.dailySelectedDays = [...this.dailySelectedDays, day];
        }
        break;

      case 'weekly':
        this.weeklySelectedDay = day;
        break;

      case 'biweekly':
        this.biweeklySelectedDay = day;
        break;
    }
  }

  /** Ordinal : 1st, 2nd, 3rd, 4th... pour le select mensuel */
  ordinal(n: number): string {
    const v = n % 100;
    if (v >= 11 && v <= 13) return `${n}th`;
    switch (n % 10) {
      case 1:
        return `${n}st`;
      case 2:
        return `${n}nd`;
      case 3:
        return `${n}rd`;
      default:
        return `${n}th`;
    }
  }
}
