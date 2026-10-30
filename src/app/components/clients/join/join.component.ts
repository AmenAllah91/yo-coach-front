import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import Swal from 'sweetalert2';
import { AuthService } from '@config/auth.service';
import { LanguageService } from 'app/service/language.service';
import { JoinLinkPublic, JoinRequestService } from '../../../service/join-request.service';

/** Refusals with their own text; any other error shows the generic one. */
const ERROR_KEYS: Record<string, string> = {
  JOIN_LINK_INVALID: 'JOIN.ERROR_LINK_INVALID',
  INVITATION_NOT_FOR_COACH: 'JOIN.ERROR_NOT_FOR_COACH',
  TOO_MANY_JOIN_REQUESTS: 'JOIN.ERROR_TOO_MANY',
  JOIN_LINK_BUSY: 'JOIN.ERROR_BUSY',
};

/**
 * Page of a coach's sign-up link (no email). The visitor creates their client account (or signs in), then sends a
 * request the coach accepts or declines; a full coach gets it on their waiting list. The typed message survives the
 * sign-up (kept in this tab until the request is sent).
 */
@Component({
  selector: 'app-join',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './join.component.html',
  styleUrls: ['../invitation/invitation.component.scss', './join.component.scss'],
})
export class JoinComponent implements OnInit {
  token = '';
  link?: JoinLinkPublic;
  loading = true;
  loadError = false;
  sending = false;
  message = '';
  errorKey = '';
  readonly maxMessageLength = 500;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private joinRequests: JoinRequestService,
    private authService: AuthService,
    private translate: TranslateService,
    private languageService: LanguageService,
  ) {
    this.languageService.setLanguage(this.languageService.getCurrentLanguage());
  }

  private get messageKey(): string {
    return 'join-message:' + this.token;
  }

  ngOnInit(): void {
    this.token = this.route.snapshot.paramMap.get('token') || '';
    if (!this.token) {
      this.loading = false;
      this.loadError = true;
      return;
    }
    try { this.message = sessionStorage.getItem(this.messageKey) || ''; } catch { /* storage unavailable */ }
    this.joinRequests.getPublicLink(this.token).subscribe({
      next: (link) => {
        this.link = link;
        this.loading = false;
        this.loadError = !link?.available;
        if (link?.available && this.route.snapshot.queryParamMap.get('request') === '1' && this.authService.isLoggedIn()) {
          void this.sendRequest();
        }
      },
      error: () => {
        this.loading = false;
        this.loadError = true;
      },
    });
  }

  async sendRequest(confirmedCoachId?: string): Promise<void> {
    if (!this.link || this.sending) return;
    this.errorKey = '';
    this.rememberMessage();
    if (!this.authService.isLoggedIn()) {
      await this.router.navigate(['/register'], { queryParams: { joinToken: this.token } });
      return;
    }
    if (!(await this.authService.getId())) {
      const back = new URL(`/join/${encodeURIComponent(this.token)}?request=1`, window.location.origin).toString();
      await this.authService.login(back);
      return;
    }
    this.sending = true;
    this.joinRequests.request(this.token, this.message.trim(), confirmedCoachId).subscribe({
      next: () => {
        this.forgetMessage();
        void this.router.navigate(['/join-pending'], { replaceUrl: true });
      },
      error: async (error: HttpErrorResponse) => {
        this.sending = false;
        const code = error?.error?.code;
        if (code === 'COACH_CHANGE_CONFIRMATION_REQUIRED') {
          const answer = await Swal.fire({
            title: this.translate.instant('JOIN.CHANGE_COACH_TITLE'),
            text: this.translate.instant('JOIN.CHANGE_COACH_TEXT', { coach: this.link?.coachName }),
            icon: 'warning',
            showCancelButton: true,
            cancelButtonText: this.translate.instant('CANCEL'),
            confirmButtonText: this.translate.instant('JOIN.CHANGE_COACH_CONFIRM'),
            focusCancel: true,
          });
          if (answer.isConfirmed) await this.sendRequest(error.error.currentCoachId);
          return;
        }
        if (code === 'ALREADY_CLIENT_OF_COACH') {
          this.forgetMessage();
          void this.router.navigate(['/']);
          return;
        }
        this.errorKey = ERROR_KEYS[code] ?? 'JOIN.ERROR_GENERIC';
      },
    });
  }

  private rememberMessage(): void {
    try { sessionStorage.setItem(this.messageKey, this.message); } catch { /* storage unavailable */ }
  }

  private forgetMessage(): void {
    try { sessionStorage.removeItem(this.messageKey); } catch { /* storage unavailable */ }
  }
}
