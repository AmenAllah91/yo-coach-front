import { Component, HostListener, inject, OnDestroy, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FeatherModule } from 'angular-feather';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { ActivatedRoute, Router } from '@angular/router';
import { debounceTime, filter, finalize, takeUntil, catchError } from 'rxjs/operators';
import { BehaviorSubject, Subject, of } from 'rxjs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import {
  FormDetails,
  FormsApiService,
  FormSchedule,
  QuestionBE,
  QuestionTypeBE,
  ShowConditionBE
} from '../services/forms-api.service';
import {
  CheckInScheduleFrequency,
  CheckInValidationIssue,
  isQuestionValid,
  validateCheckInForm,
  validateCheckInParts,
} from './check-in-form-validation';

export type QuestionType =
  | 'scale'
  | 'multiple-choice'
  | 'star-rating'
  | 'yes-no'
  | 'input-text'
  | 'long-text'
  | 'number'
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
  /** Stable ids of the options (same index): an answer keeps its choice when options are edited. */
  optionIds?: string[];
  maxStars?: number;
  minDate?: string;
  maxDate?: string;
  /** The part (page) it belongs to; none while the check-in has no parts. */
  sectionId?: string | null;
  /** Shown only when this is met. */
  condition?: ConditionItem | null;
}

/** "Show only if [question] is [answer]": `yes` for a yes/no question, `optionIds` for a choice. */
export interface ConditionItem {
  questionId: string | null;
  yes?: boolean | null;
  optionIds: string[];
}

/** A part of the check-in: one page for the client. */
export interface SectionItem {
  id: string;
  title: string;
  description: string;
  /** The coach's word shown when the client finishes the part. */
  endMessage: string;
  condition?: ConditionItem | null;
}

type ScheduleFrequency = CheckInScheduleFrequency;
type BiweeklyWeekOption = '1-3' | '2-4';
type MonthlyMode = 'start' | 'end' | 'specific';
type SaveStatus = 'UNSAVED' | 'DRAFT' | 'PUBLISHED';

@Component({
  selector: 'app-create-form',
  standalone: true,
  imports: [CommonModule, FormsModule, FeatherModule, DragDropModule, TranslateModule],
  templateUrl: './create-form.component.html',
  styleUrl: './create-form.component.scss'
})
export class CreateFormComponent implements OnInit, OnDestroy {
  private api = inject(FormsApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);
  private translate = inject(TranslateService);

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

  showPreview = false;
  showQuestionSidebar = false;
  questionMenuOpensAbove = false;
  questionMenuMaxHeight = 430;
  showInSignup = false;
  showValidationSummary = false;
  validationIssues: CheckInValidationIssue[] = [];
  hasPublishAttempted = false;

  formTitle = '';
  detailsTitle = '';
  description = '';

  readonly today = new Date();

  /** Kept in page order: part by part, then the order inside each part. */
  questions: QuestionItem[] = [];
  /** Parts of the check-in; none: a single page. */
  sections: SectionItem[] = [];
  /** Part the next added question goes into (null: the last part, or the only list). */
  addTarget: string | null = null;
  /** Shown after a move that put a condition before its question, with the order to go back to. */
  moveNotice: { names: string; order: Array<{ id: string; sectionId: string | null }>; sectionIds: string[] } | null = null;
  private moveNoticeTimer?: ReturnType<typeof setTimeout>;

