import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgApexchartsModule } from 'ng-apexcharts';
import { debounceTime, distinctUntilChanged, Subject } from 'rxjs';
import { SubscriptionsService } from '../../../service/subscriptions.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  CoachSubscriptionDto,
  PlanDto,
  RevenueByYearDto,
  RevenueModalMode,
  SubscriptionForm,
  SubscriptionStatsDto,
  SubscriptionStatus,
  PlanForm
} from '../models/subscription-models';

@Component({
  selector: 'app-revenue-subscriptions',
  standalone: true,
  imports: [CommonModule, FormsModule, NgApexchartsModule, TranslateModule],
  templateUrl: './revenue-subscriptions.component.html',
  styleUrl: './revenue-subscriptions.component.scss'
})
export class RevenueSubscriptionsComponent implements OnInit {
  plans: PlanDto[] = [];
  allSubscriptions: CoachSubscriptionDto[] = [];
  revenueData: RevenueByYearDto[] = [];

  searchQuery = '';
  statusFilter: SubscriptionStatus | 'Tous' = 'Tous';
  planFilter = 'Tous';

  availableYears: string[] = [];
  selectedYear = '';
  chartView: 'monthly' | 'annual' = 'monthly';

  areaChartOptions: any = {};
  barChartOptions: any = {};

  loading = false;
  page = 0;
  size = 10;
  totalElements = 0;

  modalOpen = false;
  modalMode: RevenueModalMode = null;
  modalLoading = false;
  selectedPlan: PlanDto | null = null;
  selectedSubscription: CoachSubscriptionDto | null = null;

  planForm: PlanForm = {
    name: '',
    priceMonthly: 0,
    priceAnnual: 0,
    featuresText: '',
    isPopular: false
  };

  subscriptionForm: SubscriptionForm = {
    planId: '',
    status: 'Actif',
    startDate: '',
    endDate: '',
    amountPaid: 0
  };

  stats: SubscriptionStatsDto = {
    totalCoaches: 0,
    activeSubs: 0,
    expiredSubs: 0,
    canceledSubs: 0,
    currentMonthlyRevenue: 0,
    totalRevenue: 0,
    yearTotal: 0,
    yearAverage: 0
  };

  private searchSubject = new Subject<string>();

  constructor(private subscriptionsService: SubscriptionsService, private translate: TranslateService) {}

  ngOnInit(): void {
    this.loadRevenue();
    this.loadPlans();
    this.loadSubscriptions();
    this.translate.onLangChange.subscribe(() => {
      this.buildAreaChart();
      this.buildBarChart();
    });

    this.searchSubject.pipe(
      debounceTime(400),
      distinctUntilChanged()
    ).subscribe(() => {
      this.page = 0;
      this.loadSubscriptions();
    });
  }

  onSearchChange(value: string): void {
    this.searchQuery = value;
    this.searchSubject.next(value);
  }

  onStatusChange(): void {
    this.page = 0;
    this.loadSubscriptions();
  }

  onPlanFilterChange(): void {
    this.page = 0;
    this.loadSubscriptions();
  }

  loadRevenue(): void {
    this.subscriptionsService.getRevenueByYear().subscribe({
      next: (years) => {
        this.revenueData = years;
        this.availableYears = years.map(y => y.year);
        this.selectedYear = this.availableYears[this.availableYears.length - 1] || '';
        this.loadStats();
        this.buildAreaChart();
        this.buildBarChart();
      }
    });
  }

  loadStats(): void {
    if (!this.selectedYear) return;

    this.subscriptionsService.getSubscriptionStats(this.selectedYear).subscribe({
      next: (stats) => {
        this.stats = stats;
      }
    });
  }

  loadPlans(): void {
    this.subscriptionsService.getPlans().subscribe({
      next: (plans) => {
        this.plans = plans;
      }
    });
  }

