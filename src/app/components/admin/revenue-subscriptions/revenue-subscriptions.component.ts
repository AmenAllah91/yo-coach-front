import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgApexchartsModule } from 'ng-apexcharts';

export type SubscriptionStatus = 'Actif' | 'Expiré' | 'Annulé';

export interface Plan {
  id: string;
  name: string;
  priceMonthly: number;
  priceAnnual: number;
  features: string[];
  subscriberCount: number;
  isPopular?: boolean;
}

export interface CoachSubscription {
  id: string;
  coachName: string;
  email: string;
  avatar: string;
  plan: string;
  status: SubscriptionStatus;
  startDate: string;
  endDate: string;
  amountPaid: number;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────
const MOCK_PLANS: Plan[] = [
  {
    id: 'basic', name: 'Basic', priceMonthly: 29, priceAnnual: 290,
    features: ["Jusqu'à 10 clients", "Programmes d'entraînement basiques", 'Suivi des mensurations', 'Support par email'],
    subscriberCount: 45,
  },
  {
    id: 'pro', name: 'Pro', priceMonthly: 59, priceAnnual: 590,
    features: ['Clients illimités', 'Programmes avancés & modèles', 'Suivi nutritionnel complet', 'Messagerie in-app', 'Support prioritaire'],
    subscriberCount: 112, isPopular: true,
  },
  {
    id: 'premium', name: 'Premium', priceMonthly: 99, priceAnnual: 990,
    features: ['Toutes les fonctionnalités Pro', 'Marque blanche (logo personnalisé)', 'API & Intégrations', "Gestion d'équipe (sous-coachs)", 'Account manager dédié'],
    subscriberCount: 28,
  },
];

const MOCK_SUBSCRIPTIONS: CoachSubscription[] = [
  { id: 'sub_1', coachName: 'Sarah Martin',   email: 'sarah.m@coach.com',   avatar: 'https://i.pravatar.cc/150?u=4',  plan: 'Pro',     status: 'Actif',  startDate: '15/01/2024', endDate: '15/01/2025', amountPaid: 590 },
  { id: 'sub_2', coachName: 'Julien Moreau',  email: 'julien.m@coach.com',  avatar: 'https://i.pravatar.cc/150?u=5',  plan: 'Basic',   status: 'Actif',  startDate: '02/03/2024', endDate: '02/04/2024', amountPaid: 29  },
  { id: 'sub_3', coachName: 'Sophie Petit',   email: 'sophie.p@coach.com',  avatar: 'https://i.pravatar.cc/150?u=6',  plan: 'Pro',     status: 'Expiré', startDate: '10/02/2023', endDate: '10/02/2024', amountPaid: 590 },
  { id: 'sub_4', coachName: 'Marc Dubois',    email: 'marc.d@coach.com',    avatar: 'https://i.pravatar.cc/150?u=12', plan: 'Premium', status: 'Actif',  startDate: '01/01/2024', endDate: '01/01/2025', amountPaid: 990 },
  { id: 'sub_5', coachName: 'Elodie Roux',    email: 'elodie.r@coach.com',  avatar: 'https://i.pravatar.cc/150?u=15', plan: 'Basic',   status: 'Annulé', startDate: '15/11/2023', endDate: '15/12/2023', amountPaid: 29  },
  { id: 'sub_6', coachName: 'Thomas Leroy',   email: 'thomas.l@coach.com',  avatar: 'https://i.pravatar.cc/150?u=18', plan: 'Pro',     status: 'Actif',  startDate: '20/02/2024', endDate: '20/03/2024', amountPaid: 59  },
  { id: 'sub_7', coachName: 'Julie Blanc',    email: 'julie.b@coach.com',   avatar: 'https://i.pravatar.cc/150?u=22', plan: 'Premium', status: 'Actif',  startDate: '05/03/2024', endDate: '05/04/2024', amountPaid: 99  },
  { id: 'sub_8', coachName: 'Antoine Girard', email: 'antoine.g@coach.com', avatar: 'https://i.pravatar.cc/150?u=25', plan: 'Basic',   status: 'Expiré', startDate: '10/01/2024', endDate: '10/02/2024', amountPaid: 29  },
];

const MOCK_REVENUE_DATA: Record<string, { month: string; revenue: number }[]> = {
  '2022': [
    { month: 'Jan', revenue: 4200 }, { month: 'Fév', revenue: 4800 }, { month: 'Mar', revenue: 5100 },
    { month: 'Avr', revenue: 5600 }, { month: 'Mai', revenue: 6200 }, { month: 'Jun', revenue: 6800 },
    { month: 'Jul', revenue: 6500 }, { month: 'Aoû', revenue: 5900 }, { month: 'Sep', revenue: 7200 },
    { month: 'Oct', revenue: 7800 }, { month: 'Nov', revenue: 8400 }, { month: 'Déc', revenue: 9100 },
  ],
  '2023': [
    { month: 'Jan', revenue: 9500  }, { month: 'Fév', revenue: 9800  }, { month: 'Mar', revenue: 10200 },
    { month: 'Avr', revenue: 10800 }, { month: 'Mai', revenue: 11500 }, { month: 'Jun', revenue: 11200 },
    { month: 'Jul', revenue: 10900 }, { month: 'Aoû', revenue: 10500 }, { month: 'Sep', revenue: 11800 },
    { month: 'Oct', revenue: 12500 }, { month: 'Nov', revenue: 13200 }, { month: 'Déc', revenue: 14100 },
  ],
  '2024': [
    { month: 'Jan', revenue: 15800 }, { month: 'Fév', revenue: 16500 }, { month: 'Mar', revenue: 18200 },
    { month: 'Avr', revenue: 17900 }, { month: 'Mai', revenue: 19500 }, { month: 'Jun', revenue: 20100 },
    { month: 'Jul', revenue: 19800 }, { month: 'Aoû', revenue: 18600 }, { month: 'Sep', revenue: 21200 },
    { month: 'Oct', revenue: 22500 }, { month: 'Nov', revenue: 23800 }, { month: 'Déc', revenue: 25100 },
  ],
};

// ─── Shared base — désactive TOUT ce qu'ApexCharts injecte en dehors du SVG ──
const CHART_BASE = {
  toolbar:          { show: false },
  zoom:             { enabled: false },
  sparkline:        { enabled: false },
  parentHeightOffset: 0,
  animations:       { enabled: true, easing: 'easeinout' as const, speed: 400 },
};
const LEGEND_OFF   = { show: false };
const TITLE_OFF    = { text: undefined };
const SUBTITLE_OFF = { text: undefined };

// ─── Component ────────────────────────────────────────────────────────────────
@Component({
  selector: 'app-revenue-subscriptions',
  standalone: true,
  imports: [CommonModule, FormsModule, NgApexchartsModule],
  templateUrl: './revenue-subscriptions.component.html',
  styleUrl: './revenue-subscriptions.component.scss'
})
export class RevenueSubscriptionsComponent implements OnInit {

