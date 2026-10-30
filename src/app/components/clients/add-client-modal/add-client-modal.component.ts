import {Component, Input, Output, EventEmitter, OnChanges} from '@angular/core';
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
import { RouterLink } from '@angular/router';
import { JoinLink, JoinRequestService } from '../../../service/join-request.service';

/**
 * Two ways to add clients. "By email": the link is created for that email only, then sent by email or copied
 * (WhatsApp, Messenger...); pending invitations are listed in the "Invited" tab. "Sign-up link": the coach's own link,
 * without email, shared anywhere; each person who uses it sends a request the coach accepts or declines ("Requests"
 * tab). The coach's slots are shown: once full, new clients go to the waiting list.
 */
@Component({
  selector: 'app-add-client-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, FeatherModule, TranslateModule, RouterLink],
  templateUrl: './add-client-modal.component.html',
  styleUrls: ['./add-client-modal.component.scss'],
})
export class AddClientModalComponent implements OnChanges {
  @Input() isVisible = false;
  @Output() onClose  = new EventEmitter<void>();
  @Output() onCreate = new EventEmitter<{ email: string }>();
  mode: 'email' | 'link' = 'email';
  joinLink: JoinLink | null = null;
  joinLinkLoading = false;
  joinLinkError = false;
  joinLinkCopied = false;
  joinLinkBusy = false;
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
    private joinRequests: JoinRequestService,
  ) {
  }

  ngOnChanges(): void {
    if (this.isVisible && !this.joinLink && !this.joinLinkLoading) this.loadJoinLink();
  }

  /** The coach's link and slots, read when the modal opens (the slots matter in both modes). */
  loadJoinLink(): void {
    this.joinLinkLoading = true;
    this.joinLinkError = false;
    this.joinRequests.getMyLink().subscribe({
      next: (link) => { this.joinLink = link; this.joinLinkLoading = false; },
      error: () => { this.joinLinkError = true; this.joinLinkLoading = false; },
    });
  }

  get joinLinkUrl(): string {
    return this.joinLink ? this.joinRequests.linkBaseUrl + this.joinLink.token : '';
  }

  /** 0..100 for the slots bar; null without a limit. */
  get slotsPercent(): number | null {
    const limit = this.joinLink?.limit;
    if (!limit) return null;
    return Math.min(100, Math.round(((this.joinLink?.current ?? 0) / limit) * 100));
  }

  get slotsLeft(): number {
    return Math.max(0, (this.joinLink?.limit ?? 0) - (this.joinLink?.current ?? 0));
  }

  setMode(mode: 'email' | 'link'): void {
    this.mode = mode;
    this.joinLinkCopied = false;
  }

  copyJoinLink(): void {
    if (!this.joinLink?.active) return;
    navigator.clipboard.writeText(this.joinLinkUrl).catch(() => {});
    this.joinLinkCopied = true;
    setTimeout(() => (this.joinLinkCopied = false), 2000);
  }

  /** Native share sheet where available (phones), else copy. */
  shareJoinLink(): void {
    if (!this.joinLink?.active) return;
    const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> };
    if (nav.share) {
      nav.share({ title: this.translate.instant('JOIN.SHARE_TITLE'), text: this.translate.instant('JOIN.SHARE_TEXT'), url: this.joinLinkUrl })
        .catch(() => {});
    } else {
      this.copyJoinLink();
    }
  }

  regenerateJoinLink(): void {
    if (this.joinLinkBusy || !confirm(this.translate.instant('JOIN.REGENERATE_CONFIRM'))) return;
    this.joinLinkBusy = true;
    this.joinRequests.regenerateLink().subscribe({
      next: (link) => {
        this.joinLink = link;
        this.joinLinkBusy = false;
        this.toastService.success(this.translate.instant('JOIN.REGENERATED'));
      },
      error: () => { this.joinLinkBusy = false; },
    });
  }

  toggleJoinLink(): void {
    if (this.joinLinkBusy || !this.joinLink) return;
    this.joinLinkBusy = true;
    this.joinRequests.setLinkActive(!this.joinLink.active).subscribe({
      next: (link) => { this.joinLink = link; this.joinLinkBusy = false; },
      error: () => { this.joinLinkBusy = false; },
    });
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
    this.mode = 'email';
    this.joinLink = null;
    this.joinLinkCopied = false;
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