  loadSubscriptions(): void {
    this.loading = true;

    this.subscriptionsService.getSubscriptions({
      search: this.searchQuery,
      status: this.statusFilter,
      planId: this.planFilter,
      page: this.page,
      size: this.size
    }).subscribe({
      next: (res) => {
        this.allSubscriptions = this.sortSubscriptionsNewestFirst(res.content || []);
        this.totalElements = res.totalElements;
        this.loading = false;
      },
      error: () => {
        this.allSubscriptions = [];
        this.loading = false;
      }
    });
  }

  private sortSubscriptionsNewestFirst(
    subscriptions: CoachSubscriptionDto[]
  ): CoachSubscriptionDto[] {
    return [...subscriptions].sort((a, b) => {
      const bTime = this.toDateTime(b.startDate);
      const aTime = this.toDateTime(a.startDate);

      if (bTime !== aTime) {
        return bTime - aTime;
      }

      return (b.id || '').localeCompare(a.id || '');
    });
  }

  private toDateTime(value: string | null | undefined): number {
    if (!value) return 0;

    const native = Date.parse(value);
    if (!Number.isNaN(native)) {
      return native;
    }

    const parts = value.split(/[\/\-]/).map(part => Number(part));

    if (parts.length === 3 && parts.every(part => !Number.isNaN(part))) {
      const [first, second, third] = parts;

      if (first > 31) {
        return new Date(first, second - 1, third).getTime();
      }

      return new Date(third, second - 1, first).getTime();
    }

    return 0;
  }

  refreshPageData(): void {
    this.loadPlans();
    this.loadSubscriptions();
    this.loadStats();
    this.buildAreaChart();
    this.buildBarChart();
  }

  get totalCoaches() { return this.stats.totalCoaches; }
  get activeSubs() { return this.stats.activeSubs; }
  get expiredSubs() { return this.stats.expiredSubs; }
  get currentMonthlyRevenue() { return this.stats.currentMonthlyRevenue; }
  get totalRevenue() { return this.stats.totalRevenue; }
  get yearTotal() { return this.stats.yearTotal; }
  get yearAverage() { return this.stats.yearAverage; }

  get currentYearData() {
    return this.revenueData.find(y => y.year === this.selectedYear)?.points ?? [];
  }

  get yearIndex() { return this.availableYears.indexOf(this.selectedYear); }
  get canGoPrev() { return this.yearIndex > 0; }
  get canGoNext() { return this.yearIndex < this.availableYears.length - 1; }

  prevYear() {
    if (this.canGoPrev) {
      this.selectedYear = this.availableYears[this.yearIndex - 1];
      this.loadStats();
      this.buildAreaChart();
    }
  }

  nextYear() {
    if (this.canGoNext) {
      this.selectedYear = this.availableYears[this.yearIndex + 1];
      this.loadStats();
      this.buildAreaChart();
    }
  }

  setChartView(v: 'monthly' | 'annual') {
    this.chartView = v;
  }

