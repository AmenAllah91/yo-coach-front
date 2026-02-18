import { Component } from '@angular/core';
import {Router} from "@angular/router";
import {FormsModule} from "@angular/forms";
import {CommonModule} from "@angular/common";

interface Client {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  package: string;
  progress: number;
  status: 'active' | 'inactive';
  lastCheckIn?: string;
}

interface CheckIn {
  id: string;
  clientId: string;
  clientName: string;
  clientAvatar?: string;
  date: string; // ISO string
  weight: number;
  bodyFat?: number;
  notes?: string;
  photos?: number;
}
@Component({
  selector: 'app-coach-dashboard',
  standalone: true,
  imports: [FormsModule,CommonModule],
  templateUrl: './coach-dashboard.component.html',
  styleUrl: './coach-dashboard.component.scss'
})
export class CoachDashboardComponent {
  showAddClientModal = false;
  searchTerm = '';

  // Mock data (comme dans React)
  clients: Client[] = [
    {
      id: '1',
      name: 'David Crawford',
      email: 'david@example.com',
      package: 'Online Coaching',
      progress: 75,
      status: 'active',
      lastCheckIn: '2 days ago',
    },
    {
      id: '2',
      name: 'Sarah Johnson',
      email: 'sarah@example.com',
      package: 'Premium Plan',
      progress: 60,
      status: 'active',
      lastCheckIn: '1 day ago',
    },
    {
      id: '3',
      name: 'Mike Thompson',
      email: 'mike@example.com',
      package: 'Basic Plan',
      progress: 45,
      status: 'active',
      lastCheckIn: '5 days ago',
    },
    {
      id: '4',
      name: 'Emma Wilson',
      email: 'emma@example.com',
      package: 'Online Coaching',
      progress: 90,
      status: 'active',
      lastCheckIn: '1 day ago',
    },
    {
      id: '5',
      name: 'James Brown',
      email: 'james@example.com',
      package: 'Premium Plan',
      progress: 30,
      status: 'inactive',
      lastCheckIn: '10 days ago',
    },
  ];

  recentCheckIns: CheckIn[] = [
    {
      id: '1',
      clientId: '2',
      clientName: 'Sarah Johnson',
      date: '2024-01-15',
      weight: 68.5,
      bodyFat: 22.3,
      notes: 'Feeling great! Energy levels are up.',
      photos: 3,
    },
    {
      id: '2',
      clientId: '4',
      clientName: 'Emma Wilson',
      date: '2024-01-15',
      weight: 62.0,
      bodyFat: 19.8,
      notes: 'Hit a new PR on squats!',
      photos: 2,
    },
    {
      id: '3',
      clientId: '1',
      clientName: 'David Crawford',
      date: '2024-01-13',
      weight: 82.3,
      bodyFat: 18.5,
      notes: 'Down 2kg this week. Feeling strong.',
      photos: 4,
    },
    {
      id: '4',
      clientId: '3',
      clientName: 'Mike Thompson',
      date: '2024-01-10',
      weight: 90.5,
      bodyFat: 25.1,
      notes: 'Struggled with diet this week.',
      photos: 1,
    },
  ];

  constructor(private router: Router) {}

  get filteredClients(): Client[] {
    const q = this.searchTerm.trim().toLowerCase();
    if (!q) return this.clients;
    return this.clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q),
    );
  }

  getInitials(name: string): string {
    return name
      .split(' ')
      .filter(Boolean)
      .map((n) => n[0])
      .join('')
      .toUpperCase();
  }

  getProgressClass(progress: number): string {
    if (progress >= 70) return 'progress green';
    if (progress >= 40) return 'progress blue';
    return 'progress orange';
  }

  formatCheckInDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  // Actions
  addClient(): void {
    this.showAddClientModal = true;
  }

  addWorkoutPlan(): void {
    this.router.navigate(['/workout-programs']);
  }

  addNutritionPlan(): void {
    this.router.navigate(['/nutrition-plan']);
  }

  sendMessage(): void {
    this.router.navigate(['/chat']);
  }

  addCheckIn(): void {
    this.router.navigate(['/check-ins']);
  }

  openClient(id: string): void {
    this.router.navigate([`/client/${id}`]);
  }

  closeModal(): void {
    this.showAddClientModal = false;
  }
  trackByClientId(index: number, client: Client): string {
    return client.id;
  }
  trackByCheckInId(index: number, checkIn: CheckIn): string {
    return checkIn.id;
  }
}
