import {Component, Input, Output, EventEmitter, OnChanges, SimpleChanges} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { FeatherModule } from 'angular-feather';
import { HttpErrorResponse } from '@angular/common/http';
import {InvitationService} from "../../../service/invitation.service";
import {AuthService} from "@config/auth.service";
import {environment} from "@env/environment";
import { ToastService } from '../../../service/toast.service';

@Component({
  selector: 'app-add-client-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, FeatherModule, TranslateModule],
  templateUrl: './add-client-modal.component.html',
  styleUrls: ['./add-client-modal.component.scss'],
})
export class AddClientModalComponent implements OnChanges {
  @Input() isVisible = false;
  @Output() onClose  = new EventEmitter<void>();
  @Output() onCreate = new EventEmitter<{ email: string }>();
  currentCoachId = '';
  email = '';
  copied = false;
  inviteLink = environment.apiUrl + '/invitation/';
  invitationToken?: string;
  invitationUsed = false;
  emailTouched = false;
  isGenerating = false;
  isSending = false;
  pendingInvitation = false;
  serverErrorKey = '';

  private readonly emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  private readonly inviteBaseUrl = environment.apiUrl + '/invitation/';

  constructor(
    private invitationService: InvitationService,
    private authService: AuthService,
    private translate: TranslateService,
    private toastService: ToastService,
  ) {
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isVisible']?.currentValue && !this.invitationToken && !this.isGenerating) {
      void this.initializeInvitation();
    }
  }

  get emailError(): string {
    if (this.serverErrorKey) {
      return this.translate.instant(this.serverErrorKey);
    }
    if (!this.emailTouched) {
      return '';
    }
    if (!this.email.trim()) {
      return this.translate.instant('EMAIL_ADDRESS_REQUIRED');
    }
    if (!this.isEmailValid) {
      return this.translate.instant('ENTER_VALID_EMAIL_ADDRESS');
    }
    return '';
  }

  get isEmailValid(): boolean {
    return this.emailPattern.test(this.email.trim());
  }

  get canSubmit(): boolean {
    return this.isEmailValid && !!this.invitationToken && !this.isGenerating && !this.isSending;
  }

  private async initializeInvitation(): Promise<void> {
    this.isGenerating = true;
    this.serverErrorKey = '';
    this.currentCoachId = (await this.authService.getId()) || '';
    if (!this.currentCoachId) {
      this.isGenerating = false;
      this.serverErrorKey = 'UNABLE_TO_SEND_INVITATION';
      return;
    }

    this.invitationService.generateInvitation({
      email: this.email,
      idCoach: this.currentCoachId
    }).subscribe({
      next: (inv) => {
        this.invitationToken = inv.invitationLink;
        this.inviteLink = this.inviteBaseUrl + this.invitationToken;
        this.isGenerating = false;
      },
      error: () => {
        this.isGenerating = false;
        this.serverErrorKey = 'UNABLE_TO_SEND_INVITATION';
      },
    });
  }

  closeModal(): void {
    if (this.isSending) return;

    const unusedToken = !this.invitationUsed ? this.invitationToken : undefined;
    if (unusedToken) {
      this.invitationService
        .deleteInvitationByToken(unusedToken)
        .subscribe({
          error: () => {}
        });
    }

    this.email = '';
    this.copied = false;
    this.invitationUsed = false;
    this.invitationToken = undefined;
    this.inviteLink = this.inviteBaseUrl;
    this.emailTouched = false;
    this.isGenerating = false;
    this.pendingInvitation = false;
    this.serverErrorKey = '';
    this.onClose.emit();
  }

  copyLink(): void {
    if (!this.invitationToken) return;
    navigator.clipboard.writeText(this.inviteLink).catch(() => {});
    this.copied = true;
    this.invitationUsed = true;
    setTimeout(() => (this.copied = false), 2000);
  }

  onEmailChange(value: string): void {
    this.email = value;
    this.serverErrorKey = '';
    this.pendingInvitation = false;
  }

  onEmailBlur(): void {
    this.email = this.email.trim();
    this.emailTouched = true;
  }

  sendInvitation(): void {
    this.email = this.email.trim();
    this.emailTouched = true;
    this.serverErrorKey = '';

    if (!this.canSubmit || !this.invitationToken) return;

    const normalizedEmail = this.email;
    const resend = this.pendingInvitation;
    this.isSending = true;

    this.invitationService.sendInvitation(
      this.invitationToken,
      this.currentCoachId,
      normalizedEmail,
      resend,
    ).subscribe({
      next: () => {
        this.isSending = false;
        this.invitationUsed = true;
        this.toastService.success(this.translate.instant('INVITATION_SENT_SUCCESSFULLY'));
        this.onCreate.emit({ email: normalizedEmail });
        this.closeModal();
      },
      error: (error: HttpErrorResponse) => {
        this.isSending = false;
        const code = error.error?.code;
        if (code === 'EMAIL_REQUIRED') {
          this.serverErrorKey = 'EMAIL_ADDRESS_REQUIRED';
        } else if (code === 'INVALID_EMAIL') {
          this.serverErrorKey = 'ENTER_VALID_EMAIL_ADDRESS';
        } else if (code === 'CLIENT_ALREADY_ACTIVE') {
          this.serverErrorKey = 'CLIENT_ALREADY_IN_LIST';
        } else if (code === 'INVITATION_ALREADY_PENDING') {
          this.serverErrorKey = 'INVITATION_ALREADY_SENT';
          this.pendingInvitation = true;
        } else {
          this.serverErrorKey = 'UNABLE_TO_SEND_INVITATION';
          this.toastService.error(this.translate.instant('UNABLE_TO_SEND_INVITATION'));
        }
      },
    });
  }
}
