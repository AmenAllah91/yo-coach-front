import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged, Subject } from 'rxjs';
import {UsersService} from "../../../service/users.service";
import {EditUserForm, ModalMode, UserStatus} from "../models/user-models";

type TabType = 'Tous' | 'Coachs' | 'Clients' | 'Admins';
type StatusFilter = 'Tous' | 'Actif' | 'Suspendu';

interface UiUser {
  id: string;
  name: string;
  email: string;
  role: 'Client' | 'Coach' | 'Admin';
  status: UserStatus;
  coach?: string;
  activite?: string;
  nbClients?: number;
  derniereConnexion?: string;
  avatarUrl?: string;
  avatarBg?: string;
  avatarColor?: string;
}

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss'
})
export class UsersComponent implements OnInit {
  activeTab: TabType = 'Tous';
  searchQuery = '';
  statusFilter: StatusFilter = 'Tous';

  tabs = [
    { id: 'Tous' as TabType, label: 'Tous' },
    { id: 'Coachs' as TabType, label: 'Coachs' },
    { id: 'Clients' as TabType, label: 'Clients' },
    { id: 'Admins' as TabType, label: 'Admins' }
  ];

  users: UiUser[] = [];
  loading = false;

  totalUsers = 0;
  totalCoachs = 0;
  totalClients = 0;
  totalAdmins = 0;
  totalSuspendus = 0;

  page = 0;
  size = 10;
  totalElements = 0;

  modalOpen = false;
  modalMode: ModalMode = null;
  modalLoading = false;
  selectedUser: UiUser | null = null;

  editForm: EditUserForm = {
    firstName: '',
    lastName: '',
    email: '',
    activated: true
  };

  private searchSubject = new Subject<string>();

  constructor(private usersService: UsersService) {}

  ngOnInit(): void {
    this.loadStats();
    this.loadUsers();

    this.searchSubject.pipe(
      debounceTime(400),
      distinctUntilChanged()
    ).subscribe(() => {
      this.page = 0;
      this.loadUsers();
    });
  }

  onSearchChange(value: string): void {
    this.searchQuery = value;
    this.searchSubject.next(value);
  }

  onTabChange(tab: TabType): void {
    this.activeTab = tab;
    this.page = 0;
    this.loadUsers();
  }

  onStatusChange(): void {
    this.page = 0;
    this.loadUsers();
  }

  loadStats(): void {
    this.usersService.getAdminStats().subscribe({
      next: stats => {
        this.totalUsers = stats.totalUsers;
        this.totalCoachs = stats.totalCoachs;
        this.totalClients = stats.totalClients;
        this.totalAdmins = stats.totalAdmins;
        this.totalSuspendus = stats.totalSuspendus;
      }
    });
  }

  loadUsers(): void {
    this.loading = true;

    const roleMap: Record<TabType, string | undefined> = {
      Tous: undefined,
      Coachs: 'ROLE_COACH',
      Clients: 'ROLE_CLIENT',
      Admins: 'ROLE_ADMIN'
    };

    const activatedMap: Record<StatusFilter, boolean | ''> = {
      Tous: '',
      Actif: true,
      Suspendu: false
    };

    this.usersService.getAdminUsers({
      role: roleMap[this.activeTab],
      activated: activatedMap[this.statusFilter],
      search: this.searchQuery?.trim() || undefined,
      page: this.page,
      size: this.size
    }).subscribe({
      next: res => {
        this.users = res.content.map(u => this.mapToUiUser(u));
        this.totalElements = res.totalElements;
        this.loading = false;
      },
      error: () => {
        this.users = [];
        this.loading = false;
      }
    });
  }

  mapToUiUser(u: any): UiUser {
    const role = this.extractRole(u.authorities || u.roleNames || []);
    return {
      id: u.id,
      name: `${u.firstName || ''} ${u.lastName || ''}`.trim(),
      email: u.email,
      role,
      status: u.banned ? 'Banni' : (u.activated ? 'Actif' : 'Suspendu'),
      coach: u.coachName,
      activite: u.lastActivityLabel,
      nbClients: u.nbClients,
      derniereConnexion: u.lastLoginLabel,
      avatarUrl: u.avatarUrl
    };
  }

  extractRole(roles: string[]): 'Client' | 'Coach' | 'Admin' {
    if (roles.includes('ROLE_ADMIN')) return 'Admin';
    if (roles.includes('ROLE_COACH')) return 'Coach';
    return 'Client';
  }

  get filteredUsers(): UiUser[] {
    return this.users;
  }

  getStatusClass(status: UiUser['status']): string {
    switch (status) {
      case 'Actif':
        return 'badge badge-success';
      case 'Suspendu':
        return 'badge badge-danger';
      case 'Banni':
        return 'badge badge-danger';
      default:
        return 'badge';
    }
  }

  trackByUser(index: number, user: UiUser): string {
    return user.id;
  }

  onView(user: UiUser): void {
    this.openModal('view', user);
  }

  onEdit(user: UiUser): void {
    this.openModal('edit', user);
  }