  buildAreaChart(): void {
    const data = this.currentYearData;
    const values = data.map(d => d.revenue);
    const minVal = values.length ? Math.min(...values) : 0;
    const maxVal = values.length ? Math.max(...values) : 0;
    const yMin = Math.max(0, Math.floor((minVal * 0.85) / 1000) * 1000);
    const yMax = Math.ceil((maxVal * 1.1 || 1000) / 1000) * 1000;

    this.areaChartOptions = {
      series: [{ name: this.translate.instant('REVENUE'), data: values }],
      chart: { type: 'bar', height: 260, width: '100%', toolbar: { show: false }, redrawOnParentResize: true, redrawOnWindowResize: true, parentHeightOffset: 0 },
      dataLabels: {
        enabled: true,
        formatter: (val: number) => `${(val / 1000).toFixed(1)}k€`
      },
      stroke: { curve: 'smooth', width: 3, colors: ['#4db8c7'] },
      fill: {
        type: 'gradient',
        gradient: { shadeIntensity: 1, opacityFrom: 0.3, opacityTo: 0.02, stops: [5, 95] },
        colors: ['#4db8c7']
      },
      xaxis: {
        categories: data.map(d => this.shortMonthLabel(d.month)),
        labels: {
          rotate: 0,
          trim: true,
          hideOverlappingLabels: true,
          style: { fontSize: '11px' }
        }
      },
      yaxis: {
        min: yMin,
        max: yMax,
        labels: { formatter: (val: number) => `${(val / 1000).toFixed(0)}k€` }
      },
      grid: { padding: { left: 0, right: 8, top: 8, bottom: 0 } },
      colors: ['#4db8c7'],
      responsive: [
        {
          breakpoint: 768,
          options: {
            chart: { height: 255, width: '100%' },
            plotOptions: { bar: { columnWidth: '38%', borderRadius: 5 } },
            dataLabels: { enabled: false },
            xaxis: { labels: { rotate: 0, style: { fontSize: '9px' } } },
            yaxis: { labels: { minWidth: 24, maxWidth: 28, style: { fontSize: '9px' } } },
            grid: { padding: { left: -4, right: 4, top: 6, bottom: 0 } }
          }
        }
      ]
    };
  }

  buildBarChart(): void {
    const annual = this.revenueData.map(y => ({
      year: y.year,
      revenue: y.points.reduce((sum, p) => sum + p.revenue, 0)
    }));

    this.barChartOptions = {
      series: [{ name: this.translate.instant('REVENUE'), data: annual.map(a => a.revenue) }],
      chart: { type: 'bar', height: 288, width: '100%', toolbar: { show: false }, redrawOnParentResize: true, redrawOnWindowResize: true, parentHeightOffset: 0 },
      plotOptions: { bar: { borderRadius: 6, columnWidth: '55%' } },
      dataLabels: {
        enabled: true,
        formatter: (val: number) => `${(val / 1000).toFixed(0)}k€`
      },
      xaxis: {
        categories: annual.map(a => a.year),
        labels: { rotate: 0, style: { fontSize: '11px' } }
      },
      yaxis: {
        labels: { formatter: (val: number) => `${(val / 1000).toFixed(0)}k€` }
      },
      grid: { padding: { left: 0, right: 8, top: 8, bottom: 0 } },
      colors: ['#4db8c7'],
      responsive: [
        {
          breakpoint: 768,
          options: {
            chart: { height: 255, width: '100%' },
            plotOptions: { bar: { columnWidth: '38%', borderRadius: 5 } },
            dataLabels: { enabled: false },
            xaxis: { labels: { rotate: 0, style: { fontSize: '9px' } } },
            yaxis: { labels: { minWidth: 24, maxWidth: 28, style: { fontSize: '9px' } } },
            grid: { padding: { left: -4, right: 4, top: 6, bottom: 0 } }
          }
        }
      ]
    };
  }

  shortMonthLabel(month: string): string {
    const normalized = (month || '').toLowerCase().trim();

    const map: Record<string, string> = {
      janvier: 'janv.',
      january: 'janv.',
      février: 'févr.',
      fevrier: 'févr.',
      february: 'févr.',
      mars: 'mars',
      march: 'mars',
      avril: 'avr.',
      april: 'avr.',
      mai: 'mai',
      may: 'mai',
      juin: 'juin',
      june: 'juin',
      juillet: 'juil.',
      july: 'juil.',
      août: 'août',
      aout: 'août',
      august: 'août',
      septembre: 'sept.',
      september: 'sept.',
      octobre: 'oct.',
      october: 'oct.',
      novembre: 'nov.',
      november: 'nov.',
      décembre: 'déc.',
      decembre: 'déc.',
      december: 'déc.'
    };

    const monthIndex = ['janvier','january','février','fevrier','february','mars','march','avril','april','mai','may','juin','june','juillet','july','août','aout','august','septembre','september','octobre','october','novembre','november','décembre','decembre','december'].indexOf(normalized);
    if (monthIndex >= 0) {
      const indexes = [0,0,1,1,1,2,2,3,3,4,4,5,5,6,6,7,7,7,8,8,9,9,10,10,11,11,11];
      return new Intl.DateTimeFormat(this.translate.currentLang === 'fr' ? 'fr-FR' : 'en-US', { month: 'short' }).format(new Date(2026, indexes[monthIndex], 1));
    }
    return map[normalized] || month;
  }

