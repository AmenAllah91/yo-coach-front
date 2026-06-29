import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FeatherModule } from 'angular-feather';
import { ClientService, Client, ClientStatus } from '../service/client.service';
import { AuthService } from '../config/auth.service';
import { environment } from '../../environments/environment';
import { WorkoutPlanService } from '../service/workout-plan.service';
import { AddClientModalComponent } from '../components/clients/add-client-modal/add-client-modal.component';
import { DeleteClientModalComponent } from '../components/clients/delete-client-modal/delete-client-modal.component';
import { ScrollLoaderComponent } from '../components/scroll-loader/scroll-loader.component';
import { Router } from '@angular/router';

interface StatusCountResponse {
  active: number;
  paused: number;
  archived: number;
  total: number;
}

@Component({
  selector: 'app-clients',
  templateUrl: './clients.component.html',
  styleUrls: ['./clients.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    FeatherModule,
    AddClientModalComponent,
    DeleteClientModalComponent,
    ScrollLoaderComponent,
  ],
})
export class ClientsComponent implements OnInit {
  clients: Client[] = [];
  filteredClients: Client[] = [];
  searchTerm: string = '';
  statusFilter: ClientStatus | 'ALL' = 'ACTIVE';
  programFilter = 'ALL';
  goalFilter = 'ALL';
  showAddModal = false;
  showDeleteModal = false;
  selectedClient: Client | null = null;
  clientToDelete: Client | null = null;
  isLoading = false;
  openDropdownId: string | null = null;

  showStatusModal = false;
  statusModalClient: Client | null = null;
  pendingStatus: ClientStatus | null = null;
  isStatusUpdating = false;

  activeClientLimit = 25;
  statusCounts: StatusCountResponse = {
    active: 0,
    paused: 0,
    archived: 0,
    total: 0,
  };

  // Pagination
  currentPage = 0;
  pageSize = 10;
  totalPages = 0;
  totalElements = 0;

  firstName = '';
  lastName = '';
  email = '';
  gender = 'MALE';

  constructor(
    private clientService: ClientService,
    private authService: AuthService,
    private workoutPlanService: WorkoutPlanService,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadClients();
  }

  async loadClients() {
    this.isLoading = true;
    const startTime = Date.now();

    try {
      console.log('=== KEYCLOAK USER INFO ===');
      console.log('Is logged in:', this.authService.isLoggedIn());
      console.log('Username:', this.authService.getUsername());
      console.log('User ID:', this.authService.getId());

      const token = await this.authService.getToken();
      console.log('Token:', token);

      const userId = await this.authService.extractUserId();
      console.log('Extracted User ID:', userId);

      const username = await this.authService.extractUserName();
      console.log('Extracted Username:', username);

      const roles = await this.authService.extractRoles();
      console.log('User Roles:', roles);
      console.log('========================');

      const coachId = userId;

      if (!coachId) {
        console.error('No coach ID found');
        const elapsed = Date.now() - startTime;
        const minDelay = 800;
        const remainingDelay = Math.max(0, minDelay - elapsed);
        setTimeout(() => {
          this.isLoading = false;
        }, remainingDelay);
        return;
      }

      this.loadStatusCounts(coachId);

      console.log('Making API call to get clients for coachId:', coachId);
      console.log(
        'API URL will be:',
        `${environment.baseApiUrl}/gym_coaching/clients/coach/${coachId}`
      );

      const statusParam = this.statusFilter === 'ALL' ? undefined : this.statusFilter;

      this.clientService
        .getClientsByCoach(coachId, this.currentPage, this.pageSize, statusParam)
        .subscribe({
          next: (response) => {
            const elapsed = Date.now() - startTime;
            const minDelay = 800;
            const remainingDelay = Math.max(0, minDelay - elapsed);

            setTimeout(() => {
              const clientsData = response.content || response;
              this.clients = clientsData.map((client: Client) => ({
                ...client,
                clientStatus: this.normalizeStatus(client.clientStatus),
                workoutDates: client.workoutDates || this.generateRandomWorkoutDates(),
                program: this.getClientProgram(client) || this.getRandomProgram(),
              }));

              if (response.totalPages !== undefined) {
                this.totalPages = response.totalPages;
                this.totalElements = response.totalElements;
                this.currentPage = response.number;
              } else {
                this.totalPages = 1;
                this.totalElements = this.clients.length;
                this.currentPage = 0;
              }

              this.applyFilters();
              this.isLoading = false;
            }, remainingDelay);
          },
          error: (error) => {
            const elapsed = Date.now() - startTime;
            const minDelay = 800;
            const remainingDelay = Math.max(0, minDelay - elapsed);

            setTimeout(() => {
              console.error('Error loading clients:', error);
              this.isLoading = false;
            }, remainingDelay);
          },
        });
    } catch (error) {
      const elapsed = Date.now() - startTime;
      const minDelay = 800;
      const remainingDelay = Math.max(0, minDelay - elapsed);

      setTimeout(() => {
        console.error('Error getting coach ID:', error);
        this.isLoading = false;
      }, remainingDelay);
    }
  }

