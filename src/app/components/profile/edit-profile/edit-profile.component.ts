import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NgIf } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import {UsersService} from "../../../service/users.service";
import {DocumentService} from "../../../service/document.service";
import {User} from "../../../template/core";
import {
  NgbNav,
  NgbNavContent,
  NgbNavItem, NgbNavLink, NgbNavLinkBase,
  NgbNavOutlet
} from "@ng-bootstrap/ng-bootstrap";
@Component({
  selector: 'app-edit-profile',
  standalone: true,
  imports: [
    NgIf,
    FormsModule,
    NgbNavOutlet,
    NgbNavItem,
    NgbNav,
    NgbNavLink,
    NgbNavLinkBase,
    NgbNavContent
  ],
  templateUrl: './edit-profile.component.html',
  styleUrl: './edit-profile.component.scss'
})
export class EditProfileComponent implements OnInit {

  profileForm: Partial<User> = {
    id: '',
    firstName: '',
    lastName: '',
    login: '',
    email: '',
    authorities: [],
    avatarUrl: '',
    birthDate: null,
    phoneNumber: '',
    identificationNumber: '',
  };
  @ViewChild('userForm') userForm!: NgForm;
  @ViewChild('passwordForm', { static: false }) passwordForm!: NgForm;


  id!: string;

  active = 1;

  file: File | null = null;

  isLoading = true;
  isSaving = false;

  showOldPassword: boolean = false;
  showNewPassword: boolean = false;

  passwordFormModel: any = {
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  };

  isPasswordFormValid: boolean = true;
  isCurrentUser: boolean = false;
  currentUserId!: string;


  constructor(
    private userService: UsersService,
    private documentService: DocumentService,
    private router: Router,
    private route: ActivatedRoute,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.currentUserId = sessionStorage.getItem('userId') || '';

    this.route.paramMap.subscribe(params => {
      const newId = params.get('id');
      if (newId && newId !== this.id) {
        this.id = newId;
        this.isCurrentUser = this.id === this.currentUserId;
        this.resetForm();
        this.loadProfile();
      }
    });
  }

  resetForm() {
    this.profileForm = {
      id: '',
      firstName: '',
      lastName: '',
      login: '',
      email: '',
      authorities: [],
      avatarUrl: '',
      birthDate: null,
      phoneNumber: '',
      identificationNumber: '',
    };
    this.file = null;
    this.isLoading = true;
  }

  loadProfile() {

    this.userService.getUserById(this.id).subscribe({
      next: (user) => {
        this.profileForm = user;
        this.isLoading = false;
      },
      error: () => {
        this.toastr.error("Failed to load profile");
        this.isLoading = false;
      }
    });

  }

  onImageUpload(event: any) {

    this.file = event.target.files[0];

    if (!this.file) return;

    const reader = new FileReader();

    reader.onload = (e: any) => {
      this.profileForm.avatarUrl = e.target.result;
    };

    reader.readAsDataURL(this.file);


    if (this.file) {
      this.uploadPhoto();
    }

  }

  uploadPhoto() {

    if (!this.file) return;

    this.documentService
      .uploadPhoto(this.file, this.profileForm.id, "user-profile-photos")
      .subscribe({
        next: (url: string) => {
        },
        error: () => {
          this.toastr.error("Photo upload failed");
        }
      });

  }

  onSubmit() {

    if (!this.userForm.valid) return;

    this.isSaving = true;

    this.userService.updateUser(this.profileForm).subscribe({
      next: () => {

        this.isSaving = false;

        this.toastr.success("Profile updated successfully");

      },
      error: () => {

        this.isSaving = false;
        this.toastr.error("Update failed");

      }
    });

  }

  cancel() {
    this.router.navigate(['/']);
  }

  onImageError(event: Event) {
    const img = event.target as HTMLImageElement;
    img.src = '/assets/images/photoprofilvierge.jpg';
  }


  onSubmitNewPassword(){
    if (this.passwordForm.valid) {
      if (
        this.passwordFormModel?.newPassword !==
        this.passwordFormModel?.confirmPassword
      ){
        this.isPasswordFormValid = false;
      } else {
        this.userService.updatePassword(this.passwordFormModel,this.id).subscribe(
          () => {
            this.passwordFormModel = {
              oldPassword: '',
              newPassword: '',
              confirmPassword: '',
            }
            this.active = 1;
          }
        );
      }

    }
  }

}