  statusClass(status: string): string {
    switch (status) {
      case 'Actif': return 'badge--success';
      case 'Expiré': return 'badge--danger';
      case 'Suspendu': return 'badge--neutral';
      default: return 'badge--neutral';
    }
  }

  onAddPlan(): void {
    this.modalMode = 'add-plan';
    this.selectedPlan = null;
    this.selectedSubscription = null;
    this.planForm = {
      name: '',
      priceMonthly: 0,
      priceAnnual: 0,
      featuresText: '',
      isPopular: false
    };
    this.modalOpen = true;
  }

  onEditPlan(plan: PlanDto): void {
    this.modalMode = 'edit-plan';
    this.selectedPlan = plan;
    this.selectedSubscription = null;
    this.planForm = {
      name: plan.name,
      priceMonthly: plan.priceMonthly,
      priceAnnual: plan.priceAnnual,
      featuresText: plan.features.join('\n'),
      isPopular: !!plan.isPopular
    };
    this.modalOpen = true;
  }

  onDeletePlan(plan: PlanDto): void {
    this.modalMode = 'delete-plan';
    this.selectedPlan = plan;
    this.selectedSubscription = null;
    this.modalOpen = true;
  }

  onViewSubscription(sub: CoachSubscriptionDto): void {
    this.modalMode = 'view-subscription';
    this.selectedSubscription = sub;
    this.selectedPlan = null;
    this.modalOpen = true;
  }

  onEditSubscription(sub: CoachSubscriptionDto): void {
    this.modalMode = 'edit-subscription';
    this.selectedSubscription = sub;
    this.selectedPlan = null;
    this.subscriptionForm = {
      planId: sub.planId,
      status: sub.status,
      startDate: sub.startDate,
      endDate: sub.endDate,
      amountPaid: sub.amountPaid
    };
    this.modalOpen = true;
  }

  onSuspendSubscription(sub: CoachSubscriptionDto): void {
    this.modalMode = 'suspend-subscription';
    this.selectedSubscription = sub;
    this.selectedPlan = null;
    this.modalOpen = true;
  }

  onRenewSubscription(sub: CoachSubscriptionDto): void {
    this.modalMode = 'renew-subscription';
    this.selectedSubscription = sub;
    this.selectedPlan = null;
    this.modalOpen = true;
  }

  onCancelSubscription(sub: CoachSubscriptionDto): void {
    this.modalMode = 'cancel-subscription';
    this.selectedSubscription = sub;
    this.selectedPlan = null;
    this.modalOpen = true;
  }

  closeModal(): void {
    this.modalOpen = false;
    this.modalMode = null;
    this.modalLoading = false;
    this.selectedPlan = null;
    this.selectedSubscription = null;
  }