  async loadStatusCounts(coachId?: string) {
    const resolvedCoachId = coachId || (await this.authService.extractUserId());

    if (!resolvedCoachId) {
      return;
    }

    this.clientService.getClientStatusCounts(resolvedCoachId).subscribe({
      next: (counts) => {
        this.statusCounts = {
          active: counts.active || 0,
          paused: counts.paused || 0,
          archived: counts.archived || 0,
          total: counts.total || 0,
        };
      },
      error: (error) => console.error('Error loading client status counts:', error),
    });
  }

  onSearch() {
    this.applyFilters();
  }

  applyFilters() {
    const term = this.searchTerm.trim().toLowerCase();

    this.filteredClients = this.clients.filter((client) => {
      const status = this.normalizeStatus(client.clientStatus);
      const matchesStatus = this.statusFilter === 'ALL' || status === this.statusFilter;
      const matchesSearch =
        !term ||
        client.firstName?.toLowerCase().includes(term) ||
        client.lastName?.toLowerCase().includes(term) ||
        client.email?.toLowerCase().includes(term);

      const matchesProgram =
        this.programFilter === 'ALL' || this.getClientProgram(client) === this.programFilter;

      return matchesStatus && matchesSearch && matchesProgram;
    });
  }

  setStatusFilter(status: ClientStatus) {
    this.statusFilter = status;
    this.currentPage = 0;
    this.openDropdownId = null;
    this.loadClients();
  }

  clearFilters() {
    this.searchTerm = '';
    this.programFilter = 'ALL';
    this.goalFilter = 'ALL';
    this.statusFilter = 'ACTIVE';
    this.currentPage = 0;
    this.loadClients();
  }

  previousPage() {
    if (this.currentPage > 0) {
      this.currentPage--;
      this.loadClients();
    }
  }

  nextPage() {
    if (this.currentPage < this.totalPages - 1) {
      this.currentPage++;
      this.loadClients();
    }
  }

  get pagesArray(): number[] {
    return Array.from({ length: this.totalPages }, (_, index) => index);
  }

  goToPage(page: number) {
    if (page < 0 || page >= this.totalPages || page === this.currentPage) {
      return;
    }

    this.currentPage = page;
    this.loadClients();
  }

  goBack() {
    window.history.back();
  }

  openAddModal() {
    this.resetForm();
    this.showAddModal = true;
  }

  closeAddModal() {
    this.showAddModal = false;
    this.resetForm();
  }

  viewProfile(client: Client) {
    console.log('View profile:', client);
    const url = 'clients/profil-client/' + client.id;
    this.router.navigateByUrl(url);
  }

  sendMessage(client: Client) {
    console.log('Send message to:', client);
  }

  editClient(client: Client) {
    console.log('Edit client:', client);
  }

