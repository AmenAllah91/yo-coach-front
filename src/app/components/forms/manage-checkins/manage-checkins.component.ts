import { Component } from '@angular/core';
import {CommonModule} from "@angular/common";
import {FormsModule} from "@angular/forms";
type ClientStatus = 'due_today' | 'overdue' | 'to_review' | 'reviewed' | 'upcoming';

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

// Mock questions
const MOCK_QUESTIONS: Question[] = [
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

const MOCK_ANSWERS: Answer[] = [
  {
    questionId: 'q1',
    type: QuestionType.TEXT,
    text: 'I managed to complete all 5 of my scheduled workouts, which is a first for me!'
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

const MOCK_CLIENTS: ClientData[] = [
  {
    id: '1',
    name: 'Christophe Batiste',
    formType: 'Essential check-in',
    date: 'Jan 18, 2025',
    status: 'due_today',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
    formName: 'Essential check-in',
    questions: MOCK_QUESTIONS
  },
  {
    id: '2',
    name: 'Maria Garden',
    formType: 'One 30 day ago',
    date: 'Jan 18, 2025',
    status: 'due_today',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
    formName: 'One 30 day ago',
    questions: MOCK_QUESTIONS
  },
  {
    id: '3',
    name: 'Marius Culchette',
    formType: 'Essential check-in',
    date: 'Jan 18, 2025',
    status: 'due_today',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
    formName: 'Essential check-in',
    questions: MOCK_QUESTIONS
  },
  {
    id: '4',
    name: 'Sophie Laurent',
    formType: 'Weekly progress',
    date: 'Jan 10, 2025',
    status: 'overdue',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
    formName: 'Weekly progress',
    questions: MOCK_QUESTIONS
  },
  {
    id: '5',
    name: 'Thomas Mercier',
    formType: 'Monthly review',
    date: 'Jan 5, 2025',
    status: 'overdue',
    formName: 'Monthly review',
    questions: MOCK_QUESTIONS
  },
  {
    id: '6',
    name: 'Emma Dubois',
    formType: 'Essential check-in',
    date: 'Dec 28, 2024',
    status: 'overdue',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
    formName: 'Essential check-in',
    questions: MOCK_QUESTIONS
  },
  {
    id: '7',
    name: 'Lucas Martin',
    formType: 'Essential check-in',
    date: 'Jan 17, 2025',
    status: 'to_review',
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
    formName: 'Essential check-in',
    questions: MOCK_QUESTIONS,
    answers: MOCK_ANSWERS,
    submittedDate: 'Jan 17, 2025'
  },
  {
    id: '8',
    name: 'Camille Roux',
    formType: 'Weekly progress',
    date: 'Jan 16, 2025',
    status: 'to_review',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
    formName: 'Weekly progress',
    questions: MOCK_QUESTIONS,
    answers: MOCK_ANSWERS,
    submittedDate: 'Jan 16, 2025'
  },
  {
    id: '9',
    name: 'Alexandre Petit',
    formType: 'Monthly review',
    date: 'Jan 25, 2025',
    status: 'upcoming',
    formName: 'Monthly review',
    questions: MOCK_QUESTIONS
  },
  {
    id: '10',
    name: 'Julie Moreau',
    formType: 'Essential check-in',
    date: 'Jan 26, 2025',
    status: 'upcoming',
    avatar: 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
    formName: 'Essential check-in',
    questions: MOCK_QUESTIONS
  },
];

const ITEMS_PER_PAGE = 5;

@Component({
  selector: 'app-manage-checkins',
  standalone: true,
  imports: [CommonModule,FormsModule],
  templateUrl: './manage-checkins.component.html',
  styleUrl: './manage-checkins.component.scss'
})
export class ManageCheckinsComponent {
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

  clients: ClientData[] = MOCK_CLIENTS;

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

  // Modal actions
  openCheckInModal(client: ClientData) {
    this.selectedClient = client;
    this.isModalOpen = true;

    // Déterminer le mode du modal
    if (client.status === 'to_review' || client.status === 'reviewed') {
      // Client a déjà répondu -> mode visualisation des réponses
      this.modalMode = 'view';
      this.coachFeedback = client.coachFeedback || '';
    } else {
      // Client n'a pas encore répondu -> mode prévisualisation des questions
      this.modalMode = 'preview';
    }
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