  plans            = MOCK_PLANS;
  allSubscriptions = MOCK_SUBSCRIPTIONS;

  searchQuery  = '';
  statusFilter: SubscriptionStatus | 'Tous' = 'Tous';
  planFilter   = 'Tous';

  availableYears = Object.keys(MOCK_REVENUE_DATA);
  selectedYear   = this.availableYears[this.availableYears.length - 1];
  chartView: 'monthly' | 'annual' = 'monthly';

  areaChartOptions: any = {};
  barChartOptions:  any = {};

  ngOnInit(): void {
    this.buildAreaChart();
    this.buildBarChart();
  }

  // ── Stats ──────────────────────────────────────────────────────────────────
  get totalCoaches()          { return this.allSubscriptions.length; }
  get activeSubs()            { return this.allSubscriptions.filter(s => s.status === 'Actif').length; }
  get expiredSubs()           { return this.allSubscriptions.filter(s => s.status === 'Expiré').length; }
  get currentYearData()       { return MOCK_REVENUE_DATA[this.selectedYear] || []; }
  get currentMonthlyRevenue() { const d = this.currentYearData; return d.length ? d[d.length - 1].revenue : 0; }
  get totalRevenue()          { return Object.values(MOCK_REVENUE_DATA).flat().reduce((a, c) => a + c.revenue, 0); }
  get yearTotal()             { return this.currentYearData.reduce((s, m) => s + m.revenue, 0); }
  get yearAverage()           { const d = this.currentYearData; return d.length ? Math.round(d.reduce((s, m) => s + m.revenue, 0) / d.length) : 0; }

  // ── Year navigation ────────────────────────────────────────────────────────
  get yearIndex() { return this.availableYears.indexOf(this.selectedYear); }
  get canGoPrev() { return this.yearIndex > 0; }
  get canGoNext() { return this.yearIndex < this.availableYears.length - 1; }

