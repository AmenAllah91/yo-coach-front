import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { InvitationService } from "../../../service/invitation.service";
import { TranslateModule } from '@ngx-translate/core';
import { LanguageService } from 'app/service/language.service';
import { AuthService } from '@config/auth.service';
import Swal from 'sweetalert2';
import { CoachingAccessService } from '../../../service/coaching-access.service';

interface InvitationView {
  coachName: string;
  gymName: string;
  status: string;
}

@Component({
  selector: 'app-invitation',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './invitation.component.html',
  styleUrls: ['./invitation.component.scss'],
})
export class InvitationComponent implements OnInit {

  token!: string;

  invitation?: InvitationView;
  loading = true;
  accepting = false;
  loadError = false;
  actionError = false;
  /** SUB-26/29: the coach has no free active-client slot; the invitation stays pending. */
  coachLimitReached = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private invitationService: InvitationService,
    private languageService: LanguageService,
    private authService: AuthService,
    private coachingAccess: CoachingAccessService
  ) {
    this.languageService.setLanguage(this.languageService.getCurrentLanguage());
  }

  ngOnInit(): void {
    this.token = this.route.snapshot.paramMap.get('token')!;

    if (!this.token) {
      this.loading = false;
      this.loadError = true;
      return;
    }

    this.loadInvitation();
  }

  loadInvitation() {
    this.invitationService.getInvitationByToken(this.token)
      .subscribe({
        next: (invitation) => {
          if (!invitation) {
            this.loadError = true;
            this.loading = false;
            return;
          }

          this.invitation = invitation;
          this.loading = false;
          if (this.route.snapshot.queryParamMap.get('accept') === '1' &&
              this.authService.isLoggedIn() &&
              invitation.status === 'PENDING') {
            void this.acceptInvitation();
          }
        },
        error: () => {
          this.loadError = true;
          this.loading = false;
        }
      });
  }

  async acceptInvitation(confirmedCoachId?: string): Promise<void> {
    if (!this.invitation || this.accepting) {
      return;
    }

    this.actionError = false;
    this.coachLimitReached = false;
    if (!this.authService.isLoggedIn()) {
      await this.router.navigate(['/register'], {
        queryParams: { invitationToken: this.token }
      });
      return;
    }

    const userId = await this.authService.getId();
    if (!userId) {
      const redirectUri = new URL(
        `/invitation/${encodeURIComponent(this.token)}`,
        window.location.origin
      ).toString();
      await this.authService.login(redirectUri);
      return;
    }

    this.accepting = true;
    this.invitationService.acceptInvitation(this.token, userId, confirmedCoachId)
      .subscribe({
        next: async () => {
          this.invitation!.status = 'ACCEPTED';
          await this.coachingAccess.refresh();
          void this.router.navigate(['/client-onboarding']);
        },
        error: async (error) => {
          this.accepting = false;
          if (error.status === 409 && error.error?.code === 'COACH_CHANGE_CONFIRMATION_REQUIRED') {
            this.accepting = true;
            const result = await Swal.fire({
              title: 'Change coach?',
              text: 'Accepting this invitation will end your current active coaching relationship. Your current coach will be moved to Archived.',
              icon: 'warning',
              showCancelButton: true,
              cancelButtonText: 'Cancel',
              confirmButtonText: 'Change coach',
              focusCancel: true,
            });
            this.accepting = false;
            if (result.isConfirmed) await this.acceptInvitation(error.error.currentCoachId);
            return;
          }
          if (error.error?.code === 'COACH_CLIENT_LIMIT_REACHED') {
            this.coachLimitReached = true;
            return;
          }
          this.actionError = true;
        }
      });
  }
}
