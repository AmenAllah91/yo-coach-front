import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FeatherModule } from 'angular-feather';
import { ClientService, Client } from '../service/client.service';
import { AuthService } from '../config/auth.service';
import { environment } from '../../environments/environment';
import { WorkoutPlanService, WorkoutPlan } from '../service/workout-plan.service';


@Component({
  selector: 'app-clients',
  templateUrl: './clients.component.html',
  styleUrls: ['./clients.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    FeatherModule
  ]
})
export class ClientsComponent implements OnInit {
  clients: Client[] = [];
  filteredClients: Client[] = [];
  searchTerm: string = '';
  showAddModal = false;
  showDeleteModal = false;
  selectedClient: Client | null = null;
  clientToDelete: Client | null = null;
  isLoading = false;
  openDropdownId: string | null = null;

  
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
    private workoutPlanService: WorkoutPlanService
  ) {}

  ngOnInit() {
    this.loadClients();
  }

  async loadClients() {
    this.isLoading = true;
    
    try {
      // Console log all user info from Keycloak
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
        this.isLoading = false;
        return;
      }
      
      console.log('Making API call to get clients for coachId:', coachId);
      console.log('API URL will be:', `${environment.baseApiUrl}/gym_coaching/clients/coach/${coachId}`);
      
      this.clientService.getClientsByCoach(coachId, this.currentPage, this.pageSize).subscribe({
        next: (response) => {
          // Handle both paginated and non-paginated responses
          const clientsData = response.content || response;
          this.clients = clientsData.map(client => ({
            ...client,
            workoutDates: this.generateRandomWorkoutDates(),
            program: this.getRandomProgram()
          }));
          this.filteredClients = this.clients;
          
          if (response.totalPages) {
            this.totalPages = response.totalPages;
            this.totalElements = response.totalElements;
            this.currentPage = response.number;
          } else {
            this.totalPages = 1;
            this.totalElements = this.clients.length;
            this.currentPage = 0;
          }
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Error loading clients:', error);
          this.isLoading = false;
        }
      });
    } catch (error) {
      console.error('Error getting coach ID:', error);
      this.isLoading = false;
    }
  }

  onSearch() {
    if (!this.searchTerm) {
      this.filteredClients = this.clients;
      return;
    }
    
    this.filteredClients = this.clients.filter(client =>
      client.firstName.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
      client.lastName.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
      client.email.toLowerCase().includes(this.searchTerm.toLowerCase())
    );
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

  async createClient() {
    try {
      const coachId = await this.authService.extractUserId();
      
      if (!coachId) {
        console.error('No coach ID found');
        return;
      }
      
      const client: Client = {
        firstName: this.firstName,
        lastName: this.lastName,
        email: this.email,
        gender: this.gender,
        login: this.email,
        activated: true,
        coachId: coachId,
        workoutDates: [],
        coachingSpecialities: [],
        authorities: []
      };

      this.clientService.createClient(client).subscribe({
        next: () => {
          this.loadClients();
          this.closeAddModal();
        },
        error: (error) => {
          console.error('Error creating client:', error);
        }
      });
    } catch (error) {
      console.error('Error getting coach ID:', error);
    }
  }



  viewProfile(client: Client) {
    console.log('View profile:', client);
  }

  sendMessage(client: Client) {
    console.log('Send message to:', client);
  }

  editClient(client: Client) {
    console.log('Edit client:', client);
  }

  toggleDropdown(clientId: string | null) {
    this.openDropdownId = this.openDropdownId === clientId ? null : clientId;
  }

  deleteClient(client: Client) {
    this.clientToDelete = client;
    this.showDeleteModal = true;
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
        }
      });
    }
  }

  closeDeleteModal() {
    this.showDeleteModal = false;
    this.clientToDelete = null;
  }

  createWorkoutPlan(client: Client) {
    const targetClients = ['69034e9003d1617157ea2826', '69034e9003d1617157ea2825', '69034b0987c1e9bb68532663', '69034b0987c1e9bb68532662'];
    
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
          restTime: 60
        },
        {
          exerciseId: '2', 
          exerciseName: 'Squats',
          sets: 3,
          reps: 12,
          restTime: 90
        },
        {
          exerciseId: '3',
          exerciseName: 'Plank',
          sets: 3,
          reps: 1,
          restTime: 60,
          notes: 'Hold for 30 seconds'
        }
      ],
      isActive: true
    };

    this.workoutPlanService.createWorkoutPlan(workoutPlan).subscribe({
      next: (plan) => {
        console.log('Workout plan created:', plan);
        alert(`Workout plan created for ${client.firstName} ${client.lastName}`);
      },
      error: (error) => {
        console.error('Error creating workout plan:', error);
        alert('Error creating workout plan');
      }
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

  getClientStatus(client: Client): string {
    const recentWorkouts = client.workoutDates?.filter(date => {
      const workoutDate = new Date(date);
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      return workoutDate >= threeDaysAgo;
    });
    
    return recentWorkouts && recentWorkouts.length > 0 ? 'Active' : 'Inactive';
  }

  getRandomProgram(): string {
    const programs = ['Push Pull', 'Full Body', 'Upper Lower', 'PPL Split'];
    return programs[Math.floor(Math.random() * programs.length)];
  }

  getClientProgram(client: any): string {
    return client.program || '';
  }
}