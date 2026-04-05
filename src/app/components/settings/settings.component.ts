import { Component, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface UserData {
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  bio: string;
  profilePhoto: string;
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent {
  @ViewChild('fileInput') fileInputRef!: ElementRef<HTMLInputElement>;

  activeTab: string = 'overview';
  isEditing: boolean = false;

  tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'settings', label: 'Settings' },
    { id: 'billing', label: 'Billing' },
  ];

  userData: UserData = {
    username: 'khalil_coach',
    firstName: 'Khalil',
    lastName: 'Kraiem',
    email: 'khalil.kraiem00@gmail.com',
    phone: '+216 55 123 456',
    bio: 'Certified personal trainer & nutrition coach. Helping clients achieve their fitness goals since 2020.',
    profilePhoto:
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=300&fit=crop&crop=face',
  };

  editData: UserData = { ...this.userData };

  setActiveTab(tabId: string): void {
    this.activeTab = tabId;
  }

  handleEditStart(): void {
    this.editData = { ...this.userData };
    this.isEditing = true;
  }

  handleEditCancel(): void {
    this.editData = { ...this.userData };
    this.isEditing = false;
  }

  handleEditSave(): void {
    this.userData = { ...this.editData };
    this.isEditing = false;
  }

  triggerFileInput(): void {
    this.fileInputRef.nativeElement.click();
  }

  handlePhotoChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        this.userData.profilePhoto = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  }
}
