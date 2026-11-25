import { Component, EventEmitter, HostListener, Input, OnChanges, OnDestroy, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { FeatherModule } from 'angular-feather';
import { Observable, Subscription, catchError, forkJoin, map, of } from 'rxjs';
import { ProgramScheduleService } from 'app/service/program-schedule.service';
import { WorkoutService } from 'app/service/workout.service';
import { NutritionService } from 'app/service/nutrition.service';
import { ToastService } from 'app/service/toast.service';
import { OverviewItem, ProgramKind, ProgramOverview, todayIso } from '@shared/models/program-schedule';
import { fileProgramWeek, programFileOpenErrorKey, programFileSaveName } from '@shared/models/program-file-check';
import { ProgramFileViewerComponent } from '@shared/components/program-file-viewer/program-file-viewer.component';

/** A file program of the client, with its kind (a list may show workout and nutrition files together). */
export interface ProgramFileRow { item: OverviewItem; kind: ProgramKind; }

export type ProgramFileActionType = 'import' | 'replace' | 'dates' | 'remove' | 'rename' | 'preview';

export interface ProgramFileAction { type: ProgramFileActionType; row?: ProgramFileRow; kind?: ProgramKind; }

/** The overview of a kind, kept apart: its file programs. */
export function fileRows(overview: ProgramOverview | null | undefined, kind: ProgramKind, finished: OverviewItem[] = []): ProgramFileRow[] {
  if (!overview) return [];
  const items: OverviewItem[] = [
    ...(overview.current ? [overview.current.program] : []),
    ...(overview.next ? [overview.next.program] : []),
    ...(overview.upcoming || []),
    ...(finished.length ? finished : overview.finished || []),
  ];
  const seen = new Set<string>();
  return items.filter(item => item?.file && !seen.has(item.id) && seen.add(item.id)).map(item => ({ item, kind }));
}

/**
 * « Fichiers » (audit PDF/Excel 2026-11-23, lot 3): the client's PDF / Excel programs, apart from the programs built in
 * the app, the same in the calendar and in the client's tabs. Each one: its dates, « Semaine 2 sur 4 » while it runs,
 * the days the client marked done, « Ouvrir » in the shared viewer.
 */
@Component({
  selector: 'app-program-files-list',
  standalone: true,
  imports: [CommonModule, TranslateModule, FeatherModule, ProgramFileViewerComponent],
  templateUrl: './program-files-list.component.html',
  styleUrl: './program-files-list.component.scss',
})
export class ProgramFilesListComponent implements OnChanges, OnDestroy {
  /** The rows to show; without them, the list reads the client's files of {@link kinds} itself. */
  @Input() rows: ProgramFileRow[] | null = null;
  @Input() clientId = '';
  @Input() kinds: ProgramKind[] = ['WORKOUT', 'NUTRITION'];
  /** The coach's actions (replace, dates, remove…) are offered. */
  @Input() writable = false;
  /** The actions the host handles. */
  @Input() actions: ProgramFileActionType[] = [];
  @Output() action = new EventEmitter<ProgramFileAction>();

  loaded: ProgramFileRow[] = [];
  loading = false;
  failed = false;
  menuFor: string | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  viewer: { plan: any; kind: 'workout' | 'nutrition' } | null = null;
  private request?: Subscription;

  constructor(
    private schedule: ProgramScheduleService,
    private workoutService: WorkoutService,
    private nutritionService: NutritionService,
    private toast: ToastService,
    private translate: TranslateService,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (this.rows === null && (changes['clientId'] || changes['kinds'] || changes['rows'])) this.load();
  }

  ngOnDestroy(): void { this.request?.unsubscribe(); }

  reload(): void { if (this.rows === null) this.load(); }

  private load(): void {
    this.request?.unsubscribe();
    if (!this.clientId) { this.loaded = []; return; }
    this.loading = true;
    this.failed = false;
    const reads: Observable<ProgramFileRow[]>[] = this.kinds.map(kind =>
      this.schedule.overview(kind, this.clientId, 0, 50).pipe(map(overview => fileRows(overview, kind))));
    this.request = forkJoin(reads).pipe(catchError(() => { this.failed = true; return of([] as ProgramFileRow[][]); }))
      .subscribe(lists => {
        this.loaded = lists.flat();
        this.loading = false;
      });
  }

  get all(): ProgramFileRow[] { return this.rows ?? this.loaded; }
  get current(): ProgramFileRow[] { return this.sorted(this.all.filter(row => row.item.status === 'CURRENT')); }
  get upcoming(): ProgramFileRow[] { return this.sorted(this.all.filter(row => row.item.status === 'UPCOMING')); }
  get finished(): ProgramFileRow[] {
    return this.sorted(this.all.filter(row => row.item.status === 'FINISHED')).reverse();
  }
  get sections(): { key: string; title: string; rows: ProgramFileRow[] }[] {
    return [
      { key: 'current', title: 'PROGRAM_FILES.SECTION_CURRENT', rows: this.current },
      { key: 'upcoming', title: 'PROGRAM_FILES.SECTION_UPCOMING', rows: this.upcoming },
      { key: 'finished', title: 'PROGRAM_FILES.SECTION_FINISHED', rows: this.finished },
    ].filter(section => section.rows.length);
  }
  get bothKinds(): boolean { return this.kinds.length > 1; }

  private sorted(rows: ProgramFileRow[]): ProgramFileRow[] {
    return [...rows].sort((a, b) => String(a.item.startDate).localeCompare(String(b.item.startDate)));
  }

  /** « Semaine 2 sur 4 » while it runs. */
  week(row: ProgramFileRow): { week: number; weeks: number } | null {
    return row.item.status === 'CURRENT' ? fileProgramWeek(row.item, todayIso()) : null;
  }

  /** Days of the program up to today (all of them once finished): the base of « X jours faits sur Y ». */
  daysSoFar(row: ProgramFileRow): number {
    const start = String(row.item.startDate || '').slice(0, 10);
    const end = String(row.item.stoppedAt || row.item.endDate || '').slice(0, 10);
    if (!start) return 0;
    const last = row.item.status === 'FINISHED' || (end && end < todayIso()) ? end || start : todayIso();
    const days = Math.round((Date.parse(`${last}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000) + 1;
    return Math.max(0, row.item.status === 'UPCOMING' ? 0 : days);
  }

  progress(row: ProgramFileRow): number {
    const days = this.daysSoFar(row);
    return days ? Math.min(100, Math.round((row.item.doneDays / days) * 100)) : 0;
  }

  dates(row: ProgramFileRow): string {
    const lang = (this.translate.currentLang || 'fr').startsWith('fr') ? 'fr-FR' : 'en-US';
    const format = (value: string | null) => value
      ? new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString(lang, { day: 'numeric', month: 'short' }) : '';
    const end = row.item.stoppedAt || row.item.endDate;
    return end ? `${format(row.item.startDate)} → ${format(end)}` : format(row.item.startDate);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private plan(row: ProgramFileRow): any {
    return { id: row.item.id, name: row.item.name, resourceType: row.item.fileKind === 'EXCEL' ? 'EXCEL' : 'PDF' };
  }

  open(row: ProgramFileRow): void {
    this.menuFor = null;
    this.viewer = { plan: this.plan(row), kind: row.kind === 'WORKOUT' ? 'workout' : 'nutrition' };
  }

  download(row: ProgramFileRow): void {
    this.menuFor = null;
    const plan = this.plan(row);
    const blob$ = row.kind === 'WORKOUT' ? this.workoutService.getWorkoutFileBlob(plan) : this.nutritionService.downloadNutritionFile(plan);
    blob$.subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = programFileSaveName({ ...plan, originalFileName: '' }, plan.resourceType === 'EXCEL' ? 'EXCEL' : 'PDF');
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      },
      error: error => this.toast.error(this.translate.instant(programFileOpenErrorKey(error))),
    });
  }

  can(type: ProgramFileActionType): boolean { return this.actions.includes(type); }

  /** What a finished or stopped file still allows: open, download, preview (no replace, no dates). */
  locked(row: ProgramFileRow): boolean { return row.item.status === 'FINISHED' || !!row.item.stoppedAt; }

  emit(type: ProgramFileActionType, row?: ProgramFileRow, kind?: ProgramKind): void {
    this.menuFor = null;
    this.action.emit({ type, row, kind: kind ?? row?.kind });
  }

  toggleMenu(row: ProgramFileRow, event: MouseEvent): void {
    event.stopPropagation();
    this.menuFor = this.menuFor === row.item.id ? null : row.item.id;
  }

  @HostListener('document:click')
  closeMenu(): void { this.menuFor = null; }

  trackRow(_: number, row: ProgramFileRow): string { return `${row.kind}:${row.item.id}`; }
}
