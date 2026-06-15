import { Component, HostListener, inject, OnDestroy, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FeatherModule } from 'angular-feather';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { ActivatedRoute, Router } from '@angular/router';
import { debounceTime, filter, finalize, takeUntil, catchError } from 'rxjs/operators';
import { BehaviorSubject, Subject, of } from 'rxjs';

import {
  FormDetails,
  FormsApiService,
  FormSchedule,
  QuestionBE,
  QuestionTypeBE
} from '../services/forms-api.service';

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

type Tab = 'form' | 'schedule';
type ScheduleFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly';
type BiweeklyWeekOption = '1-3' | '2-4';
type MonthlyMode = 'start' | 'end' | 'specific';
type SaveStatus = 'UNSAVED' | 'DRAFT' | 'PUBLISHED';

@Component({
  selector: 'app-create-form',
  standalone: true,
  imports: [CommonModule, FormsModule, FeatherModule, DragDropModule],
  templateUrl: './create-form.component.html',
  styleUrl: './create-form.component.scss'
})
export class CreateFormComponent implements OnInit, OnDestroy {
  private api = inject(FormsApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);

  private destroy$ = new Subject<void>();
  private autoSaveSubject = new BehaviorSubject<void>(undefined);

  isEditingTitle = false;

  formId: string | null = null;
  isLoading = false;
  isSaving = false;
  isAutoSaving = false;
  hasUnsavedChanges = false;
  hasLoadedInitialData = false;
  private isLeaving = false;

  activeTab: Tab = 'form';
  showPreview = false;
  showQuestionSidebar = false;
  showInSignup = false;

  formTitle = 'Form Title';
  detailsTitle = 'Form Title';
  description = '';

  questions: QuestionItem[] = [];

  scheduleFrequency: ScheduleFrequency | null = null;
  scheduleFrequencyOptions = [
    { id: 'daily' as ScheduleFrequency, label: 'Daily' },
    { id: 'weekly' as ScheduleFrequency, label: 'Weekly' },
    { id: 'biweekly' as ScheduleFrequency, label: 'Biweekly' },
    { id: 'monthly' as ScheduleFrequency, label: 'Monthly' },
  ];