  onSuspend(user: UiUser): void {
    this.openModal('suspend', user);
  }

  onBan(user: UiUser): void {
    this.openModal('ban', user);
  }

  onDelete(user: UiUser): void {
    this.openModal('delete', user);
  }

  openModal(mode: ModalMode, user: UiUser): void {
    this.modalMode = mode;
    this.selectedUser = user;
    this.modalOpen = true;

    this.editForm = {
      firstName: this.getFirstName(user.name),
      lastName: this.getLastName(user.name),
      email: user.email,
      activated: user.status === 'Actif'
    };
  }

  closeModal(): void {
    this.modalOpen = false;
    this.modalMode = null;
    this.selectedUser = null;
    this.modalLoading = false;
  }

  submitModalAction(): void {

    if (this.modalMode === 'add') {
      const login = this.editForm.login?.trim() || this.editForm.email?.trim() || '';

      this.usersService.createUser({
        login,
        firstName: this.editForm.firstName,
        lastName: this.editForm.lastName,
        email: this.editForm.email,
        password: this.editForm.password || '',
        activated: this.editForm.activated,
        authorities: [this.editForm.role || 'ROLE_CLIENT']
      }).subscribe({
        next: () => {
          this.afterActionSuccess();
        },
        error: (err) => {
          console.error('Create user failed', err);
          this.modalLoading = false;
        }
      });
      return;
    }


    if (!this.selectedUser || !this.modalMode) return;

    this.modalLoading = true;

    if (this.modalMode === 'edit') {
      this.usersService.updateUser(this.selectedUser.id, {
        firstName: this.editForm.firstName,
        lastName: this.editForm.lastName,
        email: this.editForm.email,
        activated: this.editForm.activated
      }).subscribe({
        next: () => {
          this.afterActionSuccess();
        },
        error: () => {
          this.modalLoading = false;
        }
      });
      return;
    }

    if (this.modalMode === 'suspend') {
      this.usersService.updateUserStatus(this.selectedUser.id, false).subscribe({
        next: () => {
          this.afterActionSuccess();
        },
        error: () => {
          this.modalLoading = false;
        }
      });
      return;
    }

    if (this.modalMode === 'ban') {
      this.usersService.banUser(this.selectedUser.id).subscribe({
        next: () => {
          this.afterActionSuccess();
        },
        error: () => {
          this.modalLoading = false;
        }
      });
      return;
    }

    if (this.modalMode === 'delete') {
      this.usersService.deleteUser(this.selectedUser.id).subscribe({
        next: () => {
          this.afterActionSuccess();
        },
        error: () => {
          this.modalLoading = false;
        }
      });
      return;
    }

    this.modalLoading = false;
  }

  afterActionSuccess(): void {
    this.closeModal();
    this.loadUsers();
    this.loadStats();
  }

  getModalTitle(): string {
    switch (this.modalMode) {
      case 'view': return 'Détails utilisateur';
      case 'add': return 'Ajouter un utilisateur';
      case 'edit': return 'Modifier utilisateur';
      case 'suspend': return 'Suspendre utilisateur';
      case 'ban': return 'Bannir utilisateur';
      case 'delete': return 'Supprimer utilisateur';
      default: return '';
    }
  }

  getModalDescription(): string {
    if (!this.selectedUser) return '';

    switch (this.modalMode) {
      case 'view':
        return 'Consultez les informations principales de cet utilisateur.';
      case 'add':
        return 'Créez un nouvel utilisateur et définissez son rôle.';
      case 'edit':
        return 'Modifiez les informations de cet utilisateur.';
      case 'suspend':
        return `Voulez-vous vraiment suspendre ${this.selectedUser.name} ?`;
      case 'ban':
        return `Voulez-vous vraiment bannir ${this.selectedUser.name} ?`;
      case 'delete':
        return `Cette action supprimera définitivement ${this.selectedUser.name}.`;
      default:
        return '';
    }
  }

  getConfirmButtonLabel(): string {
    switch (this.modalMode) {
      case 'add': return 'Créer';
      case 'edit': return 'Enregistrer';
      case 'suspend': return 'Suspendre';
      case 'ban': return 'Bannir';
      case 'delete': return 'Supprimer';
      default: return 'Confirmer';
    }
  }

  isDangerAction(): boolean {
    return this.modalMode === 'delete' || this.modalMode === 'ban' || this.modalMode === 'suspend';
  }

  getInitials(name: string): string {
    if (!name) return '';
    return name.split(' ')
      .map(p => p.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('');
  }

  private getFirstName(fullName: string): string {
    return fullName?.split(' ')?.[0] || '';
  }

  private getLastName(fullName: string): string {
    const parts = fullName?.split(' ') || [];
    return parts.length > 1 ? parts.slice(1).join(' ') : '';
  }

  onAddUser(): void {
    this.modalMode = 'add';
    this.selectedUser = null;
    this.modalOpen = true;

    this.editForm = {
      firstName: '',
      lastName: '',
      email: '',
      activated: true,
      login: '',
      password: '',
      role: 'ROLE_CLIENT'
    };
  }
}
