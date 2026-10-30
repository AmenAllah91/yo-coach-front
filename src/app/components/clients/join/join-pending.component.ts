import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '@config/auth.service';
import { CoachingAccessService } from '../../../service/coaching-access.service';
import { ClientJoinRequest, JoinRequestService } from '../../../service/join-request.service';

/**
 * A client's request waiting for the coach's answer, or a client without a coach and nothing pending. Checked again
 * every 20 s and when the tab comes back: once the coach accepts, the client goes on to the onboarding.
 */
@Component({
  selector: 'app-join-pending',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './join-pending.component.html',
  styleUrls: ['../invitation/invitation.component.scss', './join.component.scss'],
})
export class JoinPendingComponent implements OnInit, OnDestroy {
  request: ClientJoinRequest | null = null;
  loading = true;
  cancelling = false;
  /** Still coached by their current coach while asking another one (they keep their space until accepted). */
  hasCoach = false;
  private timer?: ReturnType<typeof setInterval>;
  private readonly onFocus = () => { if (!document.hidden) void this.check(); };

  constructor(
    private joinRequests: JoinRequestService,
    private coachingAccess: CoachingAccessService,
    private authService: AuthService,
    private router: Router,
    private translate: TranslateService,
  ) {}

  ngOnInit(): void {
    void this.check();
    this.timer = setInterval(() => void this.check(), 20000);
    document.addEventListener('visibilitychange', this.onFocus);
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
    document.removeEventListener('visibilitychange', this.onFocus);
  }

  private async check(): Promise<void> {
    await this.coachingAccess.refresh();
    this.hasCoach = !this.coachingAccess.noCoach$.value && !this.coachingAccess.blocked$.value;
    try {
      this.request = await firstValueFrom(this.joinRequests.getMyRequest());
    } catch {
      // Kept as shown; checked again later.
      if (!this.request && this.hasCoach) return;
    }
    if (!this.request && this.hasCoach) {
      // Accepted (the request is closed), or a client who already has a coach and nothing pending.
      void this.router.navigate(['/client-onboarding'], { replaceUrl: true });
      return;
    }
    this.loading = false;
  }

  goToMySpace(): void {
    void this.router.navigate(['/']);
  }

  cancel(): void {
    if (!this.request || this.cancelling || !confirm(this.translate.instant('JOIN.CANCEL_CONFIRM'))) return;
    this.cancelling = true;
    this.joinRequests.cancelMyRequest(this.request.id).subscribe({
      next: () => { this.request = null; this.cancelling = false; },
      error: () => { this.cancelling = false; },
    });
  }

  signOut(): void {
    void this.authService.logout();
  }
}
