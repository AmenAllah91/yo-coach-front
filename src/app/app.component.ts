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

  if (normalized === 'integration.yocoach.app' || normalized === 'www.integration.yocoach.app') {
    return false;
  }

  if (normalized === 'account.yocoach.app' || normalized === 'www.account.yocoach.app') {
    return false;
  }

  if (normalized === 'login.yocoach.app' || normalized === 'www.login.yocoach.app') {
    return false;
  }

  if (normalized === 'login-int.yocoach.app' || normalized === 'www.login-int.yocoach.app') {
    return false;
  }

  if (normalized === 'minio.yocoach.app' || normalized === 'www.minio.yocoach.app') {
    return false;
  }

  if (normalized === 'minio-console.yocoach.app' || normalized === 'www.minio-console.yocoach.app') {
    return false;
  }

  if (normalized === 'minio-console-int.yocoach.app' || normalized === 'www.minio-console-int.yocoach.app') {
    return false;
  }

  if (normalized === 'yocoach.app' || normalized === 'www.yocoach.app') {
    return false;
  }

  return normalized.endsWith('.yocoach.app');
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
