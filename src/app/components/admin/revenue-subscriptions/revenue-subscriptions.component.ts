import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgApexchartsModule } from 'ng-apexcharts';
import { debounceTime, distinctUntilChanged, Subject } from 'rxjs';
import { SubscriptionsService } from '../../../service/subscriptions.service';
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
  imports: [CommonModule, FormsModule, NgApexchartsModule],
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

  constructor(private subscriptionsService: SubscriptionsService) {}

  ngOnInit(): void {
    this.loadRevenue();
    this.loadPlans();
    this.loadSubscriptions();

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
        this.allSubscriptions = res.content;
        this.totalElements = res.totalElements;
        this.loading = false;
      },
      error: () => {
        this.allSubscriptions = [];
        this.loading = false;
      }
    });
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
      series: [{ name: 'Revenus', data: values }],
      chart: { type: 'bar', height: 260, toolbar: { show: false } },
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
      xaxis: { categories: data.map(d => d.month) },
      yaxis: {
        min: yMin,
        max: yMax,
        labels: { formatter: (val: number) => `${(val / 1000).toFixed(0)}k€` }
      },
      colors: ['#4db8c7']
    };
  }

  buildBarChart(): void {
    const annual = this.revenueData.map(y => ({
      year: y.year,
      revenue: y.points.reduce((sum, p) => sum + p.revenue, 0)
    }));

    this.barChartOptions = {
      series: [{ name: 'Revenus', data: annual.map(a => a.revenue) }],
      chart: { type: 'bar', height: 288, toolbar: { show: false } },
      plotOptions: { bar: { borderRadius: 6, columnWidth: '55%' } },
      dataLabels: {
        enabled: true,
        formatter: (val: number) => `${(val / 1000).toFixed(0)}k€`
      },
      xaxis: { categories: annual.map(a => a.year) },
      yaxis: {
        labels: { formatter: (val: number) => `${(val / 1000).toFixed(0)}k€` }
      },
      colors: ['#4db8c7']
    };
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
      case 'add-plan': return 'Ajouter un plan';
      case 'edit-plan': return 'Modifier le plan';
      case 'delete-plan': return 'Supprimer le plan';
      case 'view-subscription': return 'Détails de l’abonnement';
      case 'edit-subscription': return 'Modifier l’abonnement';
      case 'suspend-subscription': return 'Suspendre l’abonnement';
      case 'renew-subscription': return 'Renouveler l’abonnement';
      case 'cancel-subscription': return 'Annuler l’abonnement';
      default: return '';
    }
  }

  getConfirmButtonLabel(): string {
    switch (this.modalMode) {
      case 'add-plan': return 'Créer';
      case 'edit-plan': return 'Enregistrer';
      case 'delete-plan': return 'Supprimer';
      case 'edit-subscription': return 'Enregistrer';
      case 'suspend-subscription': return 'Suspendre';
      case 'renew-subscription': return 'Renouveler';
      case 'cancel-subscription': return 'Annuler';
      default: return 'Confirmer';
    }
  }

  getInitials(name: string): string {
    if (!name) return '';
    return name.split(' ')
      .map(p => p.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('');
  }
}
