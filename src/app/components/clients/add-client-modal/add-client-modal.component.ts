import {Component, Input, Output, EventEmitter} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { FeatherModule } from 'angular-feather';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
import {InvitationService} from "../../../service/invitation.service";
import {AuthService} from "@config/auth.service";
import {environment} from "@env/environment";
import { ToastService } from '../../../service/toast.service';

/**
 * The coach types the client's email first: the link is created for that email only, then sent by email or copied
 * (WhatsApp, Messenger...). Pending invitations are listed in the "Invited" tab.
 */
@Component({
  selector: 'app-add-client-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, FeatherModule, TranslateModule],
  templateUrl: './add-client-modal.component.html',
  styleUrls: ['./add-client-modal.component.scss'],
})
export class AddClientModalComponent {
  @Input() isVisible = false;
  @Output() onClose  = new EventEmitter<void>();
  @Output() onCreate = new EventEmitter<{ email: string }>();
  email = '';
  copied = false;
  inviteLink = '';
  /** Token created for {@link tokenEmail}; another email gets its own link. */
  invitationToken?: string;
  private tokenEmail = '';
  invitationUsed = false;
  emailTouched = false;
  isGenerating = false;
  isSending = false;
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
    return this.isEmailValid && !this.isGenerating && !this.isSending;
  }

  /** The link of the typed email, created on first use (send or copy). */
  private async linkForEmail(): Promise<string | null> {
    const email = this.email.trim();
    if (this.invitationToken && this.tokenEmail.toLowerCase() === email.toLowerCase()) return this.invitationToken;
    this.discardUnusedToken();
    const coachId = (await this.authService.getId()) || '';
    if (!coachId) {
      this.serverErrorKey = 'UNABLE_TO_SEND_INVITATION';
      return null;
    }
    this.isGenerating = true;
    try {
      const invitation = await firstValueFrom(this.invitationService.generateInvitation({ email, idCoach: coachId }));
      this.invitationToken = invitation.invitationLink;
      this.tokenEmail = email;
      this.invitationUsed = false;
      this.inviteLink = this.inviteBaseUrl + this.invitationToken;
      return this.invitationToken!;
    } catch (error) {
      this.showError(error as HttpErrorResponse);
      return null;
    } finally {
      this.isGenerating = false;
    }
  }

  private discardUnusedToken(): void {
    if (this.invitationToken && !this.invitationUsed) {
      this.invitationService.deleteInvitationByToken(this.invitationToken).subscribe({ error: () => {} });
    }
    this.invitationToken = undefined;
    this.tokenEmail = '';
    this.inviteLink = '';
  }

  closeModal(): void {
    if (this.isSending) return;
    this.discardUnusedToken();
    this.email = '';
    this.copied = false;
    this.invitationUsed = false;
    this.emailTouched = false;
    this.isGenerating = false;
    this.serverErrorKey = '';
    this.onClose.emit();
  }

  async copyLink(): Promise<void> {
    if (!this.validate()) return;
    const token = await this.linkForEmail();
    if (!token) return;
    navigator.clipboard.writeText(this.inviteLink).catch(() => {});
    this.copied = true;
    this.invitationUsed = true;
    this.onCreate.emit({ email: this.tokenEmail });
    setTimeout(() => (this.copied = false), 2000);
  }

  onEmailChange(value: string): void {
    this.email = value;
    this.serverErrorKey = '';
    this.copied = false;
  }

  onEmailBlur(): void {
    this.email = this.email.trim();
    this.emailTouched = true;
  }

  async sendInvitation(): Promise<void> {
    if (!this.validate()) return;
    const token = await this.linkForEmail();
    if (!token) return;
    const normalizedEmail = this.tokenEmail;
    const coachId = (await this.authService.getId()) || '';
    this.isSending = true;
    const send$: Observable<unknown> = this.invitationService.sendInvitation(token, coachId, normalizedEmail, false);
    send$.subscribe({
      next: () => {
        this.isSending = false;
        this.invitationUsed = true;
        this.toastService.success(this.translate.instant('INVITATION_SENT_SUCCESSFULLY'));
        this.onCreate.emit({ email: normalizedEmail });
        this.closeModal();
      },
      error: (error: HttpErrorResponse) => {
        this.isSending = false;
        this.showError(error);
      },
    });
  }

  private validate(): boolean {
    this.email = this.email.trim();
    this.emailTouched = true;
    this.serverErrorKey = '';
    return this.canSubmit;
  }

  private showError(error: HttpErrorResponse): void {
    const code = error?.error?.code;
    if (code === 'EMAIL_REQUIRED') {
      this.serverErrorKey = 'EMAIL_ADDRESS_REQUIRED';
    } else if (code === 'INVALID_EMAIL') {
      this.serverErrorKey = 'ENTER_VALID_EMAIL_ADDRESS';
    } else if (code === 'CLIENT_ALREADY_ACTIVE') {
      this.serverErrorKey = 'CLIENT_ALREADY_IN_LIST';
    } else if (code === 'INVITATION_ALREADY_PENDING') {
      // Copy or resend it from the "Invited" tab.
      this.serverErrorKey = 'INVITATION_ALREADY_PENDING_SEE_INVITED';
    } else {
      this.serverErrorKey = 'UNABLE_TO_SEND_INVITATION';
      this.toastService.error(this.translate.instant('UNABLE_TO_SEND_INVITATION'));
    }
  }
}
