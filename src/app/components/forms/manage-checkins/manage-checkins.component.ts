import {Component, OnInit} from '@angular/core';
import {CommonModule} from "@angular/common";
import {FormsModule} from "@angular/forms";
type ClientStatus = 'due_today' | 'overdue' | 'to_review' | 'reviewed' | 'upcoming';
import { finalize, forkJoin } from 'rxjs';
import { AssignmentsApiService, FormAssignment } from '../services/assignments-api.service';
import { FormsApiService, FormDetails } from '../services/forms-api.service';

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

interface ClientData {
  id: string;
  name: string;
  avatar?: string;
  formType: string;
  date: string;
  status: ClientStatus;
  formName?: string;
  questions?: Question[];
  answers?: Answer[];
  coachFeedback?: string;
  submittedDate?: string;
}




const ITEMS_PER_PAGE = 5;

@Component({
  selector: 'app-manage-checkins',
  standalone: true,
  imports: [CommonModule,FormsModule],
  templateUrl: './manage-checkins.component.html',
  styleUrl: './manage-checkins.component.scss'
})
export class ManageCheckinsComponent implements OnInit{
  activeTab: ClientStatus = 'due_today';
  searchQuery = '';
  currentPage = 1;

  // Modal state
  selectedClient: ClientData | null = null;
  isModalOpen = false;
  modalMode: 'preview' | 'view' = 'preview'; // preview = voir questions, view = voir réponses
  QuestionType = QuestionType;

  // Feedback state (pour to_review)
  coachFeedback = '';

  // tabs config
  tabs: { id: ClientStatus; label: string }[] = [
    { id: 'due_today', label: 'Due Today' },
    { id: 'overdue', label: 'Overdue' },
    { id: 'to_review', label: 'To Be Reviewed' },
    { id: 'reviewed', label: 'Reviewed' },
    { id: 'upcoming', label: 'Upcoming' },
  ];

  clients: ClientData[];
  loading = false;
  error: string | null = null;

  assignments: FormAssignment[] = [];

  constructor(
    private assignmentsApi: AssignmentsApiService,
    private formsApi: FormsApiService
  ) {}

  ngOnInit(): void {
    this.loadAssignments();
  }

