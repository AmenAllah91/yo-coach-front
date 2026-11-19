import { CommonModule, Location, registerLocaleData } from '@angular/common';
import { Component, EventEmitter, HostListener, Input, OnInit, Output } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { finalize, map, switchMap } from 'rxjs/operators';
import { forkJoin } from 'rxjs';
import { cachedClientPictures, hasClientPicturesSnapshot, loadClientPictures, PROGRESS_PICTURES_DIRECTORY } from './client-pictures-loader';
import { DocumentService } from 'app/service/document.service';
import {
  ProgressPicture,
  ProgressPicturesService,
  SaveProgressPictureRequest
} from 'app/service/progress-pictures.service';
import {
  AddProgressPictureModalComponent,
  AddProgressPicturePayload,
  ProgressPictureRequest
} from '../add-progress-picture-modal/add-progress-picture-modal.component';
import localeFr from '@angular/common/locales/fr';
registerLocaleData(localeFr);

import { CoachSettingsService } from 'app/service/coach-settings.service';
import { SectionLoaderComponent } from '@shared/components/section-loader/section-loader.component';

type ComparisonPose = 'FRONT' | 'SIDE' | 'BACK';

@Component({
  selector: 'app-progress-pictures',
  standalone: true,
  imports: [CommonModule, TranslateModule, AddProgressPictureModalComponent, SectionLoaderComponent],
  templateUrl: './progress-pictures.component.html',
  styleUrls: ['./progress-pictures.component.scss']
})
export class ProgressPicturesComponent implements OnInit {
  @Input() clientId = '';
  @Input() allowAddPicture = true;
  /**
   * Profile overview « Compare »: only the comparison window is shown (no gallery), open at once.
   * Closing it emits `comparisonClosed`; « See all pictures » emits `openAll`.
   */
  @Input() compareOnly = false;
  @Output() pictureAdded = new EventEmitter<ProgressPicture>();
  @Output() comparisonClosed = new EventEmitter<void>();
  @Output() openAll = new EventEmitter<void>();

  private readonly progressPicturesDirectory = PROGRESS_PICTURES_DIRECTORY;

  pictures: ProgressPicture[] = [];
  loading = false;
  saving = false;
  error: string | null = null;

  showAddModal = false;
  /** Set when the add flow is opened from a "Client progress" task (requested poses + task date). */
  addRequest: ProgressPictureRequest | null = null;
  showPicturesComparison = false;
  comparisonMode: 'single' | 'comparison' = 'comparison';
  comparisonPose: ComparisonPose = 'FRONT';
  readonly comparisonPoses: ComparisonPose[] = ['FRONT', 'SIDE', 'BACK'];
  /** Comparison: the slot the next picture tapped in the list goes into. */
  activeSlot: 'before' | 'after' = 'before';

  selectedSinglePicture: ProgressPicture | null = null;
  selectedAfterPicture: ProgressPicture | null = null;
  selectedBeforePicture: ProgressPicture | null = null;
  comparisonSelectionError: string | null = null;
  standaloneView = false;

  constructor(
    private progressPicturesService: ProgressPicturesService,
    private documentService: DocumentService,
    private coachSettingsService: CoachSettingsService,
    private translateService: TranslateService,
    private location: Location
  ) {}

  ngOnInit(): void {
    this.standaloneView = !this.clientId;
    if (!this.clientId) {
      this.clientId = sessionStorage.getItem('userId') || '';
    }

    if (!this.clientId) {
      this.error = 'CLIENT_ID_MISSING';
      console.error('ProgressPicturesComponent: clientId is missing');
      return;
    }

    this.loadPictures();
    if (this.compareOnly) this.openComparison();
  }

  goBack(): void {
    this.location.back();
  }

