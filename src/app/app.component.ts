import { CoachingAccessService } from './service/coaching-access.service';
import { AccountAccessService } from './service/account-access.service';
import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { LoaderService } from "./service/loader.service";
import { ToastService } from "./service/toast.service";
import { Router } from "@angular/router";
import { isPublicCoachHostname } from './config/public-coach-host';


@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit {
  isLoading: Observable<boolean>;

  get isInvitationRoute(): boolean {
    // The sign-up link and the waiting page too: an archived client may ask another coach to join.
    const path = this.router.url.split('?')[0];
    return path.startsWith('/invitation/') || path.startsWith('/join/') || path === '/join-pending';
  }

  /** Calls (ringing on every page, call window) only for a signed-in user: nothing on the public pages. */
  get signedIn(): boolean {
    return !!sessionStorage.getItem('userId');
  }

  constructor(
    public loaderService: LoaderService,
    public toastService: ToastService,
    public coachingAccess: CoachingAccessService,
    public accountAccess: AccountAccessService,
    private router: Router
  ) {
    this.isLoading = this.loaderService.loading$;
  }

  ngOnInit(): void {
    // An answer under 20 s old is reused: the window focus (every click back into the page), the 30 s check and the
    // route guards no longer each call the server; nothing is asked while the tab is hidden.
    const refresh=()=>{ if (document.hidden) return; void this.accountAccess.allowed(20000); void this.coachingAccess.allowed(20000); };
    window.setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    const host = window.location.hostname;
    const isCoachPublicSubdomain = isPublicCoachHostname(host);

    if (isCoachPublicSubdomain && this.router.url === '/') {
      this.router.navigateByUrl('/site');
    }
  }

  getToastIcon(type: string): string {
    switch (type) {
      case 'success': return 'fa-check-circle';
      case 'error': return 'fa-times-circle';
      case 'warning': return 'fa-exclamation-triangle';
      case 'info': return 'fa-info-circle';
      default: return 'fa-info-circle';
    }
  }
}