  scheduleFrequency: ScheduleFrequency | null = null;
  scheduleFrequencyOptions = [
    { id: 'daily' as ScheduleFrequency, label: 'DAILY' },
    { id: 'weekly' as ScheduleFrequency, label: 'WEEKLY' },
    { id: 'biweekly' as ScheduleFrequency, label: 'BIWEEKLY' },
    { id: 'monthly' as ScheduleFrequency, label: 'MONTHLY' },
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

  /** Status in the database: a published check-in is saved on demand only, never half-edited by the auto-save. */
  savedStatus: SaveStatus | 'DRAFT' | null = null;

  fromProfile = false;
  clientIdFromProfile: string | null = null;
  addToLibrary = true;

  questionTypes = [
    { id: 'input-text' as QuestionType, label: 'SHORT_ANSWER_LABEL' },
    { id: 'long-text' as QuestionType, label: 'LONG_ANSWER_LABEL' },
    { id: 'multiple-choice' as QuestionType, label: 'MULTIPLE_CHOICE_LABEL' },
    { id: 'star-rating' as QuestionType, label: 'RATING_SCALE_LABEL' },
    { id: 'yes-no' as QuestionType, label: 'YES_NO_LABEL' },
    { id: 'number' as QuestionType, label: 'NUMBER_LABEL' },
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
      this.formTitle = '';
      this.detailsTitle = '';
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

  get isPublished(): boolean {
    return this.savedStatus === 'PUBLISHED';
  }

  ngOnDestroy(): void {
    if (this.hasUnsavedChanges && !this.isSaving && !this.isAutoSaving && !this.isPublished) {
      this.autoSave();
    }

    clearTimeout(this.moveNoticeTimer);
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

  @HostListener('document:click', ['$event'])
  closeQuestionMenuOnOutsideClick(event: MouseEvent): void {
    if (!this.showQuestionSidebar) return;

    const target = event.target as HTMLElement | null;
    if (target?.closest('.question-add-anchor, .question-type-menu')) return;

    this.closeTypeDrawer();
  }

  @HostListener('document:keydown.escape')
  closeQuestionMenuOnEscape(): void {
    this.closeTypeDrawer();
  }

  triggerAutoSave(): void {
    if (!this.hasLoadedInitialData) return;
    if (this.isSaving) return;

    if (this.hasPublishAttempted) {
      this.refreshValidationIssues();
    }

    this.hasUnsavedChanges = true;
    this.autoSaveSubject.next();
  }

  private autoSave(): void {
    if (this.isSaving || this.isAutoSaving || this.isPublished) return;

    // A draft stays a draft; only a form never published nor saved is "unsaved".
    const payload = this.buildPayload(this.savedStatus === 'DRAFT' ? 'DRAFT' : 'UNSAVED');

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
      this.detailsTitle = this.formTitle || this.translate.instant('FORM_TITLE');
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
    if (this.isPublished) {
      if (this.hasUnsavedChanges && !confirm(this.translate.instant('CHECKIN_LEAVE_WITHOUT_SAVING'))) return;
      this.hasUnsavedChanges = false;
      this.router.navigate(['/forms'], { queryParams: { tab: 'active' } });
      return;
    }

    this.isLeaving = true;

    if (this.hasUnsavedChanges && !this.isSaving && !this.isAutoSaving) {
      this.autoSave();
    }

    this.router.navigate(['/forms'], {
      queryParams: { tab: this.savedStatus === 'DRAFT' ? 'active' : 'unsaved' }
    });
  }

  openPreview(): void {
    this.showPreview = true;
  }

  closePreview(): void {
    this.showPreview = false;
  }

  /** `target`: the part the question goes into (null: the last part, or the only list). */
  openTypeDrawer(event: MouseEvent, target: string | null = null): void {
    this.addTarget = target;
    const button = event.currentTarget as HTMLElement;
    const bounds = button.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const menuHeight = 360;
    const gap = 8;
    const edge = 8;
    const spaceAbove = bounds.top - gap - edge;
    const spaceBelow = viewportHeight - bounds.bottom - gap - edge;

    this.questionMenuOpensAbove = spaceBelow < menuHeight && spaceAbove > spaceBelow;
    this.questionMenuMaxHeight = Math.max(0, Math.min(430,
      this.questionMenuOpensAbove ? spaceAbove : spaceBelow));
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
      options: type === 'multiple-choice' ? ['', ''] : undefined,
      optionIds: type === 'multiple-choice' ? [this.newId('opt'), this.newId('opt')] : undefined,
      ...(type === 'star-rating' ? { maxStars: 5 } : {}),
      sectionId: this.sections.length
        ? (this.addTarget ?? this.sections[this.sections.length - 1].id)
        : null,
      condition: null,
    };

    this.questions = [...this.questions, newQuestion];
    this.keepPageOrder();
    this.showQuestionSidebar = false;
    this.triggerAutoSave();
    setTimeout(() => document.getElementById('question-text-' + newQuestion.id)?.focus());
  }

  removeQuestion(questionId: string): void {
    const removed = this.questions.find(q => q.id === questionId);
    const dependents = removed ? this.dependentsOf(removed) : [];
    if (dependents.length
      && !confirm(this.translate.instant('CHECKIN_REMOVE_SOURCE_CONFIRM', { names: this.dependentNames(dependents) }))) return;
    this.questions = this.questions.filter(q => q.id !== questionId);
    // A condition on a removed question no longer means anything.
    [...this.questions, ...this.sections].forEach(holder => {
      if (holder.condition?.questionId === questionId) holder.condition = null;
    });
    this.refreshValidationIssues();
    this.triggerAutoSave();
  }

  onDrop(event: CdkDragDrop<QuestionItem[]>): void {
    this.reorder(() => moveItemInArray(this.questions, event.previousIndex, event.currentIndex));
    this.refreshValidationIssues();
    this.triggerAutoSave();
  }

  // ───────────── Parts (one page each for the client) ─────────────

  trackBySection = (_: number, s: SectionItem) => s.id;

  /** The questions of a part, in their order. */
  partQuestions(sectionId: string): QuestionItem[] {
    return this.questions.filter(q => q.sectionId === sectionId);
  }

  /** The part this question opens (its first question), for the preview's part titles. */
  partStartingAt(q: QuestionItem): SectionItem | null {
    if (!q.sectionId) return null;
    return this.partQuestions(q.sectionId)[0] === q ? this.sections.find(s => s.id === q.sectionId) ?? null : null;
  }

  /** Number shown on a question card: its rank in the whole check-in. */
  displayNumber(q: QuestionItem): number {
    return this.questions.indexOf(q) + 1;
  }

  /** Questions sorted part by part; a question of no known part goes to the first one. */
  private keepPageOrder(): void {
    if (!this.sections.length) {
      this.questions.forEach(q => (q.sectionId = null));
      return;
    }
    const known = new Set(this.sections.map(s => s.id));
    this.questions.forEach(q => {
      if (!q.sectionId || !known.has(q.sectionId)) q.sectionId = this.sections[0].id;
    });
    this.questions = this.sections.flatMap(s => this.questions.filter(q => q.sectionId === s.id));
  }

  private newPart(index: number): SectionItem {
    return {
      id: this.newId('part'),
      title: this.translate.instant('CHECKIN_PART_DEFAULT_TITLE', { number: index + 1 }),
      description: '',
      endMessage: '',
      condition: null,
    };
  }

  /** First split: every current question goes to part 1, part 2 is ready for the next ones. */
  splitIntoParts(): void {
    this.sections = [this.newPart(0), this.newPart(1)];
    this.keepPageOrder();
    this.triggerAutoSave();
  }

  addPart(): void {
    const part = this.newPart(this.sections.length);
    this.sections = [...this.sections, part];
    this.triggerAutoSave();
    setTimeout(() => document.getElementById('part-title-' + part.id)?.focus());
  }

  /** Its questions are kept: they join the part before (or after, for the first). */
  removePart(index: number): void {
    const part = this.sections[index];
    const count = this.partQuestions(part.id).length;
    if (count && !confirm(this.translate.instant('CHECKIN_REMOVE_PART_CONFIRM', { count }))) return;
    const neighbour = this.sections[index - 1] ?? this.sections[index + 1];
    this.questions.forEach(q => {
      if (q.sectionId === part.id) q.sectionId = neighbour?.id ?? null;
    });
    this.sections = this.sections.filter(s => s.id !== part.id);
    this.keepPageOrder();
    this.refreshValidationIssues();
    this.triggerAutoSave();
  }

  movePart(index: number, step: -1 | 1): void {
    const target = index + step;
    if (target < 0 || target >= this.sections.length) return;
    this.reorder(() => {
      moveItemInArray(this.sections, index, target);
      this.sections = [...this.sections];
      this.keepPageOrder();
    });
    this.refreshValidationIssues();
    this.triggerAutoSave();
  }

  moveQuestionToPart(q: QuestionItem, sectionId: string): void {
    if (q.sectionId === sectionId) return;
    // Goes to the end of its new part.
    this.reorder(() => {
      this.questions = [...this.questions.filter(item => item !== q), { ...q, sectionId }];
      this.keepPageOrder();
    });
    this.refreshValidationIssues();
    this.triggerAutoSave();
  }

  onDropInPart(event: CdkDragDrop<string>, sectionId: string): void {
    this.reorder(() => {
      const list = this.partQuestions(sectionId);
      moveItemInArray(list, event.previousIndex, event.currentIndex);
      this.questions = this.sections.flatMap(s => s.id === sectionId ? list : this.partQuestions(s.id));
    });
    this.refreshValidationIssues();
    this.triggerAutoSave();
  }

  // ───────────── Conditions ("show only if…") ─────────────

  private canDecide(q: QuestionItem): boolean {
    return q.type === 'yes-no' || q.type === 'multiple-choice';
  }

  /** Earlier yes/no or choice questions a question may depend on. */
  sourcesBefore(q: QuestionItem): QuestionItem[] {
    return this.questions.slice(0, this.questions.indexOf(q)).filter(item => this.canDecide(item));
  }

  /** Questions of the earlier parts a part may depend on. */
  sourcesBeforePart(part: SectionItem): QuestionItem[] {
    const earlier = new Set(this.sections.slice(0, this.sections.indexOf(part)).map(s => s.id));
    return this.questions.filter(q => earlier.has(q.sectionId ?? '') && this.canDecide(q));
  }

  sourceOf(holder: QuestionItem | SectionItem): QuestionItem | undefined {
    const id = holder.condition?.questionId;
    return id ? this.questions.find(q => q.id === id) : undefined;
  }

  /** Its question is no longer one it may depend on (moved below it, or into a later part). */
  isConditionMisplaced(holder: QuestionItem | SectionItem, sources: QuestionItem[]): boolean {
    const source = this.sourceOf(holder);
    return !!source && !sources.includes(source);
  }

  /** Questions and parts shown or hidden by this question's answer. */
  dependentsOf(q: QuestionItem): Array<QuestionItem | SectionItem> {
    return [...this.questions, ...this.sections].filter(holder => holder.condition?.questionId === q.id);
  }

  /** "Q4, Partie 3". */
  dependentNames(holders: Array<QuestionItem | SectionItem>): string {
    return holders.map(holder => {
      const index = this.questions.indexOf(holder as QuestionItem);
      if (index >= 0) return `Q${index + 1}`;
      const part = holder as SectionItem;
      return part.title?.trim()
        || this.translate.instant('CHECKIN_PART_DEFAULT_TITLE', { number: this.sections.indexOf(part) + 1 });
    }).join(', ');
  }

  private misplacedConditions(): Array<QuestionItem | SectionItem> {
    return [
      ...this.questions.filter(q => this.isConditionMisplaced(q, this.sourcesBefore(q))),
      ...this.sections.filter(s => this.isConditionMisplaced(s, this.sourcesBeforePart(s))),
    ];
  }

  /** Runs a reordering; when it puts a condition before its question, says so and offers to undo it. */
  private reorder(move: () => void): void {
    const order = this.questions.map(q => ({ id: q.id, sectionId: q.sectionId ?? null }));
    const sectionIds = this.sections.map(s => s.id);
    const alreadyMisplaced = new Set(this.misplacedConditions().map(holder => holder.id));
    move();
    const broken = this.misplacedConditions().filter(holder => !alreadyMisplaced.has(holder.id));
    if (!broken.length) return;
    clearTimeout(this.moveNoticeTimer);
    this.moveNotice = { names: this.dependentNames(broken), order, sectionIds };
    this.moveNoticeTimer = setTimeout(() => (this.moveNotice = null), 10000);
  }

  undoMove(): void {
    const notice = this.moveNotice;
    if (!notice) return;
    const questionsById = new Map(this.questions.map(q => [q.id, q]));
    const kept = new Set(notice.order.map(item => item.id));
    this.questions = [
      ...notice.order
        .filter(item => questionsById.has(item.id))
        .map(item => ({ ...questionsById.get(item.id)!, sectionId: item.sectionId })),
      ...this.questions.filter(q => !kept.has(q.id)),
    ];
    const sectionsById = new Map(this.sections.map(s => [s.id, s]));
    this.sections = [
      ...notice.sectionIds.filter(id => sectionsById.has(id)).map(id => sectionsById.get(id)!),
      ...this.sections.filter(s => !notice.sectionIds.includes(s.id)),
    ];
    this.keepPageOrder();
    this.closeMoveNotice();
    this.refreshValidationIssues();
    this.triggerAutoSave();
  }

  closeMoveNotice(): void {
    clearTimeout(this.moveNoticeTimer);
    this.moveNotice = null;
  }

  startCondition(holder: QuestionItem | SectionItem, sources: QuestionItem[]): void {
    // The closest earlier question is the most likely one.
    holder.condition = { questionId: sources[sources.length - 1]?.id ?? null, yes: null, optionIds: [] };
    this.triggerAutoSave();
  }

  setConditionSource(holder: QuestionItem | SectionItem, questionId: string): void {
    holder.condition = { questionId, yes: null, optionIds: [] };
    this.triggerAutoSave();
  }

  setConditionYes(holder: QuestionItem | SectionItem, yes: boolean): void {
    if (!holder.condition) return;
    holder.condition.yes = yes;
    this.refreshValidationIssues();
    this.triggerAutoSave();
  }

  isConditionOption(holder: QuestionItem | SectionItem, source: QuestionItem, index: number): boolean {
    const id = source.optionIds?.[index];
    return !!id && !!holder.condition?.optionIds.includes(id);
  }

  toggleConditionOption(holder: QuestionItem | SectionItem, source: QuestionItem, index: number): void {
    if (!holder.condition) return;
    source.optionIds = source.optionIds || [];
    if (!source.optionIds[index]) source.optionIds[index] = this.newId('opt');
    const id = source.optionIds[index];
    const ids = holder.condition.optionIds;
    holder.condition.optionIds = ids.includes(id) ? ids.filter(item => item !== id) : [...ids, id];
    this.refreshValidationIssues();
    this.triggerAutoSave();
  }

  clearCondition(holder: QuestionItem | SectionItem): void {
    holder.condition = null;
    this.refreshValidationIssues();
    this.triggerAutoSave();
  }

  /** "Partie 2 · Si Q3 = Oui": a short reading of a condition, for the preview. */
  conditionSummary(holder: QuestionItem | SectionItem): string {
    const source = this.sourceOf(holder);
    if (!source || !holder.condition) return '';
    const answers = source.type === 'yes-no'
      ? (holder.condition.yes == null ? '' : this.translate.instant(holder.condition.yes ? 'YES' : 'NO'))
      : (source.options ?? [])
          .filter((_, i) => holder.condition!.optionIds.includes(source.optionIds?.[i] ?? ''))
          .join(' / ');
    return this.translate.instant('CHECKIN_CONDITION_SUMMARY', { number: this.displayNumber(source), answers });
  }

  onQuestionChange(): void {
    this.triggerAutoSave();
  }

  addOption(q: QuestionItem): void {
    q.options = q.options || [];
    q.optionIds = q.optionIds || [];
    q.options.push('');
    q.optionIds[q.options.length - 1] = this.newId('opt');
    this.triggerAutoSave();
  }

  removeOption(q: QuestionItem, index: number): void {
    const optionId = q.optionIds?.[index];
    const users = optionId ? this.dependentsOf(q).filter(holder => holder.condition!.optionIds.includes(optionId)) : [];
    if (users.length
      && !confirm(this.translate.instant('CHECKIN_REMOVE_OPTION_CONFIRM', { names: this.dependentNames(users) }))) return;
    q.options = q.options || [];
    q.options.splice(index, 1);
    const [removedId] = q.optionIds?.splice(index, 1) ?? [];
    // Conditions on this option forget it.
    if (removedId) {
      [...this.questions, ...this.sections].forEach(holder => {
        if (holder.condition?.questionId === q.id) {
          holder.condition.optionIds = holder.condition.optionIds.filter(id => id !== removedId);
        }
      });
    }
    this.refreshValidationIssues();
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
      case 'long-text':
      case 'number':
      case 'opinion-rating':
      case 'signature':
      case 'media':
      case 'progress-photo':
      default:
        return 'TEXT';
    }
  }

  /** The back stores long answers and numbers as TEXT with a format. */
  private toTextFormat(t: QuestionType): 'LONG' | 'NUMBER' | null {
    return t === 'long-text' ? 'LONG' : t === 'number' ? 'NUMBER' : null;
  }

  private toQuestionTypeUI(t: string, textFormat?: string | null): QuestionType {
    if (t === 'TEXT' && textFormat === 'LONG') return 'long-text';
    if (t === 'TEXT' && textFormat === 'NUMBER') return 'number';
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
    this.formTitle = form.title || this.translate.instant('FORM_TITLE');
    this.detailsTitle = form.title || this.translate.instant('FORM_TITLE');
    this.description = form.description ?? '';
    this.showInSignup = !!form.showInSignup;
    this.savedStatus = (form.status as SaveStatus | 'DRAFT' | undefined) ?? null;

    this.questions = (form.questions ?? [])
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map(q => ({
        id: q.id || this.newId('q'),
        type: this.toQuestionTypeUI(q.type, q.textFormat),
        text: q.label ?? '',
        isRequired: !!q.required,
        options: (q.options ?? []).map(o => o.label),
        optionIds: (q.options ?? []).map(o => o.id || this.newId('opt')),
        ...(q.type === 'STAR_RATING' ? { maxStars: 5 } : {}),
        sectionId: q.sectionId ?? null,
        condition: this.fromConditionBE(q.condition),
      }));
    this.sections = (form.sections ?? []).map(s => ({
      id: s.id,
      title: s.title ?? '',
      description: s.description ?? '',
      endMessage: s.endMessage ?? '',
      condition: this.fromConditionBE(s.condition),
    }));
    this.keepPageOrder();

    this.scheduleFrequency = null;
    this.dailySelectedDays = [];
    this.weeklySelectedDay = null;
    this.biweeklySelectedDay = null;
    this.monthlyMode = null;
    this.monthlyDay = null;
    this.scheduleTime = '';

    if (form.schedule?.frequency) {
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

      if (this.scheduleFrequency === 'monthly') {
        this.monthlyDay = form.schedule.monthlyMode === 'START'
          ? 1
          : form.schedule.monthlyMode === 'END'
            ? 31
            : form.schedule.monthlyDay ?? null;
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

  private fromConditionBE(condition?: ShowConditionBE | null): ConditionItem | null {
    if (!condition?.questionId) return null;
    return { questionId: condition.questionId, yes: condition.yes ?? null, optionIds: [...(condition.optionIds ?? [])] };
  }

  /** A condition still being chosen is saved as is in a draft; publishing checks it is complete. */
  private toConditionBE(condition?: ConditionItem | null): ShowConditionBE | null {
    if (!condition?.questionId) return null;
    return { questionId: condition.questionId, yes: condition.yes ?? null, optionIds: condition.optionIds };
  }

  private buildPayload(status: SaveStatus = 'UNSAVED'): any {
    const title = this.detailsTitle?.trim() || this.formTitle?.trim() || this.translate.instant('FORM_TITLE');

    const questionsBE: QuestionBE[] = this.questions.map((q, idx) => ({
      id: q.id,
      type: this.toQuestionTypeBE(q.type),
      label: q.text ?? '',
      required: !!q.isRequired,
      order: idx,
      textFormat: this.toTextFormat(q.type),
      options: q.type === 'multiple-choice'
        ? (q.options ?? []).map((label, optionIndex) => ({
          id: q.optionIds?.[optionIndex] || `${q.id}-opt-${optionIndex}`,
          label: label ?? ''
        }))
        : [],
      sectionId: q.sectionId ?? null,
      condition: this.toConditionBE(q.condition),
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
        monthlyMode: this.scheduleFrequency === 'monthly'
          ? 'SPECIFIC'
          : undefined,
        monthlyDay: this.scheduleFrequency === 'monthly'
          ? this.monthlyDay ?? undefined
          : undefined,
      };
    }

    const payload: any = {
      title,
      description: this.description ?? '',
      questions: questionsBE,
      sections: this.sections.map(s => ({
        id: s.id,
        title: s.title?.trim() ?? '',
        description: s.description?.trim() ?? '',
        endMessage: s.endMessage?.trim() ?? '',
        condition: this.toConditionBE(s.condition),
      })),
      status,
      // A schedule without frequency tells the server automatic sending is off (nothing sent would keep the old one).
      ...(schedule ? { schedule } : !this.scheduleFrequency ? { schedule: {} } : {})
    };

    if (this.fromProfile && !this.addToLibrary && this.clientIdFromProfile) {
      payload.clientOnlyFor = this.clientIdFromProfile;
    } else {
      payload.showInSignup = !!this.showInSignup;
    }

    return payload;
  }

  saveForm(): void {
    this.hasPublishAttempted = true;
    this.refreshValidationIssues();

    if (this.validationIssues.length > 0) {
      this.showValidationSummary = true;
      return;
    }

    const payload = this.buildPayload('PUBLISHED');

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
          alert(this.translate.instant('SAVE_FORM_ERROR'));
        }
      });
  }

  /** Switch on: every Monday at 09:00, so the coach only adjusts. Switch off: no automatic sending. */
  toggleAutoSend(on: boolean): void {
    if (on) {
      this.setScheduleFrequency('weekly');
      this.weeklySelectedDay = 'Mon';
      this.scheduleTime = this.scheduleTime || '09:00';
    } else {
      this.scheduleFrequency = null;
      this.dailySelectedDays = [];
      this.weeklySelectedDay = null;
      this.biweeklySelectedDay = null;
      this.monthlyMode = null;
      this.monthlyDay = null;
      this.scheduleTime = '';
    }
    this.refreshValidationIssues();
    this.triggerAutoSave();
  }

  setScheduleFrequency(freq: ScheduleFrequency): void {
    if (this.scheduleFrequency === freq) return;

    this.scheduleFrequency = freq;
    this.dailySelectedDays = [];
    this.weeklySelectedDay = null;
    this.biweeklySelectedDay = null;
    this.monthlyMode = null;
    this.monthlyDay = null;

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
    if (this.scheduleFrequency === 'weekly' || this.scheduleFrequency === 'biweekly') return 'DAY_OF_WEEK';
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

  isQuestionIncomplete(question: QuestionItem, index: number): boolean {
    return !isQuestionValid(question, index);
  }

  hasValidationError(targetId: string): boolean {
    return this.validationIssues.some(issue => issue.targetId === targetId);
  }

  closeValidationSummary(): void {
    this.showValidationSummary = false;
  }

  focusValidationIssue(issue: CheckInValidationIssue): void {
    this.showValidationSummary = false;

    setTimeout(() => {
      const target = document.getElementById(issue.targetId);
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (target instanceof HTMLElement) {
        target.focus({ preventScroll: true });
      }
    });
  }

  private refreshValidationIssues(): void {
    if (!this.hasPublishAttempted) return;

    this.validationIssues = validateCheckInForm(this.questions, {
      frequency: this.scheduleFrequency,
      sendTime: this.scheduleTime,
      weeklyDay: this.weeklySelectedDay,
      biweeklyDay: this.biweeklySelectedDay,
      monthlyDay: this.monthlyDay,
    }).concat(validateCheckInParts(this.sections, this.questions));

    if (this.validationIssues.length === 0) {
      this.showValidationSummary = false;
    }
  }

  ordinal(n: number): string {
    if (this.translate.currentLang === 'fr') return `${n}${n === 1 ? 'er' : 'e'}`;
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
        return 'MULTIPLE_CHOICE_LABEL';
      case 'yes-no':
        return 'YES_NO_LABEL';
      case 'star-rating':
        return 'RATING_SCALE_LABEL';
      case 'scale':
        return 'SCALE_LABEL';
      case 'date':
        return 'DATE';
      case 'input-text':
        return 'SHORT_ANSWER_LABEL';
      case 'long-text':
        return 'LONG_ANSWER_LABEL';
      case 'number':
        return 'NUMBER_LABEL';
      default:
        return 'QUESTION';
    }
  }
}
