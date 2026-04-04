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

  if (normalized === 'integration.yocoach.co' || normalized === 'www.integration.yocoach.co') {
    return false;
  }

  if (normalized === 'app.yocoach.co' || normalized === 'www.app.yocoach.co') {
    return false;
  }

  if (normalized === 'yocoach.co' || normalized === 'www.yocoach.co') {
    return false;
  }

  return normalized.endsWith('.yocoach.co');
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit {
  isLoading: Observable<boolean>;

  constructor(
    public loaderService: LoaderService,
    public toastService: ToastService,
    private router: Router
  ) {
    this.isLoading = this.loaderService.loading$;
  }

  ngOnInit(): void {
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
