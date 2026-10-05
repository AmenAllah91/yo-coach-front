import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FeatherModule } from 'angular-feather';
import { TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { AuthService } from '@config/auth.service';
import { ChatService } from 'app/service/chat.service';
import { ClientTasksService, TaskCalendarItem } from 'app/service/client-tasks.service';

interface TaskDay { date: string; label: string; items: TaskCalendarItem[]; }

@Component({
  selector: 'app-my-tasks', standalone: true,
  imports: [CommonModule, FeatherModule],
  templateUrl: './my-tasks.component.html', styleUrl: './my-tasks.component.scss',
})
export class MyTasksComponent implements OnInit, OnDestroy {
  items: TaskCalendarItem[] = [];
  month = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  upcoming = true;
  selected: TaskCalendarItem | null = null;
  coachName = '';
  loading = false;
  error = '';
  private clientId = '';
  private pendingItemId = '';
  private pendingDate = '';
  private pendingType = '';
  private destroyed = false;
  private subscriptions = new Subscription();
  private request?: Subscription;

  constructor(private api: ClientTasksService, private auth: AuthService,
              private route: ActivatedRoute, private router: Router,
              private translate: TranslateService, private chat: ChatService, private location: Location) {}

  get fr(): boolean { return this.translate.currentLang?.startsWith('fr') ?? false; }
  get displayCoachName(): string { return this.coachName || (this.fr ? 'votre coach' : 'your coach'); }
  get coachInitials(): string { return this.displayCoachName.split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join('').toUpperCase(); }
  get monthLabel(): string { return new Intl.DateTimeFormat(this.fr ? 'fr-FR' : 'en-US', { month: 'long', year: 'numeric' }).format(this.month); }
  get days(): TaskDay[] {
    const today = this.dateKey(new Date());
    const visible = this.items.filter(item => this.upcoming ? item.date >= today : item.date < today)
      .sort((a, b) => this.upcoming ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date));
    const groups = new Map<string, TaskCalendarItem[]>();
    for (const item of visible) {
      const values = groups.get(item.date) || []; values.push(item); groups.set(item.date, values);
    }
    return Array.from(groups, ([date, items]) => ({ date, label: this.dayLabel(date), items }));
  }

  async ngOnInit(): Promise<void> {
    this.clientId = await this.auth.getId() || '';
    if (this.destroyed) return;
    if (!this.clientId) { this.error = this.fr ? 'Client introuvable.' : 'Client not found.'; return; }
    this.subscriptions.add(this.chat.getConversations(0, 10).subscribe({
      next: page => { this.coachName = page.content[0]?.name?.trim() || ''; }, error: () => {},
    }));
    this.subscriptions.add(this.route.queryParamMap.subscribe(params => {
      const date = params.get('date');
      if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
        const parsed = new Date(date + 'T12:00:00');
        if (!Number.isNaN(parsed.getTime())) {
          this.month = new Date(parsed.getFullYear(), parsed.getMonth(), 1);
          this.upcoming = date >= this.dateKey(new Date());
        }
      }
      this.pendingItemId = params.get('itemId') || '';
      this.pendingDate = date || '';
      this.pendingType = params.get('itemType') || '';
      this.selected = null;
      this.load();
    }));
  }
  ngOnDestroy(): void { this.destroyed = true; this.subscriptions.unsubscribe(); this.request?.unsubscribe(); }
  load(): void {
    this.request?.unsubscribe(); this.loading = true; this.error = '';
    const last = new Date(this.month.getFullYear(), this.month.getMonth() + 1, 0);
    this.request = this.api.calendar(this.clientId, this.dateKey(this.month), this.dateKey(last)).subscribe({
      next: response => {
        this.items = response.items; this.loading = false;
        const target = this.pendingItemId ? this.items.find(item => item.id === this.pendingItemId
          && (!this.pendingDate || item.date === this.pendingDate)
          && (!this.pendingType || item.itemType === this.pendingType)) : null;
        this.pendingItemId = '';
        if (target) this.open(target);
      },
      error: () => { this.loading = false; this.error = this.fr ? 'Impossible de charger les tâches.' : 'Unable to load tasks.'; },
    });
  }
  shiftMonth(delta: number): void {
    if (!this.canShiftMonth(delta)) return;
    this.month = new Date(this.month.getFullYear(), this.month.getMonth() + delta, 1);
    this.selected = null; this.pendingItemId = ''; this.load();
  }
  canShiftMonth(delta: number): boolean {
    const now = new Date();
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const target = new Date(this.month.getFullYear(), this.month.getMonth() + delta, 1);
    return this.upcoming ? target >= currentMonth : target <= currentMonth;
  }
  setTab(upcoming: boolean): void {
    this.upcoming = upcoming;
    if (!this.canShiftMonth(0)) {
      const now = new Date();
      this.month = new Date(now.getFullYear(), now.getMonth(), 1);
      this.selected = null; this.pendingItemId = ''; this.load();
    }
  }
  typeLabel(item: TaskCalendarItem): string {
    if (item.itemType === 'HABIT') return this.fr ? 'Habitude' : 'Habit';
    switch (item.taskType) {
      case 'FORM': return this.fr ? 'Formulaire' : 'Form';
      case 'CLIENT_PROGRESS': return this.fr ? 'Photos de progression' : 'Progress pictures';
      case 'BODY_METRICS': return this.fr ? 'Mensurations' : 'Body metrics';
      default: return this.fr ? 'Tâche générale' : 'General task';
    }
  }
  subtitle(item: TaskCalendarItem): string {
    let detail = '';
    if (item.itemType === 'HABIT') {
      const units: Record<string, string> = { TIMES: 'times', MINUTES: 'min', HOURS: 'h', LITERS: 'L', SERVINGS: 'servings', STEPS: 'steps' };
      detail = `${item.goalValue ?? ''} ${item.unit === 'CUSTOM' ? item.customUnit || '' : units[item.unit || ''] || ''}`.trim();
    } else if (item.taskType === 'CLIENT_PROGRESS') {
      detail = (item.requestedPoses || []).map(value => this.titleCase(value)).join(', ');
    } else if (item.taskType === 'BODY_METRICS') {
      detail = (item.requestedMeasurements || []).map(value => this.titleCase(value)).join(', ');
    } else detail = item.instructions?.trim() || '';
    return [this.typeLabel(item), detail].filter(Boolean).join(' · ');
  }
  icon(item: TaskCalendarItem): string {
    if (item.itemType === 'HABIT') return 'repeat';
    return item.taskType === 'FORM' ? 'clipboard' : item.taskType === 'CLIENT_PROGRESS' ? 'camera'
      : item.taskType === 'BODY_METRICS' ? 'maximize-2' : 'check-square';
  }
  tone(item: TaskCalendarItem): string {
    if (item.itemType === 'HABIT') return 'habit';
    return item.taskType === 'FORM' ? 'form' : item.taskType === 'CLIENT_PROGRESS' ? 'progress'
      : item.taskType === 'BODY_METRICS' ? 'metrics' : 'general';
  }
  open(item: TaskCalendarItem): void {
    if (item.taskType === 'FORM' && item.formAssignmentId) {
      this.router.navigate(['/assignments', item.formAssignmentId, 'fill']); return;
    }
    if (item.taskType === 'CLIENT_PROGRESS') { this.router.navigate(['/progress-pictures']); return; }
    if (item.taskType === 'BODY_METRICS') { this.router.navigate(['/body-measurements']); return; }
    this.selected = item;
  }
  goBack(): void { this.location.back(); }
  closeDetail(): void { this.selected = null; this.error = ''; }
  dueLabel(item: TaskCalendarItem): string {
    return item.date === this.dateKey(new Date()) ? (this.fr ? "Aujourd’hui" : 'Due today')
      : new Intl.DateTimeFormat(this.fr ? 'fr-FR' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(item.date + 'T12:00:00'));
  }
  private dayLabel(key: string): string {
    const date = new Date(key + 'T12:00:00'); const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    const prefix = key === this.dateKey(new Date()) ? (this.fr ? "Aujourd’hui" : 'Today')
      : key === this.dateKey(yesterday) ? (this.fr ? 'Hier' : 'Yesterday')
      : new Intl.DateTimeFormat(this.fr ? 'fr-FR' : 'en-US', { weekday: 'short' }).format(date);
    return prefix + ' · ' + new Intl.DateTimeFormat(this.fr ? 'fr-FR' : 'en-US', { month: 'short', day: 'numeric' }).format(date);
  }
  private titleCase(value: string): string { const text = value.replace(/_/g, ' ').toLowerCase(); return text[0]?.toUpperCase() + text.slice(1); }
  private dateKey(date: Date): string { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
}
