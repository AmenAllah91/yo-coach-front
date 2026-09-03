import { Component, ElementRef, HostListener, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule, NgForm } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { UsersService } from '../../../service/users.service';
import { DocumentService } from '../../../service/document.service';
import { CoachBillingService } from '../../../service/coach-billing.service';
import { CoachInvoice, InvoicePaymentGateway } from '../../../models/coach-invoice.model';
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
  isLoadingInvoices: boolean = false;
  invoicesLoaded: boolean = false;

  invoices: CoachInvoice[] = [];
  invoiceError: string = '';
  selectedInvoice: CoachInvoice | null = null;
  paymentGateways: InvoicePaymentGateway[] = [];
  selectedPaymentGateway: string = '';
  isLoadingPaymentGateways: boolean = false;
  isPayingInvoice: boolean = false;
  paymentError: string = '';

  currentUserId: string = '';
  selectedFile: File | null = null;

  tabs = [
    { id: 'overview', labelKey: 'OVERVIEW' },
    { id: 'settings', labelKey: 'SETTINGS' },
    { id: 'invoices', labelKey: 'INVOICES' }
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
    private coachBillingService: CoachBillingService,
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
    if (tabId !== 'invoices') {
      this.closeInvoiceDetails();
    }

    if (tabId === 'invoices' && !this.invoicesLoaded) {
      this.loadInvoices();
    }
  }

  loadInvoices(): void {
    this.isLoadingInvoices = true;
    this.invoiceError = '';

    this.coachBillingService.getInvoices().subscribe({
      next: (invoices) => {
        this.invoices = invoices || [];
        this.invoicesLoaded = true;
        this.isLoadingInvoices = false;
      },
      error: () => {
        this.invoiceError = 'Invoices could not be loaded. Please try again.';
        this.isLoadingInvoices = false;
      }
    });
  }

  openInvoiceDetails(invoice: CoachInvoice): void {
    this.selectedInvoice = invoice;
    this.paymentGateways = [];
    this.selectedPaymentGateway = '';
    this.paymentError = '';

    if (this.isPayableInvoice(invoice)) {
      this.loadInvoicePaymentGateways(invoice.id);
    }
  }

  closeInvoiceDetails(): void {
    if (this.isPayingInvoice) return;

    this.selectedInvoice = null;
    this.paymentGateways = [];
    this.selectedPaymentGateway = '';
    this.paymentError = '';
    this.isLoadingPaymentGateways = false;
  }

  @HostListener('document:keydown.escape')
  closeInvoiceDetailsOnEscape(): void {
    if (this.selectedInvoice) {
      this.closeInvoiceDetails();
    }
  }

  loadInvoicePaymentGateways(invoiceId: number): void {
    this.isLoadingPaymentGateways = true;
    this.paymentError = '';

    this.coachBillingService.getInvoicePaymentGateways(invoiceId).subscribe({
      next: (gateways) => {
        if (this.selectedInvoice?.id !== invoiceId) return;

        this.paymentGateways = gateways || [];
        this.selectedPaymentGateway = this.paymentGateways[0]?.gateway || '';
        this.isLoadingPaymentGateways = false;

        if (this.paymentGateways.length === 0) {
          this.paymentError = 'No payment method is currently available for this invoice.';
        }
      },
      error: (error) => {
        if (this.selectedInvoice?.id !== invoiceId) return;

        this.paymentError = this.getPaymentErrorMessage(
          error,
          'Payment methods could not be loaded. Please try again.'
        );
        this.isLoadingPaymentGateways = false;
      }
    });
  }

  paySelectedInvoice(): void {
    const invoice = this.selectedInvoice;
    if (!invoice || !this.selectedPaymentGateway || !this.isPayableInvoice(invoice)) return;

    this.isPayingInvoice = true;
    this.paymentError = '';

    this.coachBillingService
      .initiateInvoicePayment(invoice.id, this.selectedPaymentGateway)
      .subscribe({
        next: (response) => {
          const redirectUrl = response?.redirectUrl?.trim();
          if (redirectUrl) {
            window.location.assign(redirectUrl);
            return;
          }

          this.paymentError = response?.message || 'The payment page could not be opened.';
          this.isPayingInvoice = false;
        },
        error: (error) => {
          this.paymentError = this.getPaymentErrorMessage(
            error,
            'Payment could not be initiated. Please try again.'
          );
          this.isPayingInvoice = false;
        }
      });
  }

  private getPaymentErrorMessage(error: HttpErrorResponse, fallback: string): string {
    const message = error?.error?.message || error?.error?.detail || error?.error;
    return typeof message === 'string' && message.trim() ? message : fallback;
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

    const payload = {
      firstName: this.editData.firstName || '',
      lastName: this.editData.lastName || '',
      email: this.editData.email || '',
      login: this.editData.login || '',
      phoneNumber: this.editData.phoneNumber || '',
      bio: this.editData.bio || '',
      targetWeight: this.normalizeTargetWeight(this.editData.targetWeight),
      idealShapeDescription: this.editData.idealShapeDescription || ''
    };

    this.usersService.updateUser(this.userData.id, payload).subscribe({
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

  get paidInvoiceCount(): number {
    return this.invoices.filter(invoice => this.isPaid(invoice)).length;
  }

  get outstandingInvoiceCount(): number {
    return this.invoices.filter(invoice => !this.isPaid(invoice)).length;
  }

  get outstandingInvoiceTotal(): number {
    return this.invoices
      .filter(invoice => !this.isPaid(invoice))
      .reduce((total, invoice) => total + (Number(invoice.amount) || 0), 0);
  }

  get outstandingCurrency(): string {
    const currencies = this.invoices
      .filter(invoice => !this.isPaid(invoice) && !!invoice.currency)
      .map(invoice => invoice.currency as string)
      .filter((currency, index, values) => values.indexOf(currency) === index);

    return currencies.length === 1 ? currencies[0] : '';
  }

  isPaid(invoice: CoachInvoice): boolean {
    return invoice.status?.toUpperCase() === 'PAID';
  }

  isPayableInvoice(invoice: CoachInvoice): boolean {
    const status = invoice.status?.toUpperCase();
    return status === 'PENDING' || status === 'UNPAID' || status === 'OVERDUE';
  }

  displayInvoiceValue(value: string | null | undefined): string {
    if (!value) return '—';

    return value
      .toLowerCase()
      .split('_')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  gatewayLabel(gateway: string): string {
    return this.displayInvoiceValue(gateway);
  }

  invoicePaymentButtonLabel(invoice: CoachInvoice): string {
    if (this.isPayingInvoice) return 'Opening secure checkout...';

    const amount = (Number(invoice.amount) || 0).toFixed(2);
    return `Pay ${amount}${invoice.currency ? ` ${invoice.currency}` : ''}`;
  }

  isOverdue(invoice: CoachInvoice): boolean {
    if (this.isPaid(invoice)) return false;
    if (invoice.status?.toUpperCase() === 'OVERDUE') return true;
    if (!invoice.dueDate) return false;

    const dueDate = new Date(`${invoice.dueDate}T23:59:59`);
    return !Number.isNaN(dueDate.getTime()) && dueDate.getTime() < Date.now();
  }

  invoiceStatusLabel(invoice: CoachInvoice): string {
    if (this.isPaid(invoice)) return 'Paid';
    return this.isOverdue(invoice) ? 'Overdue' : 'To pay';
  }

  invoiceStatusClass(invoice: CoachInvoice): string {
    if (this.isPaid(invoice)) return 'paid';
    return this.isOverdue(invoice) ? 'overdue' : 'to-pay';
  }

  trackInvoiceById(_index: number, invoice: CoachInvoice): number {
    return invoice.id;
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
  }
}