  loadAssignments(): void {
    this.loading = true;
    this.error = null;

    this.assignmentsApi.pageOwnerAssignments(0, 200, 'dueAt', 'ASC')
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (res) => {
          this.assignments = res.content ?? [];
          this.clients = this.assignments.map(a => this.assignmentToClient(a));
        },
        error: (err) => {
          this.error = err?.error?.message ?? 'Failed to load assignments.';
        }
      });
  }

  private assignmentToClient(a: FormAssignment): ClientData {
    return {
      id: a.id,
      name: a.assigneeId,          // until you have assignee name in DTO
      avatar: undefined,           // optional
      formType: a.formId,          // will be replaced when we fetch form
      formName: a.formId,
      date: this.formatDueDate(a.dueAt),
      status: this.mapAssignmentToClientStatus(a),
      submittedDate: a.submittedAt ? this.formatDate(a.submittedAt) : undefined,
    };
  }

  private mapAssignmentToClientStatus(a: FormAssignment): ClientStatus {
    // canceled -> hide or treat separately (here we exclude it)
    if (a.status === 'CANCELED') return 'upcoming';

    // submitted => to_review or reviewed
    if (a.submittedAt) {
      const sub = new Date(a.submittedAt).getTime();
      const op = a.openedAt ? new Date(a.openedAt).getTime() : 0;
      return op > sub ? 'reviewed' : 'to_review';
    }

    // not submitted: due_today / overdue / upcoming
    if (!a.dueAt) return 'upcoming';

    const due = new Date(a.dueAt);
    const now = new Date();

    // compare date-only
    const due0 = new Date(due); due0.setHours(0,0,0,0);
    const now0 = new Date(now); now0.setHours(0,0,0,0);

    if (due0.getTime() === now0.getTime()) return 'due_today';
    if (due0.getTime() < now0.getTime()) return 'overdue';
    return 'upcoming';
  }

  private formatDueDate(iso?: string): string {
    if (!iso) return '';
    return this.formatDate(iso);
  }

  private formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
  }



  // counts
  get counts(): Record<ClientStatus, number> {
    return this.clients.reduce((acc, c) => {
      acc[c.status] = (acc[c.status] || 0) + 1;
      return acc;
    }, {} as Record<ClientStatus, number>);
  }

  // filtered
  get filteredClients(): ClientData[] {
    const q = this.searchQuery.trim().toLowerCase();
    return this.clients.filter((c) => {
      const matchesTab = c.status === this.activeTab;
      const matchesSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.formType.toLowerCase().includes(q);
      return matchesTab && matchesSearch;
    });
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredClients.length / ITEMS_PER_PAGE));
  }

  get safePage(): number {
    return Math.min(this.currentPage, this.totalPages);
  }

  get paginatedClients(): ClientData[] {
    const start = (this.safePage - 1) * ITEMS_PER_PAGE;
    return this.filteredClients.slice(start, start + ITEMS_PER_PAGE);
  }

  get pages(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  // actions
  setTab(tab: ClientStatus) {
    this.activeTab = tab;
    this.currentPage = 1;
  }

  onSearch(value: string) {
    this.searchQuery = value;
    this.currentPage = 1;
  }

  prevPage() {
    this.currentPage = Math.max(1, this.safePage - 1);
  }

  nextPage() {
    this.currentPage = Math.min(this.totalPages, this.safePage + 1);
  }

  goToPage(p: number) {
    this.currentPage = p;
  }

  initials(name: string) {
    return name?.trim()?.charAt(0)?.toUpperCase() || '?';
  }

  openCheckInModal(client: ClientData) {
    // find the assignment by client.id (assignment id)
    const assignment = this.assignments.find(a => a.id === client.id);
    if (!assignment) return;

    this.selectedClient = client;
    this.isModalOpen = true;

    // mode
    this.modalMode = (client.status === 'to_review' || client.status === 'reviewed') ? 'view' : 'preview';

    // ✅ fetch form details to show title + questions
    this.formsApi.getFormById(assignment.formId).subscribe({
      next: (form: FormDetails) => {
        if (!this.selectedClient) return;
        this.selectedClient.formType = form.title;
        this.selectedClient.formName = form.title;

        // adapt mapping if your FormDetails uses QuestionBE
        this.selectedClient.questions = (form.questions ?? []).map(q => ({
          id: q.id,
          type: q.type as any,     // or map to your enum if needed
          label: q.label,
          required: q.required,
          order: q.order,
          options: (q.options ?? []).map(o => ({ id: o.id, label: o.label }))
        }));
      },
      error: () => {
        // keep modal open but show fallback title
      }
    });
  }


  closeModal() {
    this.isModalOpen = false;
    this.selectedClient = null;
    this.coachFeedback = '';
  }

  // Récupère la réponse soumise pour une question
  getSubmittedAnswer(questionId: string): Answer | undefined {
    return this.selectedClient?.answers?.find(a => a.questionId === questionId);
  }

  // Récupère le label d'une option pour MULTIPLE_CHOICE
  getOptionLabel(question: Question, optionId: string): string {
    return question.options?.find(opt => opt.id === optionId)?.label || '';
  }

  getStarsArray(max: number = 5): number[] {
    return Array.from({ length: max }, (_, i) => i + 1);
  }

  isStarFilled(questionId: string, starValue: number): boolean {
    const answer = this.getSubmittedAnswer(questionId);
    return starValue <= (answer?.rating || 0);
  }

  // Action pour marquer comme reviewed avec feedback
  markAsReviewed() {
    if (!this.selectedClient) return;

    console.log('Marking as reviewed:', {
      clientId: this.selectedClient.id,
      feedback: this.coachFeedback
    });

    // TODO: Appel API pour enregistrer le feedback et changer le statut
    // this.checkInService.markAsReviewed(this.selectedClient.id, this.coachFeedback).subscribe(...)

    this.closeModal();
  }

  // helpers style/status
  statusLabel(status: ClientStatus): string {
    switch (status) {
      case 'due_today':
        return 'Due Today';
      case 'overdue':
        return 'Overdue';
      case 'to_review':
        return 'To Review';
      case 'reviewed':
        return 'Reviewed';
      case 'upcoming':
        return 'Upcoming';
    }
  }

  statusIcon(status: ClientStatus): string {
    switch (status) {
      case 'due_today':
        return 'clock';
      case 'overdue':
        return 'alert-circle';
      case 'to_review':
        return 'eye';
      case 'reviewed':
        return 'check-circle-2';
      case 'upcoming':
        return 'calendar';
    }
  }
}
