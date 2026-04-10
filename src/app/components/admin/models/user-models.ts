export interface UserDto {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  activated: boolean;
  avatarUrl?: string;
  coachName?: string;
  nbClients?: number;
  roleNames?: string[];
  lastActivityLabel?: string;
  lastLoginLabel?: string;
}

export interface UserStatsDto {
  totalUsers: number;
  totalCoachs: number;
  totalClients: number;
  totalAdmins: number;
  totalSuspendus: number;
}

export interface PageDto<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

export type UserStatus = 'Actif' | 'Suspendu' | 'Banni';

export type ModalMode = 'view' | 'edit' | 'add' | 'suspend' | 'ban' | 'delete' | null;

export interface EditUserForm {
  firstName: string;
  lastName: string;
  email: string;
  activated: boolean;
  login?: string;
  password?: string;
  role?: 'ROLE_CLIENT' | 'ROLE_COACH' | 'ROLE_ADMIN';
}