  toggleDropdown(clientId: string | null, event?: Event) {
    if (this.openDropdownId === clientId) {
      this.openDropdownId = null;
      return;
    }

    this.openDropdownId = clientId;

    if (event && clientId) {
      setTimeout(() => {
        const button = event.target as HTMLElement;
        const dropdown = button
          .closest('.dropdown')
          ?.querySelector('.dropdown-menu') as HTMLElement;

        if (dropdown) {
          const buttonRect = button.getBoundingClientRect();
          const dropdownHeight = 200;
          const viewportHeight = window.innerHeight;

          if (buttonRect.bottom + dropdownHeight > viewportHeight) {
            dropdown.style.top = `${buttonRect.top - dropdownHeight}px`;
          } else {
            dropdown.style.top = `${buttonRect.bottom + 4}px`;
          }

          dropdown.style.left = `${buttonRect.right - 190}px`;
        }
      }, 0);
    }
  }

  deleteClient(client: Client) {
    this.clientToDelete = client;
    this.showDeleteModal = true;
    this.openDropdownId = null;
  }

  confirmDelete() {
    if (this.clientToDelete) {
      this.clientService.deleteClient(this.clientToDelete.id!).subscribe({
        next: () => {
          this.loadClients();
          this.closeDeleteModal();
        },
        error: (error) => {
          console.error('Error deleting client:', error);
        },
      });
    }
  }

  closeDeleteModal() {
    this.showDeleteModal = false;
    this.clientToDelete = null;
  }

  openStatusModal(client: Client, status: ClientStatus, event?: Event) {
    event?.stopPropagation();
    this.statusModalClient = client;
    this.pendingStatus = status;
    this.showStatusModal = true;
    this.openDropdownId = null;
  }

  closeStatusModal() {
    if (this.isStatusUpdating) {
      return;
    }
    this.showStatusModal = false;
    this.statusModalClient = null;
    this.pendingStatus = null;
  }

  confirmStatusChange() {
    if (!this.statusModalClient?.id || !this.pendingStatus) {
      return;
    }

    this.isStatusUpdating = true;

    this.clientService.updateClientStatus(this.statusModalClient.id, this.pendingStatus).subscribe({
      next: () => {
        this.isStatusUpdating = false;
        this.closeStatusModal();
        this.loadClients();
      },
      error: (error) => {
        console.error('Error updating client status:', error);
        this.isStatusUpdating = false;
      },
    });
  }

  getStatusModalTitle(): string {
    switch (this.pendingStatus) {
      case 'PAUSED':
        return 'Pause client?';
      case 'ARCHIVED':
        return 'Archive client?';
      case 'ACTIVE':
        return 'Reactivate client?';
      default:
        return 'Update client?';
    }
  }

  getStatusModalDescription(): string {
    switch (this.pendingStatus) {
      case 'PAUSED':
        return 'Paused clients stay in your database, keep their history, and do not count toward billing. Use this for temporary breaks.';
      case 'ARCHIVED':
        return 'Archived clients stay in your database, keep their history, and no longer count toward billing. You can reactivate them later.';
      case 'ACTIVE':
        return 'This client will become active again and will count toward your plan usage.';
      default:
        return '';
    }
  }

  getStatusConfirmLabel(): string {
    switch (this.pendingStatus) {
      case 'PAUSED':
        return 'Pause';
      case 'ARCHIVED':
        return 'Archive';
      case 'ACTIVE':
        return 'Reactivate';
      default:
        return 'Confirm';
    }
  }

  getStatusModalIcon(): string {
    switch (this.pendingStatus) {
      case 'PAUSED':
        return 'pause-circle';
      case 'ARCHIVED':
        return 'archive';
      case 'ACTIVE':
        return 'rotate-ccw';
      default:
        return 'info';
    }
  }

  getStatusModalClass(): string {
    return (this.pendingStatus || 'ACTIVE').toLowerCase();
  }

  getAlternativeText(): string {
    if (this.pendingStatus === 'ARCHIVED') {
      return 'Alternative: use Pause client for temporary breaks.';
    }

    if (this.pendingStatus === 'PAUSED') {
      return 'Use Archive client only when the coaching relationship is finished.';
    }

    return 'Only active clients count toward your plan.';
  }