  scheduleWeekDays: string[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  dailySelectedDays: string[] = [];
  weeklySelectedDay: string | null = null;
  biweeklyWeekOption: BiweeklyWeekOption = '1-3';
  biweeklySelectedDay: string | null = null;
  monthlyMode: MonthlyMode | null = null;
  monthDays: number[] = Array.from({ length: 31 }, (_, i) => i + 1);
  monthlyDay: number | null = null;
  scheduleTime: string = '';

  fromProfile = false;
  clientIdFromProfile: string | null = null;
  addToLibrary = true;

  questionTypes = [
    { id: 'multiple-choice' as QuestionType, label: 'Multiple Choice' },
    { id: 'star-rating' as QuestionType, label: 'Star Rating' },
    { id: 'yes-no' as QuestionType, label: 'Yes/No' },
    { id: 'input-text' as QuestionType, label: 'Text Input' },
    { id: 'date' as QuestionType, label: 'Date' },
  ];

  ngOnInit(): void {
    this.formId = this.route.snapshot.paramMap.get('id');

    const returnTo = this.route.snapshot.queryParamMap.get('returnTo');
    this.clientIdFromProfile = this.route.snapshot.queryParamMap.get('clientId');
    this.fromProfile = returnTo === 'client-profile' && !!this.clientIdFromProfile;

    if (this.formId) {
      this.isLoading = true;

      this.api.getForOwner(this.formId)
        .pipe(finalize(() => {
          this.isLoading = false;
          this.hasLoadedInitialData = true;
        }))
        .subscribe({
          next: (form) => {
            this.patchFromBackend(form);
            this.hasUnsavedChanges = false;
          },
          error: () => this.router.navigate(['/forms'])
        });
    } else {
      this.formTitle = 'Form Title';
      this.detailsTitle = 'Form Title';
      this.questions = [];
      this.hasLoadedInitialData = true;
    }

    this.autoSaveSubject.pipe(
      debounceTime(900),
      takeUntil(this.destroy$),
      filter(() => this.hasLoadedInitialData),
      filter(() => this.hasUnsavedChanges),
      filter(() => !this.isSaving && !this.isAutoSaving)
    ).subscribe(() => {
      this.autoSave();
    });
  }

  ngOnDestroy(): void {
    if (this.hasUnsavedChanges && !this.isSaving && !this.isAutoSaving) {
      this.autoSave();
    }

    this.destroy$.next();
    this.destroy$.complete();
  }

  @HostListener('input')
  onAnyInput(): void {
    this.triggerAutoSave();
  }

  @HostListener('change')
  onAnyChange(): void {
    this.triggerAutoSave();
  }

  triggerAutoSave(): void {
    if (!this.hasLoadedInitialData) return;
    if (this.isSaving) return;

    this.hasUnsavedChanges = true;
    this.autoSaveSubject.next();
  }

  private autoSave(): void {
    if (this.isSaving || this.isAutoSaving) return;

    const payload = this.buildPayload('UNSAVED');

    this.isAutoSaving = true;
    this.hasUnsavedChanges = false;

    const req$ = this.formId
      ? this.api.updateForm(this.formId, payload)
      : this.api.createForm(payload);

    req$
      .pipe(
        finalize(() => (this.isAutoSaving = false)),
        catchError((err) => {
          this.hasUnsavedChanges = true;
          console.error('Auto-save error:', err);
          return of(null);
        })
      )
      .subscribe({
        next: (created: any) => {
          const createdId = created?.id ?? created?.formId ?? this.formId ?? null;

          if (!this.formId && createdId) {
            this.formId = createdId;

            if (!this.isLeaving) {
              this.location.replaceState(`/forms/${createdId}/edit`);
            }
          }
        }
      });
  }

  startEditTitle(): void {
    this.isEditingTitle = true;
  }

  finishEditTitle(): void {
    this.isEditingTitle = false;

    if (!this.detailsTitle || !this.detailsTitle.trim()) {
      this.detailsTitle = this.formTitle || 'Form Title';
    }

    this.triggerAutoSave();
  }

  titleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.finishEditTitle();
    }
  }

  back(): void {
    this.isLeaving = true;

    if (this.hasUnsavedChanges && !this.isSaving && !this.isAutoSaving) {
      this.autoSave();
    }

    this.router.navigate(['/forms'], {
      queryParams: { tab: 'unsaved' }
    });
  }

  setTab(tab: Tab): void {
    this.activeTab = tab;
  }

  openPreview(): void {
    this.showPreview = true;
  }

  closePreview(): void {
    this.showPreview = false;
  }

  openTypeDrawer(): void {
    this.showQuestionSidebar = true;
  }

  closeTypeDrawer(): void {
    this.showQuestionSidebar = false;
  }

  private newId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }

  addQuestion(type: QuestionType): void {
    const newQuestion: QuestionItem = {
      id: this.newId('q'),
      type,
      text: '',
      isRequired: true,
      options: type === 'multiple-choice' ? ['New Option'] : undefined,
    };

    this.questions = [...this.questions, newQuestion];
    this.showQuestionSidebar = false;
    this.triggerAutoSave();
  }

  removeQuestion(index: number): void {
    this.questions = this.questions.filter((_, i) => i !== index);
    this.triggerAutoSave();
  }

  onDrop(event: CdkDragDrop<QuestionItem[]>): void {
    moveItemInArray(this.questions, event.previousIndex, event.currentIndex);
    this.triggerAutoSave();
  }

  onQuestionChange(): void {
    this.triggerAutoSave();
  }

  addOption(q: QuestionItem): void {
    q.options = q.options || [];
    q.options.push('New Option');
    this.triggerAutoSave();
  }

  removeOption(q: QuestionItem, index: number): void {
    q.options = q.options || [];
    q.options.splice(index, 1);
    this.triggerAutoSave();
  }

  trackById = (_: number, q: QuestionItem) => q.id;
  trackByOptionIndex = (index: number, _opt: string) => index;
  trackByDay = (_: number, day: string) => day;

  private toQuestionTypeBE(t: QuestionType): QuestionTypeBE {
    switch (t) {
      case 'multiple-choice':
        return 'MULTIPLE_CHOICE';
      case 'yes-no':
        return 'YES_NO';
      case 'star-rating':
        return 'STAR_RATING';
      case 'date':
        return 'DATE';
      case 'scale':
      case 'input-text':
      case 'opinion-rating':
      case 'signature':
      case 'media':
      case 'progress-photo':
      default:
        return 'TEXT';
    }
  }

  private toQuestionTypeUI(t: string): QuestionType {
    switch (t) {
      case 'MULTIPLE_CHOICE':
        return 'multiple-choice';
      case 'YES_NO':
        return 'yes-no';
      case 'STAR_RATING':
        return 'star-rating';
      case 'DATE':
        return 'date';
      case 'TEXT':
      default:
        return 'input-text';
    }
  }

  private toBeBiweeklyWeeks(ui: BiweeklyWeekOption): 'W1_3' | 'W2_4' {
    return ui === '1-3' ? 'W1_3' : 'W2_4';
  }

  private fromBeBiweeklyWeeks(be: 'W1_3' | 'W2_4'): BiweeklyWeekOption {
    return be === 'W1_3' ? '1-3' : '2-4';
  }

  private patchFromBackend(form: FormDetails): void {
    this.formTitle = form.title || 'Form Title';
    this.detailsTitle = form.title || 'Form Title';
    this.description = form.description ?? '';
    this.showInSignup = !!(form as any).showInSignup;

    this.questions = (form.questions ?? [])
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map(q => ({
        id: q.id || this.newId('q'),
        type: this.toQuestionTypeUI(q.type),
        text: q.label ?? '',
        isRequired: !!q.required,
        options: (q.options ?? []).map(o => o.label),
      }));

    this.scheduleFrequency = null;
    this.dailySelectedDays = [];
    this.weeklySelectedDay = null;
    this.biweeklySelectedDay = null;
    this.monthlyMode = null;
    this.monthlyDay = null;
    this.scheduleTime = '';

    if (form.schedule) {
      this.scheduleFrequency = form.schedule.frequency.toLowerCase() as ScheduleFrequency;
      this.scheduleTime = form.schedule.time ?? '09:00';

      if (form.schedule.daysOfWeek?.length) {
        const uiDays = form.schedule.daysOfWeek.map(d => this.fromBeWeekday(d));

        if (this.scheduleFrequency === 'daily') {
          this.dailySelectedDays = uiDays;
        }

        if (this.scheduleFrequency === 'weekly') {
          this.weeklySelectedDay = uiDays[0];
        }

        if (this.scheduleFrequency === 'biweekly') {
          this.biweeklySelectedDay = uiDays[0];
        }
      }

      if (form.schedule.biweeklyWeeks) {
        this.biweeklyWeekOption = this.fromBeBiweeklyWeeks(form.schedule.biweeklyWeeks);
      }

      if (form.schedule.monthlyMode) {
        this.monthlyMode = form.schedule.monthlyMode.toLowerCase() as MonthlyMode;
      }

      if (form.schedule.monthlyDay) {
        this.monthlyDay = form.schedule.monthlyDay;
      }
    }
  }

  private toBeWeekday(d: string): string {
    const map: Record<string, string> = {
      Mon: 'MON',
      Tue: 'TUE',
      Wed: 'WED',
      Thu: 'THU',
      Fri: 'FRI',
      Sat: 'SAT',
      Sun: 'SUN',
    };

    return map[d] ?? 'MON';
  }

  private fromBeWeekday(d: string): string {
    const map: Record<string, string> = {
      MON: 'Mon',
      TUE: 'Tue',
      WED: 'Wed',
      THU: 'Thu',
      FRI: 'Fri',
      SAT: 'Sat',
      SUN: 'Sun',
    };

    return map[d] ?? 'Mon';
  }

  private buildPayload(status: SaveStatus = 'UNSAVED'): any {
    const title = this.detailsTitle?.trim() || this.formTitle?.trim() || 'Form Title';

    const questionsBE: QuestionBE[] = this.questions.map((q, idx) => ({
      id: q.id,
      type: this.toQuestionTypeBE(q.type),
      label: q.text ?? '',
      required: !!q.isRequired,
      order: idx,
      options: q.type === 'multiple-choice'
        ? (q.options ?? []).map((label, optionIndex) => ({
          id: `${q.id}-opt-${optionIndex}`,
          label: label ?? ''
        }))
        : [],
    }));

    let schedule: FormSchedule | undefined;

    if (this.scheduleFrequency && this.scheduleTime) {
      schedule = {
        frequency: this.scheduleFrequency.toUpperCase() as any,
        time: this.scheduleTime,
        daysOfWeek:
          this.scheduleFrequency === 'daily'
            ? this.dailySelectedDays.map(d => this.toBeWeekday(d))
            : this.scheduleFrequency === 'weekly' && this.weeklySelectedDay
              ? [this.toBeWeekday(this.weeklySelectedDay)]
              : this.scheduleFrequency === 'biweekly' && this.biweeklySelectedDay
                ? [this.toBeWeekday(this.biweeklySelectedDay)]
                : undefined,
        biweeklyWeeks: this.scheduleFrequency === 'biweekly'
          ? this.toBeBiweeklyWeeks(this.biweeklyWeekOption)
          : undefined,
        monthlyMode: this.scheduleFrequency === 'monthly' && this.monthlyMode
          ? (this.monthlyMode.toUpperCase() as any)
          : undefined,
        monthlyDay: this.scheduleFrequency === 'monthly' && this.monthlyMode === 'specific'
          ? this.monthlyDay ?? undefined
          : undefined,
      };
    }

    const payload: any = {
      title,
      description: this.description ?? '',
      questions: questionsBE,
      status,
      ...(schedule ? { schedule } : {})
    };

    if (this.fromProfile && !this.addToLibrary && this.clientIdFromProfile) {
      payload.clientOnlyFor = this.clientIdFromProfile;
    } else {
      payload.showInSignup = !!this.showInSignup;
    }

    return payload;
  }

  saveForm(): void {
    const payload = this.buildPayload('DRAFT');

    this.isSaving = true;
    this.hasUnsavedChanges = false;

    const returnTo = this.route.snapshot.queryParamMap.get('returnTo');
    const clientId = this.route.snapshot.queryParamMap.get('clientId');

    const req$ = this.formId
      ? this.api.updateForm(this.formId, payload)
      : this.api.createForm(payload);

    req$
      .pipe(finalize(() => (this.isSaving = false)))
      .subscribe({
        next: (created: any) => {
          const createdId = created?.id ?? created?.formId ?? this.formId ?? null;

          if (returnTo === 'client-profile' && clientId && createdId) {
            this.router.navigate(['/clients/profil-client/', clientId], {
              queryParams: {
                tab: 'checkins',
                openAssign: 1,
                preselectFormId: createdId
              },
              queryParamsHandling: 'merge'
            });
            return;
          }

          if (returnTo === 'dashboard') {
            this.router.navigate(['/coach-dashboard'], {
              state: {
                assignAfterCreate: {
                  type: 'checkin',
                  item: created,
                },
              },
            });
            return;
          }

          this.router.navigate(['/forms'], {
            queryParams: { tab: 'active' }
          });
        },
        error: (err) => {
          this.hasUnsavedChanges = true;
          console.error(err);
          alert("Erreur lors de l'enregistrement.");
        }
      });
  }

  setScheduleFrequency(freq: ScheduleFrequency): void {
    if (this.scheduleFrequency === freq) {
      this.scheduleFrequency = null;
      this.dailySelectedDays = [];
      this.weeklySelectedDay = null;
      this.biweeklySelectedDay = null;
      this.monthlyMode = null;
      this.monthlyDay = null;
      this.scheduleTime = '';
      this.triggerAutoSave();
      return;
    }

    this.scheduleFrequency = freq;
    this.dailySelectedDays = [];
    this.weeklySelectedDay = null;
    this.biweeklySelectedDay = null;
    this.monthlyMode = null;
    this.monthlyDay = null;

    if (!this.scheduleTime) {
      this.scheduleTime = '09:00';
    }

    this.triggerAutoSave();
  }

  setBiweeklyWeek(option: BiweeklyWeekOption): void {
    this.biweeklyWeekOption = option;
    this.triggerAutoSave();
  }

  setMonthlyMode(mode: MonthlyMode): void {
    this.monthlyMode = mode;
    this.triggerAutoSave();
  }

  get daySectionTitle(): string {
    if (this.scheduleFrequency === 'daily') return 'Select Days';
    if (this.scheduleFrequency === 'weekly' || this.scheduleFrequency === 'biweekly') return 'Day of Week';
    return '';
  }

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

  onDayClick(day: string): void {
    switch (this.scheduleFrequency) {
      case 'daily':
        this.dailySelectedDays = this.dailySelectedDays.includes(day)
          ? this.dailySelectedDays.filter(d => d !== day)
          : [...this.dailySelectedDays, day];
        break;
      case 'weekly':
        this.weeklySelectedDay = day;
        break;
      case 'biweekly':
        this.biweeklySelectedDay = day;
        break;
    }

    this.triggerAutoSave();
  }

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

  uiTypeLabel(t: QuestionType): string {
    switch (t) {
      case 'multiple-choice':
        return 'MULTIPLE CHOICE';
      case 'yes-no':
        return 'YES / NO';
      case 'star-rating':
        return 'STAR RATING';
      case 'scale':
        return 'SCALE';
      case 'date':
        return 'DATE';
      case 'input-text':
        return 'TEXT INPUT';
      default:
        return 'QUESTION';
    }
  }
}