  submitModalAction(): void {
    this.modalLoading = true;

    if (this.modalMode === 'add-plan') {
      this.subscriptionsService.createPlan({
        name: this.planForm.name,
        priceMonthly: this.planForm.priceMonthly,
        priceAnnual: this.planForm.priceAnnual,
        features: this.planForm.featuresText.split('\n').map(f => f.trim()).filter(Boolean),
        isPopular: this.planForm.isPopular
      }).subscribe({
        next: () => this.afterActionSuccess(),
        error: () => this.modalLoading = false
      });
      return;
    }

    if (this.modalMode === 'edit-plan' && this.selectedPlan) {
      this.subscriptionsService.updatePlan(this.selectedPlan.id, {
        name: this.planForm.name,
        priceMonthly: this.planForm.priceMonthly,
        priceAnnual: this.planForm.priceAnnual,
        features: this.planForm.featuresText.split('\n').map(f => f.trim()).filter(Boolean),
        isPopular: this.planForm.isPopular
      }).subscribe({
        next: () => this.afterActionSuccess(),
        error: () => this.modalLoading = false
      });
      return;
    }

    if (this.modalMode === 'delete-plan' && this.selectedPlan) {
      this.subscriptionsService.deletePlan(this.selectedPlan.id).subscribe({
        next: () => this.afterActionSuccess(),
        error: () => this.modalLoading = false
      });
      return;
    }

    if (this.modalMode === 'edit-subscription' && this.selectedSubscription) {
      this.subscriptionsService.updateSubscription(this.selectedSubscription.id, {
        planId: this.subscriptionForm.planId,
        status: this.subscriptionForm.status,
        startDate: this.subscriptionForm.startDate,
        endDate: this.subscriptionForm.endDate,
        amountPaid: this.subscriptionForm.amountPaid
      }).subscribe({
        next: () => this.afterActionSuccess(),
        error: () => this.modalLoading = false
      });
      return;
    }

    if (this.modalMode === 'suspend-subscription' && this.selectedSubscription) {
      this.subscriptionsService.suspendSubscription(this.selectedSubscription.id).subscribe({
        next: () => this.afterActionSuccess(),
        error: () => this.modalLoading = false
      });
      return;
    }

    if (this.modalMode === 'renew-subscription' && this.selectedSubscription) {
      this.subscriptionsService.renewSubscription(this.selectedSubscription.id).subscribe({
        next: () => this.afterActionSuccess(),
        error: () => this.modalLoading = false
      });
      return;
    }

    if (this.modalMode === 'cancel-subscription' && this.selectedSubscription) {
      this.subscriptionsService.cancelSubscription(this.selectedSubscription.id).subscribe({
        next: () => this.afterActionSuccess(),
        error: () => this.modalLoading = false
      });
      return;
    }

    this.modalLoading = false;
  }

  afterActionSuccess(): void {
    this.closeModal();
    this.refreshPageData();
  }

  getModalTitle(): string {
    switch (this.modalMode) {
      case 'add-plan': return this.translate.instant('ADD_PLAN');
      case 'edit-plan': return this.translate.instant('EDIT_PLAN');
      case 'delete-plan': return this.translate.instant('DELETE_PLAN');
      case 'view-subscription': return this.translate.instant('SUBSCRIPTION_DETAILS');
      case 'edit-subscription': return this.translate.instant('EDIT_SUBSCRIPTION');
      case 'suspend-subscription': return this.translate.instant('SUSPEND_SUBSCRIPTION');
      case 'renew-subscription': return this.translate.instant('RENEW_SUBSCRIPTION');
      case 'cancel-subscription': return this.translate.instant('CANCEL_SUBSCRIPTION');
      default: return '';
    }
  }

  getConfirmButtonLabel(): string {
    switch (this.modalMode) {
      case 'add-plan': return this.translate.instant('CREATE');
      case 'edit-plan': return this.translate.instant('SAVE');
      case 'delete-plan': return this.translate.instant('DELETE');
      case 'edit-subscription': return this.translate.instant('SAVE');
      case 'suspend-subscription': return this.translate.instant('SUSPEND');
      case 'renew-subscription': return this.translate.instant('RENEW');
      case 'cancel-subscription': return this.translate.instant('CANCEL');
      default: return this.translate.instant('CONFIRM');
    }
  }

  statusLabel(status: string): string {
    const key = status === 'Actif' ? 'USER_STATUS_ACTIVE' : status === 'Expiré' ? 'EXPIRED' : status === 'Annulé' ? 'CANCELED' : 'SUSPENDED';
    return this.translate.instant(key);
  }

  getInitials(name: string): string {
    if (!name) return '';
    return name.split(' ')
      .map(p => p.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('');
  }
}