  getActiveProgressWidth(): number {
    if (!this.activeClientLimit) {
      return 0;
    }

    return Math.min(100, Math.round((this.statusCounts.active / this.activeClientLimit) * 100));
  }

  getRemainingActiveSlots(): number {
    return Math.max(0, this.activeClientLimit - this.statusCounts.active);
  }

  normalizeStatus(status?: string | null): ClientStatus {
    if (status === 'PAUSED' || status === 'ARCHIVED') {
      return status;
    }

    return 'ACTIVE';
  }

  getClientStatus(client: Client): ClientStatus {
    return this.normalizeStatus(client.clientStatus);
  }

  getClientStatusLabel(client: Client): string {
    const status = this.getClientStatus(client);
    return status.charAt(0) + status.slice(1).toLowerCase();
  }

  createWorkoutPlan(client: Client) {
    const targetClients = [
      '69034e9003d1617157ea2826',
      '69034e9003d1617157ea2825',
      '69034b0987c1e9bb68532663',
      '69034b0987c1e9bb68532662',
    ];

    if (!targetClients.includes(client.id!)) {
      console.log('Workout plan not available for this client');
      return;
    }

    const workoutPlan = {
      clientId: client.id!,
      name: `${client.firstName}'s Workout Plan`,
      description: 'Custom workout plan',
      exercises: [
        {
          exerciseId: '1',
          exerciseName: 'Push-ups',
          sets: 3,
          reps: 15,
          restTime: 60,
        },
        {
          exerciseId: '2',
          exerciseName: 'Squats',
          sets: 3,
          reps: 12,
          restTime: 90,
        },
        {
          exerciseId: '3',
          exerciseName: 'Plank',
          sets: 3,
          reps: 1,
          restTime: 60,
          notes: 'Hold for 30 seconds',
        },
      ],
      isActive: true,
    };

    this.workoutPlanService.createWorkoutPlan(workoutPlan).subscribe({
      next: (plan) => {
        console.log('Workout plan created:', plan);
        alert(
          `Workout plan created for ${client.firstName} ${client.lastName}`
        );
      },
      error: (error) => {
        console.error('Error creating workout plan:', error);
        alert('Error creating workout plan');
      },
    });
  }

  resetForm() {
    this.firstName = '';
    this.lastName = '';
    this.email = '';
    this.gender = 'MALE';
  }

  generateRandomWorkoutDates(): string[] {
    const dates = [];
    const today = new Date();

    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() - (6 - i));

      if (Math.random() > 0.4) {
        dates.push(date.toISOString().split('T')[0]);
      }
    }

    return dates;
  }

  hasWorkoutOnDay(client: Client, dayOffset: number): boolean {
    const date = new Date();
    date.setDate(date.getDate() - (6 - dayOffset));
    const dateStr = date.toISOString().split('T')[0];

    return client.workoutDates?.includes(dateStr) || false;
  }

  getDayName(dayOffset: number): string {
    const days = ['Sa', 'Su', 'Mo', 'Tu', 'We', 'Th', 'Fr'];
    return days[dayOffset];
  }

  getDayNumber(dayOffset: number): number {
    const date = new Date();
    date.setDate(date.getDate() - (6 - dayOffset));
    return date.getDate();
  }

  getRandomProgram(): string {
    const programs = ['Push Pull', 'Full Body', 'Upper Lower', 'PPL Split'];
    return programs[Math.floor(Math.random() * programs.length)];
  }

  getClientProgram(client: any): string {
    return client.currentProgramName || client.lastProgramName || client.program || '';
  }

  getProgramOptions(): string[] {
    const programs = this.clients
      .map((client) => this.getClientProgram(client))
      .filter((program) => !!program);

    return Array.from(new Set(programs));
  }

  onCreateClient(client: Client) {
    const newClient = {
      ...client,
      clientStatus: 'ACTIVE' as ClientStatus,
    };

    this.clientService.createClient(newClient).subscribe({
      next: () => {
        this.closeAddModal();
        this.loadClients();
      },
      error: (error) => console.error('Error creating client:', error),
    });
  }
}