  loadPictures(): void {
    if (!this.clientId) return;

    const clientId = this.clientId;
    const known = cachedClientPictures(clientId);
    if (known) this.pictures = known;
    this.loading = !hasClientPicturesSnapshot(clientId);
    this.error = null;

    loadClientPictures(this.progressPicturesService, this.documentService, clientId)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (pictures) => {
          if (clientId !== this.clientId) return;
          this.pictures = pictures;
          // Opened before the pictures arrived: the before/after pair is chosen now.
          if (this.showPicturesComparison && !this.selectedBeforePicture && !this.selectedSinglePicture) {
            if (this.comparisonMode === 'comparison') this.comparisonPose = this.firstPoseWithPictures();
            this.preselectPictures();
          }
        },
        error: (err) => {
          console.error('loadPictures failed:', err);
          this.error = 'LOAD_PROGRESS_PICTURES_ERROR';
        }
      });
  }

  openAddModal(request?: ProgressPictureRequest): void {
    if (!this.allowAddPicture) return;
    this.error = null;
    this.addRequest = request || null;
    this.showAddModal = true;
  }

  closeAddModal(): void {
    if (this.saving) return;
    this.showAddModal = false;
  }

  onSavePicture(payload: AddProgressPicturePayload): void {
    if (!this.clientId || this.saving) { if (!this.clientId) this.error='CLIENT_ID_MISSING'; return; }
    this.saving=true; this.error=null;
    const folderPath=`${this.progressPicturesDirectory}/${this.clientId}`;
    const groupId=`progress-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    const poses=(['FRONT','SIDE','BACK'] as const).filter(pose=>!!payload.files[pose]);
    const uploads=poses.map(pose=>{const file=payload.files[pose]!; const ext=file.name.includes('.')?`.${file.name.split('.').pop()}`:''; const named=new File([file],`${groupId}-${pose.toLowerCase()}${ext}`,{type:file.type,lastModified:file.lastModified}); return this.documentService.uploadFileInPath(named,folderPath).pipe(map(()=>({pose,imageUrl:`${folderPath}/${named.name}`})));});
    forkJoin(uploads).pipe(switchMap(items=>forkJoin(items.map(item=>this.progressPicturesService.createProgressPicture({clientId:this.clientId,imageUrl:item.imageUrl,groupId,weight:this.coachSettingsService.convertWeightToKg(payload.weight)??payload.weight,date:payload.date,pose:item.pose,note:payload.note})))),finalize(()=>this.saving=false)).subscribe({next:created=>{this.showAddModal=false;created.forEach(x=>this.pictureAdded.emit(x));this.loadPictures();},error:err=>{console.error(err);this.error=err?.error?.message||err?.message||'SAVE_PROGRESS_PICTURE_ERROR';}});
  }

  openComparison(): void {
    this.showPicturesComparison = true;
    this.comparisonMode = 'comparison';
    this.comparisonPose = this.firstPoseWithPictures();
    this.preselectPictures();
  }

  /** A picture of the gallery opens alone, on its own pose (a Side picture shows the Side list). */
  openPicture(picture: ProgressPicture): void {
    this.showPicturesComparison = true;
    this.comparisonPose = this.poseOf(picture);
    this.preselectPictures();
    this.comparisonMode = 'single';
    this.selectedSinglePicture = picture;
  }

  closeComparison(): void {
    this.showPicturesComparison = false;
    this.comparisonClosed.emit();
  }

  @HostListener('document:keydown', ['$event'])
  onComparisonKeydown(event: KeyboardEvent): void {
    if (!this.showPicturesComparison) return;
    if (event.key === 'Escape') {
      this.closeComparison();
      return;
    }
    if (this.comparisonMode !== 'single') return;
    if (event.key === 'ArrowLeft') this.stepSinglePicture(-1);
    if (event.key === 'ArrowRight') this.stepSinglePicture(1);
  }

  /**
   * The comparison opens ready to read: the oldest picture of the pose in « Avant », the newest in « Après »
   * (« Avant » 18 sept., « Après » 22 oct.). The coach can still pick other pictures.
   */
  private preselectPictures(): void {
    const pose = this.filteredComparisonPictures;
    const newest = pose[0] || null;
    const oldest = pose[pose.length - 1] || null;
    const differentDays = !!newest && !!oldest && this.dayOf(newest) !== this.dayOf(oldest);
    this.selectedBeforePicture = differentDays ? oldest : newest;
    this.selectedAfterPicture = differentDays ? newest : null;
    this.activeSlot = this.selectedBeforePicture ? 'after' : 'before';
    this.selectedSinglePicture = newest;
    this.comparisonSelectionError = null;
  }

  changeComparisonMode(mode: 'single' | 'comparison'): void {
    if (this.comparisonMode === mode) return;
    this.comparisonMode = mode;
    this.comparisonSelectionError = null;

    if (mode === 'single') {
      this.selectedSinglePicture =
        this.selectedAfterPicture ||
        this.selectedBeforePicture ||
        this.filteredComparisonPictures[0] ||
        null;
    }
  }

  changeComparisonPose(pose: ComparisonPose): void {
    if (this.comparisonPose === pose) return;
    this.comparisonPose = pose;
    this.preselectPictures();
  }

  get filteredComparisonPictures(): ProgressPicture[] {
    return this.sortedPictures.filter(p => this.poseOf(p) === this.comparisonPose);
  }

  poseCount(pose: ComparisonPose): number {
    return this.pictures.filter(p => this.poseOf(p) === pose).length;
  }

  /** Where the next picture tapped in the list goes. */
  setActiveSlot(slot: 'before' | 'after'): void {
    this.activeSlot = slot;
    this.comparisonSelectionError = null;
  }

  clearSlot(slot: 'before' | 'after', event?: Event): void {
    event?.stopPropagation();
    if (slot === 'before') this.selectedBeforePicture = null;
    else this.selectedAfterPicture = null;
    this.activeSlot = slot;
    this.comparisonSelectionError = null;
  }

  /**
   * Comparison: the picture goes into the active slot (« Avant » first, then « Après »).
   * Tapping a picture already chosen takes it out. Dates in the wrong order are swapped,
   * two pictures of the same day are refused (nothing to compare).
   */
  selectComparisonPicture(picture: ProgressPicture): void {
    if (this.comparisonMode === 'single') {
      this.selectedSinglePicture = picture;
      this.comparisonSelectionError = null;
      return;
    }

    if (this.isSelectedAsBefore(picture)) {
      this.clearSlot('before');
      return;
    }
    if (this.isSelectedAsAfter(picture)) {
      this.clearSlot('after');
      return;
    }

    const other = this.activeSlot === 'before' ? this.selectedAfterPicture : this.selectedBeforePicture;
    if (other && this.dayOf(other) === this.dayOf(picture)) {
      this.comparisonSelectionError = 'PROGRESS_COMPARE_SAME_DAY';
      return;
    }

    if (this.activeSlot === 'before') this.selectedBeforePicture = picture;
    else this.selectedAfterPicture = picture;

    const before = this.selectedBeforePicture;
    const after = this.selectedAfterPicture;
    if (before && after && this.dayOf(after) < this.dayOf(before)) {
      this.selectedBeforePicture = after;
      this.selectedAfterPicture = before;
    }

    if (!this.selectedBeforePicture) this.activeSlot = 'before';
    else if (!this.selectedAfterPicture) this.activeSlot = 'after';
    this.comparisonSelectionError = null;
  }

  /** Single picture: previous / next of the pose (newest first). */
  stepSinglePicture(delta: number): void {
    const list = this.filteredComparisonPictures;
    if (!list.length) return;
    const index = this.singlePictureIndex;
    const next = Math.min(list.length - 1, Math.max(0, index + delta));
    this.selectedSinglePicture = list[next];
  }

  get singlePictureIndex(): number {
    const selected = this.selectedSinglePicture;
    return selected ? this.filteredComparisonPictures.findIndex(p => p.id === selected.id) : -1;
  }

  /** « −3,2 kg » and « 35 jours » between Avant and Après (weight only when both pictures have one). */
  get comparisonSummary(): { days: number; weightChange: number | null } | null {
    const before = this.selectedBeforePicture;
    const after = this.selectedAfterPicture;
    if (!before || !after) return null;
    const days = Math.round((this.dayOf(after) - this.dayOf(before)) / 86_400_000);
    const weightChange = this.hasWeight(before) && this.hasWeight(after) ? after.weight - before.weight : null;
    return { days, weightChange };
  }

  /** A weight of 0 is « not given » (old pictures saved without weight), not « 0 kg ». */
  hasWeight(picture: ProgressPicture | null | undefined): boolean {
    return !!picture && typeof picture.weight === 'number' && picture.weight > 0;
  }

  isSelectedAsBefore(picture: ProgressPicture): boolean {
    return this.selectedBeforePicture?.id === picture.id;
  }

  isSelectedAsAfter(picture: ProgressPicture): boolean {
    return this.selectedAfterPicture?.id === picture.id;
  }

  private poseOf(picture: ProgressPicture): ComparisonPose {
    const pose = (picture.pose || 'FRONT').toUpperCase();
    return pose === 'SIDE' || pose === 'BACK' ? pose : 'FRONT';
  }

  private firstPoseWithPictures(): ComparisonPose {
    return this.comparisonPoses.find(pose => this.poseCount(pose) > 0) || 'FRONT';
  }

  /** Midnight of the picture's day (pictures of the same day are not compared). */
  private dayOf(picture: ProgressPicture): number {
    const date = new Date(picture.date);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  }

  trackByPictureId(_: number, picture: ProgressPicture): string {
    return picture.id;
  }

  get sortedPictures(): ProgressPicture[] {
    return [...this.pictures].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }

  failedImages = new Set<string>();

  get dateLocale(): string {
    return this.translateService.currentLang?.startsWith("fr") ? "fr" : "en";
  }

  collapsedMonths = new Set<string>();

  get monthGroups(): { key: string; date: string; pictures: ProgressPicture[] }[] {
    const groups = new Map<string, { key: string; date: string; pictures: ProgressPicture[] }>();
    for (const picture of this.sortedPictures) {
      const key = picture.date.slice(0, 7);
      if (!groups.has(key)) groups.set(key, { key, date: picture.date, pictures: [] });
      groups.get(key)!.pictures.push(picture);
    }
    return [...groups.values()];
  }

  toggleMonth(key: string): void {
    if (this.collapsedMonths.has(key)) this.collapsedMonths.delete(key);
    else this.collapsedMonths.add(key);
  }

  weightChange(picture: ProgressPicture): number | null {
    const previous = this.sortedPictures.find(p => p.date < picture.date);
    return previous ? picture.weight - previous.weight : null;
  }

  formatChange(change: number): string {
    return `${change > 0 ? "+" : change < 0 ? "−" : ""}${this.formatWeight(Math.abs(change))}`;
  }

  authorRole(picture: ProgressPicture): string | null {
    return picture.addedByRole || (picture.createdBy ? (picture.createdBy === this.clientId ? "CLIENT" : "COACH") : null);
  }

  get picturesCount(): number {
    return this.pictures.length;
  }

  formatWeight(weightKg: number | null | undefined): string {
    return this.coachSettingsService.formatWeight(weightKg);
  }

}
