import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { UsersService } from '../../../service/users.service';
import { DocumentService } from '../../../service/document.service';
import { User } from '../../../template/core';

type ProfileUser = Partial<User> & {
  targetWeight?: number | null;
  idealShapeDescription?: string | null;
};

@Component({
  selector: 'app-edit-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './edit-profile.component.html',
  styleUrl: './edit-profile.component.scss',
})
export class EditProfileComponent implements OnInit {
  @ViewChild('fileInput') fileInputRef!: ElementRef<HTMLInputElement>;
  @ViewChild('passwordFormRef') passwordFormRef!: NgForm;

  activeTab: string = 'overview';
  isEditing: boolean = false;
  isLoading: boolean = true;
  isSaving: boolean = false;
  isUploadingPhoto: boolean = false;
  isChangingPassword: boolean = false;

  currentUserId: string = '';
  selectedFile: File | null = null;

  tabs = [
    { id: 'overview', labelKey: 'OVERVIEW' },
    { id: 'settings', labelKey: 'SETTINGS' },
  ];

  userData: ProfileUser = {
    id: '',
    firstName: '',
    lastName: '',
    login: '',
    email: '',
    phoneNumber: '',
    avatarUrl: '',
    bio: '',
    targetWeight: null,
    idealShapeDescription: ''
  };

  editData: ProfileUser = {
    id: '',
    firstName: '',
    lastName: '',
    login: '',
    email: '',
    phoneNumber: '',
    avatarUrl: '',
    bio: '',
    targetWeight: null,
    idealShapeDescription: ''
  };

  passwordFormModel = {
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  };

  passwordError: string = '';
  passwordSuccess: string = '';

  constructor(
    private usersService: UsersService,
    private documentService: DocumentService,
    private translate: TranslateService,
  ) {}

  ngOnInit(): void {
    this.currentUserId = sessionStorage.getItem('userId') || '';

    if (!this.currentUserId) {
      this.isLoading = false;
      return;
    }

    this.loadUserProfile();
  }

  loadUserProfile(): void {
    this.isLoading = true;

    this.usersService.getUserById(this.currentUserId).subscribe({
      next: (user) => {
        this.userData = { ...user };
        this.editData = { ...user };
        this.loadProfilePhoto();
      },
      error: () => {
        this.isLoading = false;
      },
    });
  }

  loadProfilePhoto(): void {
    if (!this.userData.id) {
      this.isLoading = false;
      return;
    }

    this.documentService
      .getPhoto(this.userData.id, 'user-profile-photos')
      .subscribe({
        next: (photoUrl: string) => {
          this.userData.avatarUrl = photoUrl;
          this.editData.avatarUrl = photoUrl;
          this.isLoading = false;
        },
        error: () => {
          this.isLoading = false;
        },
      });
  }

  setActiveTab(tabId: string): void {
    this.activeTab = tabId;
    this.passwordError = '';
    this.passwordSuccess = '';
  }

  handleEditStart(): void {
    this.editData = { ...this.userData };
    this.isEditing = true;
  }

  handleEditCancel(): void {
    this.editData = { ...this.userData };
    this.isEditing = false;
    this.selectedFile = null;
  }

  private normalizeTargetWeight(value: number | string | null | undefined): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const numericValue = Number(value);

    return Number.isNaN(numericValue) ? null : numericValue;
  }

  handleEditSave(): void {
    if (!this.userData.id) return;

    this.isSaving = true;

    const payload: ProfileUser = {
      firstName: this.editData.firstName || '',
      lastName: this.editData.lastName || '',
      email: this.editData.email || '',
      login: this.editData.login || '',
      phoneNumber: this.editData.phoneNumber || '',
      bio: this.editData.bio || '',
      targetWeight: this.normalizeTargetWeight(this.editData.targetWeight),
      idealShapeDescription: this.editData.idealShapeDescription || ''
    };

    this.usersService.updateUser(this.userData.id, payload as any).subscribe({
      next: (updatedUser) => {
        this.userData = { ...this.userData, ...updatedUser };
        this.editData = { ...this.userData };
        this.isEditing = false;
        this.isSaving = false;
      },
      error: () => {
        this.isSaving = false;
      },
    });
  }

  triggerFileInput(): void {
    this.fileInputRef.nativeElement.click();
  }

  handlePhotoChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file || !this.userData.id) return;

    this.selectedFile = file;

    const reader = new FileReader();
    reader.onload = () => {
      const preview = reader.result as string;
      this.userData.avatarUrl = preview;
      this.editData.avatarUrl = preview;
    };
    reader.readAsDataURL(file);

    this.uploadProfilePhoto();
  }

  uploadProfilePhoto(): void {
    if (!this.selectedFile || !this.userData.id) return;

    this.isUploadingPhoto = true;

    this.documentService
      .uploadPhoto(this.selectedFile, this.userData.id, 'user-profile-photos')
      .subscribe({
        next: () => {
          this.documentService
            .getPhoto(this.userData.id!, 'user-profile-photos')
            .subscribe({
              next: (photoUrl: string) => {
                this.userData.avatarUrl = photoUrl;
                this.editData.avatarUrl = photoUrl;
                this.isUploadingPhoto = false;
              },
              error: () => {
                this.isUploadingPhoto = false;
              },
            });
        },
        error: () => {
          this.isUploadingPhoto = false;
        },
      });
  }

  onSubmitNewPassword(): void {
    this.passwordError = '';
    this.passwordSuccess = '';

    if (!this.userData.id) return;

    if (
      !this.passwordFormModel.oldPassword ||
      !this.passwordFormModel.newPassword ||
      !this.passwordFormModel.confirmPassword
    ) {
      this.passwordError = this.translate.instant('ALL_FIELDS_REQUIRED');
      return;
    }

    if (this.passwordFormModel.newPassword !== this.passwordFormModel.confirmPassword) {
      this.passwordError = this.translate.instant('PASSWORD_CONFIRMATION_MISMATCH');
      return;
    }

    this.isChangingPassword = true;

    this.usersService.updateMyPassword(this.passwordFormModel).subscribe({
      next: () => {
        this.passwordSuccess = this.translate.instant('PASSWORD_UPDATED_SUCCESS');
        this.passwordError = '';
        this.isChangingPassword = false;

        this.passwordFormModel = {
          oldPassword: '',
          newPassword: '',
          confirmPassword: '',
        };

        if (this.passwordFormRef) {
          this.passwordFormRef.resetForm();
        }
      },
      error: () => {
        this.passwordSuccess = '';
        this.passwordError = this.translate.instant('PASSWORD_UPDATE_FAILED');
        this.isChangingPassword = false;
      }
    });
  }

  get fullName(): string {
    return `${this.userData.firstName || ''} ${this.userData.lastName || ''}`.trim();
  }

  get profileCompletion(): number {
    const fields = [
      this.userData.firstName,
      this.userData.lastName,
      this.userData.login,
      this.userData.email,
      this.userData.phoneNumber,
      this.userData.avatarUrl,
      this.userData.targetWeight,
      this.userData.idealShapeDescription,
    ];

    const filled = fields.filter(value => !!value).length;
    return Math.round((filled / fields.length) * 100);
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.src = '/assets/images/photoprofilvierge.jpg';
  }
}