  prevYear()                              { if (this.canGoPrev) { this.selectedYear = this.availableYears[this.yearIndex - 1]; this.buildAreaChart(); } }
  nextYear()                              { if (this.canGoNext) { this.selectedYear = this.availableYears[this.yearIndex + 1]; this.buildAreaChart(); } }
  setChartView(v: 'monthly' | 'annual')  { this.chartView = v; }

  // ── Chart builders ─────────────────────────────────────────────────────────
  buildAreaChart(): void {
    const data   = this.currentYearData;
    const values = data.map(d => d.revenue);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const yMin   = Math.max(0, Math.floor((minVal * 0.85) / 1000) * 1000);
    const yMax   = Math.ceil((maxVal * 1.1) / 1000) * 1000;

    this.areaChartOptions = {
      series:   [{ name: 'Revenus', data: values }],
      chart: { ...CHART_BASE, type: 'bar', height: 260 },      title:    TITLE_OFF,
      subtitle: SUBTITLE_OFF,
      legend:   LEGEND_OFF,
      dataLabels: {
        enabled: true,
        formatter: (val: number) => `${(val / 1000).toFixed(1)}k€`,
        style: { fontSize: '11px', fontWeight: '600', colors: ['#374151'] },
        background: { enabled: false },
        offsetY: -8,
      },
      stroke:  { curve: 'smooth', width: 3, colors: ['#4db8c7'] },
      fill: {
        type: 'gradient',
        gradient: { shadeIntensity: 1, opacityFrom: 0.3, opacityTo: 0.02, stops: [5, 95] },
        colors: ['#4db8c7'],
      },
      xaxis: {
        categories: data.map(d => d.month),
        axisBorder: { show: false },
        axisTicks:  { show: false },
        labels: { style: { colors: '#6b7280', fontSize: '12px' } },
      },
      yaxis: {
        min: yMin,
        max: yMax,
        labels: {
          formatter: (val: number) => `${(val / 1000).toFixed(0)}k€`,
          style: { colors: '#6b7280', fontSize: '12px' },
        },
      },
      grid:    { borderColor: '#f3f4f6', strokeDashArray: 3, xaxis: { lines: { show: false } } },
      tooltip: { y: { formatter: (val: number) => `${val.toLocaleString()} €` }, theme: 'light' },
      colors:  ['#4db8c7'],
    };
  }

  buildBarChart(): void {
    const annual = Object.entries(MOCK_REVENUE_DATA).map(([year, months]) => ({
      year, revenue: months.reduce((s, m) => s + m.revenue, 0),
    }));

    this.barChartOptions = {
      series:   [{ name: 'Revenus', data: annual.map(a => a.revenue) }],
      chart:    { ...CHART_BASE, type: 'bar', height: 288 },
      title:    TITLE_OFF,
      subtitle: SUBTITLE_OFF,
      legend:   LEGEND_OFF,
      dataLabels: {
        enabled: true,
        formatter: (val: number) => `${(val / 1000).toFixed(0)}k€`,
        style: { fontSize: '12px', fontWeight: '700', colors: ['#374151'] },
        background: { enabled: false },
        offsetY: -8,
      },
      plotOptions: { bar: { borderRadius: 6, columnWidth: '55%', dataLabels: { position: 'top' } } },
      xaxis: {
        categories: annual.map(a => a.year),
        axisBorder: { show: false },
        axisTicks:  { show: false },
        labels: { style: { colors: '#6b7280', fontSize: '12px' } },
      },
      yaxis: {
        labels: {
          formatter: (val: number) => `${(val / 1000).toFixed(0)}k€`,
          style: { colors: '#6b7280', fontSize: '12px' },
        },
      },
      grid:    { borderColor: '#f3f4f6', strokeDashArray: 3, xaxis: { lines: { show: false } } },
      tooltip: { y: { formatter: (val: number) => `${val.toLocaleString()} €` }, theme: 'light' },
      colors:  ['#4db8c7'],
    };
  }

  // ── Filters ────────────────────────────────────────────────────────────────
  get filteredSubscriptions(): CoachSubscription[] {
    return this.allSubscriptions.filter(sub => {
      const q = this.searchQuery.toLowerCase();
      return (
        (sub.coachName.toLowerCase().includes(q) || sub.email.toLowerCase().includes(q)) &&
        (this.statusFilter === 'Tous' || sub.status === this.statusFilter) &&
        (this.planFilter   === 'Tous' || sub.plan   === this.planFilter)
      );
    });
  }

  statusClass(status: string): string {
    switch (status) {
      case 'Actif':  return 'badge--success';
      case 'Expiré': return 'badge--danger';
      default:       return 'badge--neutral';
    }
  }
}
