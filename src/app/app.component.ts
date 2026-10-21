import { CoachingAccessService } from './service/coaching-access.service';
import { AccountAccessService } from './service/account-access.service';
import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { LoaderService } from "./service/loader.service";
import { ToastService } from "./service/toast.service";
import { Router } from "@angular/router";

function isPublicCoachHostname(host: string): boolean {
  if (!host) return false;

  const normalized = host.toLowerCase();

  if (normalized === 'localhost' || normalized.startsWith('localhost:')) {
    return false;
  }

  if (normalized === 'integration.yo-coach.app' || normalized === 'www.integration.yo-coach.app') {
    return false;
  }

  if (normalized === 'app.yo-coach.app' || normalized === 'www.app.yo-coach.app') {
    return false;
  }

  if (normalized === 'yo-coach.app' || normalized === 'www.yo-coach.app') {
    return false;
  }

  return normalized.endsWith('.yo-coach.app');
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit {
  isLoading: Observable<boolean>;

  get isInvitationRoute(): boolean {
    return this.router.url.split('?')[0].startsWith('/invitation/');
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
