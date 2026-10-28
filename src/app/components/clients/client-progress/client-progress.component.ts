import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { FeatherModule } from 'angular-feather';
import { TranslateService } from '@ngx-translate/core';
import { Observable, Subscription, catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { ProgressPicture, ProgressPicturesService } from 'app/service/progress-pictures.service';
import { DocumentService } from 'app/service/document.service';
import { ClientThemeService } from 'app/core/service/client-theme.service';
import { dateKey, planDate } from '../shared/client-plan-utils';

type Pose = 'FRONT' | 'SIDE' | 'BACK';
const POSES: Pose[] = ['FRONT', 'SIDE', 'BACK'];
const FOLDER = 'client-progress-pictures';

/** A picture with the path stored in the database (the displayed URL is a fresh signed link). */
interface Picture extends ProgressPicture { storedPath: string; }
interface MonthGroup { key: string; label: string; pictures: Picture[]; }

/**
 * Client progress pictures, same content and logic as the mobile ProgressPicturesScreen: pictures grouped by
 * month with the weight change since the start, "Compare" (pick 2, side by side), the picture detail with edit /
 * delete for the client's own pictures, and the add sheet (one photo per requested pose, weight, note, date).
 */
@Component({
  selector: 'app-client-progress',
  standalone: true,
  imports: [CommonModule, FormsModule, FeatherModule],
  templateUrl: './client-progress.component.html',
  styleUrl: './client-progress.component.scss',
})
export class ClientProgressComponent implements OnInit, OnDestroy {
  pictures: Picture[] = [];
  loading = true;
  error = '';
  collapsed = new Set<string>();
  brokenImages = new Set<string>();
  selecting = false;
  selected: string[] = [];
  detail: Picture | null = null;
  compare: [Picture, Picture] | null = null;
  confirmDelete: Picture | null = null;
  toast = '';

  // Add / edit sheet
  sheetOpen = false;
  editing: Picture | null = null;
  sheetPoses: Pose[] = POSES;
  fromCoachRequest = false;
  activePose: Pose = 'FRONT';
  files: Partial<Record<Pose, File>> = {};
  previews: Partial<Record<Pose, string>> = {};
  fileErrors: Partial<Record<Pose, boolean>> = {};
  weight = '';
  note = '';
  date = dateKey(new Date());
  lockDate = false;
  saving = false;

  private clientId = sessionStorage.getItem('userId') || '';
  private requestedPoses: Pose[] = [];
  private taskDate: string | null = null;
  private subscriptions = new Subscription();
  private toastTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private api: ProgressPicturesService,
    private documents: DocumentService,
    private translate: TranslateService,
    private route: ActivatedRoute,
    private theme: ClientThemeService,
  ) {}

  get fr(): boolean { return this.translate.currentLang?.startsWith('fr') ?? false; }
  private get locale(): string { return this.fr ? 'fr-FR' : 'en-US'; }
  t(en: string, fr: string): string { return this.fr ? fr : en; }

  ngOnInit(): void {
    this.theme.ensureLoaded();
    const params = this.route.snapshot.queryParamMap;
    this.requestedPoses = (params.get('poses') || '').split(',').map(p => p.trim().toUpperCase())
      .filter((p): p is Pose => (POSES as string[]).includes(p));
    this.taskDate = params.get('taskDate');
    this.load(!!this.taskDate);
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    Object.values(this.previews).forEach(url => url && URL.revokeObjectURL(url));
    if (this.toastTimer) clearTimeout(this.toastTimer);
  }

  load(openAddFlow = false): void {
    if (!this.clientId) { this.loading = false; this.error = this.t('Something went wrong', 'Une erreur est survenue'); return; }
    this.loading = !this.pictures.length;
    this.error = '';
    // The pictures and the fresh links of their folder are read at the same time.
    this.subscriptions.add(forkJoin({
      pictures: this.api.getProgressPicturesByClient(this.clientId, true),
      fresh: this.documents.getFilesInFolder(`${FOLDER}/${this.clientId}`, true).pipe(catchError(() => of([] as string[]))),
    }).subscribe({
      next: ({ pictures, fresh }) => {
        this.pictures = (pictures || []).map(picture => {
          const name = this.fileName(picture.imageUrl);
          const url = (fresh || []).find(item => !!name && this.fileName(item) === name);
          return { ...picture, storedPath: picture.imageUrl, imageUrl: url || picture.imageUrl };
        });
        this.loading = false;
        if (openAddFlow) this.openAdd();
      },
      error: err => { this.loading = false; this.error = err?.error?.message || this.t('Something went wrong', 'Une erreur est survenue'); },
    }));
  }

  private fileName(value: string | null | undefined): string {
    const name = String(value || '').split('?')[0].split('/').pop() || '';
    try { return decodeURIComponent(name).toLowerCase(); } catch { return name.toLowerCase(); }
  }

  // -------------------------------------------------------------------------
  // List
  // -------------------------------------------------------------------------
  private dateOf(picture: ProgressPicture): Date { return planDate(picture.date) || new Date(0); }
  /** Newest first. */
  get sorted(): Picture[] { return [...this.pictures].sort((a, b) => this.dateOf(b).getTime() - this.dateOf(a).getTime()); }

  get subtitle(): string {
    if (this.loading) return this.t('Dated with weight', 'Datées avec le poids');
    const n = this.pictures.length;
    return this.fr ? `${n} photo${n === 1 ? '' : 's'} · datées avec le poids` : `${n} photo${n === 1 ? '' : 's'} · dated with weight`;
  }

  get groups(): MonthGroup[] {
    const groups = new Map<string, Picture[]>();
    for (const picture of this.sorted) {
      const d = this.dateOf(picture);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      groups.set(key, [...(groups.get(key) || []), picture]);
    }
    return Array.from(groups, ([key, pictures]) => {
      const label = new Intl.DateTimeFormat(this.locale, { month: 'long', year: 'numeric' }).format(this.dateOf(pictures[0]));
      return { key, label: label[0].toUpperCase() + label.slice(1), pictures };
    });
  }

  toggleMonth(key: string): void { this.collapsed.has(key) ? this.collapsed.delete(key) : this.collapsed.add(key); }
  countLabel(n: number): string { return this.fr ? `${n} photo${n === 1 ? '' : 's'}` : `${n} picture${n === 1 ? '' : 's'}`; }

  poseLabel(pose: string | undefined | null): string {
    switch (pose) {
      case 'FRONT': return this.t('Front', 'Face');
      case 'SIDE': return this.t('Side', 'Profil');
      case 'BACK': return this.t('Back', 'Dos');
      default: return pose || '';
    }
  }

  weightLabel(picture: ProgressPicture): string {
    return `${new Intl.NumberFormat(this.locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(Number(picture.weight) || 0)} kg`;
  }
  dayMonth(picture: ProgressPicture): string { return new Intl.DateTimeFormat(this.locale, { day: 'numeric', month: 'short' }).format(this.dateOf(picture)); }
  fullDate(picture: ProgressPicture): string { return new Intl.DateTimeFormat(this.locale, { year: 'numeric', month: 'short', day: 'numeric' }).format(this.dateOf(picture)); }

  /** Weight change since the oldest picture (the starting point). */
  change(picture: ProgressPicture): number | null {
    const sorted = this.sorted;
    if (!sorted.length) return null;
    const start = sorted[sorted.length - 1];
    if (this.dateOf(picture).getTime() <= this.dateOf(start).getTime()) return null;
    return (Number(picture.weight) || 0) - (Number(start.weight) || 0);
  }

  changeLabel(picture: ProgressPicture): string {
    const change = this.change(picture);
    if (change == null) return this.t('Starting point', 'Point de départ');
    const arrow = change < 0 ? '↓' : change > 0 ? '↑' : '→';
    const value = new Intl.NumberFormat(this.locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(Math.abs(change));
    return `${arrow} ${value} kg ${this.t('since start', 'depuis le début')}`;
  }

  canEdit(picture: ProgressPicture): boolean { return !!picture.createdBy && picture.createdBy === this.clientId; }

  // Compare (pick 2, side by side)
  toggleSelecting(): void {
    if (this.pictures.length < 2) return;
    this.selecting = !this.selecting;
    this.selected = [];
  }

  tap(picture: Picture): void {
    if (!this.selecting) { this.detail = picture; return; }
    const index = this.selected.indexOf(picture.id);
    if (index >= 0) this.selected.splice(index, 1);
    else if (this.selected.length < 2) this.selected.push(picture.id);
  }

  isSelected(picture: Picture): boolean { return this.selected.includes(picture.id); }

  openCompare(): void {
    const pair = this.pictures.filter(picture => this.selected.includes(picture.id))
      .sort((a, b) => this.dateOf(a).getTime() - this.dateOf(b).getTime());
    if (pair.length === 2) this.compare = [pair[0], pair[1]];
  }

  get compareSubtitle(): string {
    if (!this.compare) return '';
    const format = (p: Picture) => new Intl.DateTimeFormat(this.locale, { month: 'short', day: 'numeric' }).format(this.dateOf(p));
    return `${format(this.compare[0])} → ${format(this.compare[1])}`;
  }
  get compareDiff(): number { return this.compare ? (Number(this.compare[1].weight) || 0) - (Number(this.compare[0].weight) || 0) : 0; }
  get compareSummary(): string {
    const diff = this.compareDiff;
    const text = new Intl.NumberFormat(this.locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(Math.abs(diff));
    if (diff === 0) return this.t('0 kg between these pictures', '0 kg entre ces photos');
    if (diff < 0) return this.t(`${text} kg lost between these pictures`, `−${text} kg entre ces photos`);
    return this.t(`${text} kg gained between these pictures`, `+${text} kg entre ces photos`);
  }

  get detailSubtitle(): string {
    const picture = this.detail;
    return picture ? [picture.pose ? this.poseLabel(picture.pose) : '', this.weightLabel(picture)].filter(Boolean).join(' · ') : '';
  }

  askDelete(picture: Picture): void { this.detail = null; this.confirmDelete = picture; }

  deletePicture(): void {
    const picture = this.confirmDelete;
    this.confirmDelete = null;
    if (!picture) return;
    this.subscriptions.add(this.api.deleteProgressPicture(picture.id).subscribe({
      next: () => { this.pictures = this.pictures.filter(item => item.id !== picture.id); },
      error: err => this.showToast(err?.error?.message || this.t('Something went wrong', 'Une erreur est survenue')),
    }));
  }

  // -------------------------------------------------------------------------
  // Add / edit sheet (mobile _ProgressPictureSheet)
  // -------------------------------------------------------------------------
  openAdd(): void {
    this.resetSheet();
    this.fromCoachRequest = this.requestedPoses.length > 0;
    this.sheetPoses = this.fromCoachRequest ? this.requestedPoses : POSES;
    this.activePose = this.sheetPoses[0];
    const latest = this.sorted[0];
    const weight = Number(latest?.weight);
    this.weight = weight > 0 ? (Number.isInteger(weight) ? String(weight) : weight.toFixed(1)) : '';
    this.lockDate = !!this.taskDate;
    this.date = this.taskDate && /^\d{4}-\d{2}-\d{2}$/.test(this.taskDate) ? this.taskDate : dateKey(new Date());
    this.sheetOpen = true;
  }

  openEdit(picture: Picture): void {
    this.detail = null;
    this.resetSheet();
    this.editing = picture;
    this.sheetPoses = POSES;
    this.activePose = (POSES as string[]).includes(picture.pose || '') ? picture.pose as Pose : 'FRONT';
    const weight = Number(picture.weight);
    this.weight = weight > 0 ? (Number.isInteger(weight) ? String(weight) : weight.toFixed(1)) : '';
    this.note = picture.note || '';
    this.date = dateKey(this.dateOf(picture));
    this.sheetOpen = true;
  }

  private resetSheet(): void {
    Object.values(this.previews).forEach(url => url && URL.revokeObjectURL(url));
    this.editing = null; this.files = {}; this.previews = {}; this.fileErrors = {};
    this.note = ''; this.fromCoachRequest = false; this.lockDate = false; this.saving = false;
  }

  closeSheet(): void { if (!this.saving) this.sheetOpen = false; }

  selectPose(pose: Pose): void {
    if (this.editing && Object.keys(this.files).length) {
      // A replaced photo follows the pose chosen for the picture.
      const file = Object.values(this.files)[0]!; const preview = Object.values(this.previews)[0]!;
      this.files = { [pose]: file }; this.previews = { [pose]: preview };
    }
    this.activePose = pose;
  }

  poseTab(pose: Pose): string { return !this.editing && this.files[pose] ? `${this.poseLabel(pose)} ✓` : this.poseLabel(pose); }

  onFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const name = file.name.toLowerCase();
    const valid = /\.(jpe?g|png)$/.test(name) && file.size <= 10 * 1024 * 1024;
    if (this.editing) { Object.values(this.previews).forEach(url => url && URL.revokeObjectURL(url)); this.files = {}; this.previews = {}; }
    this.fileErrors[this.activePose] = !valid;
    if (this.previews[this.activePose]) URL.revokeObjectURL(this.previews[this.activePose]!);
    if (valid) { this.files[this.activePose] = file; this.previews[this.activePose] = URL.createObjectURL(file); }
    else { delete this.files[this.activePose]; delete this.previews[this.activePose]; }
  }

  get activePreview(): string | null {
    return this.previews[this.activePose] || (this.editing && !Object.keys(this.files).length ? this.editing.imageUrl : null);
  }

  private get weightValue(): number | null {
    const value = parseFloat(this.weight.replace(',', '.'));
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  get canSave(): boolean {
    const complete = this.editing ? true : this.sheetPoses.every(pose => !!this.files[pose]);
    return complete && this.weightValue != null && !this.saving;
  }

  get today(): string { return dateKey(new Date()); }
  get dateLabel(): string {
    const date = planDate(this.date) || new Date();
    return new Intl.DateTimeFormat(this.locale, { year: 'numeric', month: 'long', day: 'numeric' }).format(date);
  }

  private upload(file: File, name: string): Observable<string> {
    const folder = `${FOLDER}/${this.clientId}`;
    const ext = file.name.includes('.') ? `.${file.name.split('.').pop()}` : '';
    const named = new File([file], `${name}${ext}`, { type: file.type, lastModified: file.lastModified });
    return this.documents.uploadFileInPath(named, folder).pipe(map(() => `${folder}/${named.name}`));
  }

  save(): void {
    const weight = this.weightValue;
    if (!this.canSave || weight == null) return;
    this.saving = true;
    const note = this.note.trim();
    if (this.editing) {
      const picture = this.editing;
      const file = Object.values(this.files)[0];
      const pose = (Object.keys(this.files)[0] as Pose) || this.activePose;
      const path$ = file ? this.upload(file, `${picture.groupId || 'progress-' + Date.now()}-${pose.toLowerCase()}-${Date.now()}`) : of(picture.storedPath);
      this.subscriptions.add(path$.pipe(switchMap(path => this.api.updateProgressPicture(picture.id, {
        clientId: this.clientId, imageUrl: path, groupId: picture.groupId, weight, date: this.date, pose, note,
      }))).subscribe({
        next: () => { this.saving = false; this.sheetOpen = false; this.showToast(this.t('Photo updated', 'Photo mise à jour')); this.load(); },
        error: err => { this.saving = false; this.showToast(err?.error?.message || this.t('Something went wrong', 'Une erreur est survenue')); },
      }));
      return;
    }
    const groupId = `progress-${Date.now()}`;
    const poses = this.sheetPoses.filter(pose => !!this.files[pose]);
    this.subscriptions.add(forkJoin(poses.map(pose => this.upload(this.files[pose]!, `${groupId}-${pose.toLowerCase()}`).pipe(map(path => ({ pose, path })))))
      .pipe(switchMap(items => forkJoin(items.map(item => this.api.createProgressPicture({
        clientId: this.clientId, imageUrl: item.path, groupId, weight, date: this.date, pose: item.pose, note,
      })))))
      .subscribe({
        next: () => { this.saving = false; this.sheetOpen = false; this.load(); },
        error: err => { this.saving = false; this.showToast(err?.error?.message || this.t('Something went wrong', 'Une erreur est survenue')); },
      }));
  }

  private showToast(message: string): void {
    this.toast = message;
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => (this.toast = ''), 3500);
  }

  trackById = (_: number, picture: Picture) => picture.id;
}
