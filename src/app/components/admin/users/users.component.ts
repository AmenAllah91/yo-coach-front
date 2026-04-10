import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

type Role = 'Client' | 'Coach' | 'Admin';
type TabType = 'Tous' | 'Coachs' | 'Clients' | 'Admins';
type Status = 'Actif' | 'Suspendu' | 'En attente' | 'Tous';

interface AppUser {
  id: number;
  name: string;
  email: string;
  role: Role;
  avatar: string;
  coach?: string;
  activite?: string;
  nbClients?: number;
  derniereConnexion?: string;
  status: Exclude<Status, 'Tous'>;
}

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss'
})
export class UsersComponent {
  activeTab: TabType = 'Tous';
  searchQuery = '';
  statusFilter: Status = 'Tous';

  tabs: { id: TabType; label: string }[] = [
    { id: 'Tous', label: 'Tous' },
    { id: 'Coachs', label: 'Coachs' },
    { id: 'Clients', label: 'Clients' },
    { id: 'Admins', label: 'Admins' }
  ];

  users: AppUser[] = [
    {
      id: 1,
      name: 'Thomas Dubois',
      email: 'thomas.d@example.com',
      role: 'Client',
      avatar: 'https://i.pravatar.cc/100?img=12',
      coach: 'Sarah Martin',
      activite: 'Il y a 2h',
      status: 'Actif'
    },
    {
      id: 2,
      name: 'Marie Laurent',
      email: 'marie.l@example.com',
      role: 'Client',
      avatar: 'https://i.pravatar.cc/100?img=32',
      coach: 'Sarah Martin',
      activite: 'Hier',
      status: 'Actif'
    },
    {
      id: 3,
      name: 'Lucas Bernard',
      email: 'lucas.b@example.com',
      role: 'Client',
      avatar: 'https://i.pravatar.cc/100?img=15',
      coach: 'Julien Moreau',
      activite: 'Il y a 15 jours',
      status: 'Suspendu'
    },
    {
      id: 4,
      name: 'Sarah Martin',
      email: 'sarah.m@coach.com',
      role: 'Coach',
      avatar: 'https://i.pravatar.cc/100?img=48',
      nbClients: 8,
      status: 'Actif'
    },
    {
      id: 5,
      name: 'Julien Moreau',
      email: 'julien.m@coach.com',
      role: 'Coach',
      avatar: 'https://i.pravatar.cc/100?img=56',
      nbClients: 5,
      status: 'Actif'
    },
    {
      id: 6,
      name: 'Sophie Petit',
      email: 'sophie.p@coach.com',
      role: 'Coach',
      avatar: 'https://i.pravatar.cc/100?img=21',
      nbClients: 0,
      status: 'En attente'
    },
    {
      id: 7,
      name: 'Admin Principal',
      email: 'admin@fitapp.com',
      role: 'Admin',
      avatar: 'https://i.pravatar.cc/100?img=5',
      derniereConnexion: 'Aujourd’hui à 09:12',
      status: 'Actif'
    },
    {
      id: 8,
      name: 'Nadia Benali',
      email: 'nadia.b@fitapp.com',
      role: 'Admin',
      avatar: 'https://i.pravatar.cc/100?img=25',
      derniereConnexion: 'Hier à 18:40',
      status: 'Actif'
    },
    {
      id: 9,
      name: 'Yassine Karim',
      email: 'yassine.k@example.com',
      role: 'Client',
      avatar: 'https://i.pravatar.cc/100?img=67',
      coach: 'Julien Moreau',
      activite: 'Il y a 1 jour',
      status: 'Actif'
    }
  ];

  get totalUsers(): number {
    return this.users.length;
  }

  get totalCoachs(): number {
    return this.users.filter(u => u.role === 'Coach').length;
  }

  get totalClients(): number {
    return this.users.filter(u => u.role === 'Client').length;
  }

  get totalSuspendus(): number {
    return this.users.filter(u => u.status === 'Suspendu').length;
  }

  get filteredUsers(): AppUser[] {
    return this.users.filter((user) => {
      const matchesTab =
        this.activeTab === 'Tous' ||
        (this.activeTab === 'Coachs' && user.role === 'Coach') ||
        (this.activeTab === 'Clients' && user.role === 'Client') ||
        (this.activeTab === 'Admins' && user.role === 'Admin');

      const q = this.searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        user.name.toLowerCase().includes(q) ||
        user.email.toLowerCase().includes(q);

      const matchesStatus =
        this.statusFilter === 'Tous' || user.status === this.statusFilter;

      return matchesTab && matchesSearch && matchesStatus;
    });
  }

  getStatusClass(status: AppUser['status']): string {
    switch (status) {
      case 'Actif':
        return 'badge badge-success';
      case 'Suspendu':
        return 'badge badge-danger';
      case 'En attente':
        return 'badge badge-warning';
      default:
        return 'badge';
    }
  }

  trackByUser(index: number, user: AppUser): number {
    return user.id;
  }

  onView(user: AppUser): void {
    console.log('Voir', user);
  }

  onEdit(user: AppUser): void {
    console.log('Modifier', user);
  }

  onSuspend(user: AppUser): void {
    console.log('Suspendre', user);
  }

  onBan(user: AppUser): void {
    console.log('Bannir', user);
  }

  onDelete(user: AppUser): void {
    console.log('Supprimer', user);
  }
  getInitials(name: string): string {
    if (!name) return '';

    const parts = name.split(' ');
    return parts
      .map(p => p.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('');
  }
}
