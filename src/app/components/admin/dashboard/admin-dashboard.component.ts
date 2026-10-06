import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FeatherModule } from 'angular-feather';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { AdminBillingStats, AdminDashboardService, AdminUserStats } from '../../../service/admin-dashboard.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslateModule, FeatherModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.scss'
})
export class AdminDashboardComponent implements OnInit {
  users: AdminUserStats | null = null;
  billing: AdminBillingStats | null = null;
  usersLoading = false;
  billingLoading = false;
  usersError = false;
  billingError = false;
  private destroyRef = inject(DestroyRef);

  constructor(private service: AdminDashboardService, private location: Location) {}
  ngOnInit(): void { this.refresh(); }
  goBack(): void { this.location.back(); }

  refresh(): void {
    if (this.usersLoading || this.billingLoading) return;
    this.usersLoading = this.billingLoading = true;
    this.usersError = this.billingError = false;
    this.users = this.billing = null;
    this.service.getUsers().pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.usersLoading = false))
      .subscribe({ next: data => this.users = data, error: () => this.usersError = true });
    this.service.getBilling().pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.billingLoading = false))
      .subscribe({ next: data => this.billing = data, error: () => this.billingError = true });
  }
}
