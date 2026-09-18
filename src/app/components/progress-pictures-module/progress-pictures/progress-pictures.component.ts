import { CommonModule, Location, registerLocaleData } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { finalize, catchError, map, switchMap } from 'rxjs/operators';
import { forkJoin, of } from 'rxjs';
import { DocumentService } from 'app/service/document.service';
import {
  ProgressPicture,
  ProgressPicturesService,
  SaveProgressPictureRequest
} from 'app/service/progress-pictures.service';
import {
  AddProgressPictureModalComponent,
  AddProgressPicturePayload
} from '../add-progress-picture-modal/add-progress-picture-modal.component';
import localeFr from '@angular/common/locales/fr';
registerLocaleData(localeFr);

import { CoachSettingsService } from 'app/service/coach-settings.service';

@Component({
  selector: 'app-progress-pictures',
  standalone: true,
  imports: [CommonModule, TranslateModule, AddProgressPictureModalComponent],
  templateUrl: './progress-pictures.component.html',
  styleUrls: ['./progress-pictures.component.scss']
})
export class ProgressPicturesComponent implements OnInit {
  @Input() clientId = '';
  @Input() allowAddPicture = true;
  @Output() pictureAdded = new EventEmitter<ProgressPicture>();

  private readonly progressPicturesDirectory = 'client-progress-pictures';

  pictures: ProgressPicture[] = [];
  loading = false;
  saving = false;
  error: string | null = null;

  showAddModal = false;
  showPicturesComparison = false;
  comparisonMode: 'single' | 'comparison' = 'comparison';
  comparisonPose: 'FRONT' | 'SIDE' | 'BACK' = 'FRONT';

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
  }

  goBack(): void {
    this.location.back();
  }

  loadPictures(): void {
    if (!this.clientId) return;

    this.loading = true;
    this.error = null;

    const folderPath = `${this.progressPicturesDirectory}/${this.clientId}`;

    this.progressPicturesService
      .getProgressPicturesByClient(this.clientId)
      .pipe(
        switchMap((pictures) => {
          const backendPictures = (pictures ?? []).sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
          );

          if (!backendPictures.length) {
            return of([]);
          }

          return this.documentService.getFilesInFolder(folderPath).pipe(
            map((freshUrls: string[]) => {
              if (!freshUrls?.length) {
                return backendPictures;
              }

              return backendPictures.map((picture) => {
                const currentFileName = this.extractFileName(picture.imageUrl);

                const freshUrl = freshUrls.find((url) => {
                  const freshFileName = this.extractFileName(url);
                  return !!currentFileName && currentFileName === freshFileName;
                });

                return {
                  ...picture,
                  imageUrl: freshUrl || picture.imageUrl
                };
              });
            }),
            catchError((err) => {
              console.error('getFilesInFolder failed:', err);
              return of(backendPictures);
            })
          );
        }),
        finalize(() => (this.loading = false))
      )
      .subscribe({
        next: (pictures) => {
          this.pictures = pictures;
        },
        error: (err) => {
          console.error('loadPictures failed:', err);
          this.error = 'LOAD_PROGRESS_PICTURES_ERROR';
        }
      });
  }

  openAddModal(): void {
    if (!this.allowAddPicture) return;
    this.error = null;
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
    const poses=(['FRONT','SIDE','BACK'] as const);
    const uploads=poses.map(pose=>{const file=payload.files[pose]; const ext=file.name.includes('.')?`.${file.name.split('.').pop()}`:''; const named=new File([file],`${groupId}-${pose.toLowerCase()}${ext}`,{type:file.type,lastModified:file.lastModified}); return this.documentService.uploadFileInPath(named,folderPath).pipe(map(()=>({pose,imageUrl:`${folderPath}/${named.name}`})));});
    forkJoin(uploads).pipe(switchMap(items=>forkJoin(items.map(item=>this.progressPicturesService.createProgressPicture({clientId:this.clientId,imageUrl:item.imageUrl,groupId,weight:this.coachSettingsService.convertWeightToKg(payload.weight)??payload.weight,date:payload.date,pose:item.pose,note:payload.note})))),finalize(()=>this.saving=false)).subscribe({next:created=>{this.showAddModal=false;created.forEach(x=>this.pictureAdded.emit(x));this.loadPictures();},error:err=>{console.error(err);this.error=err?.error?.message||err?.message||'SAVE_PROGRESS_PICTURE_ERROR';}});
  }

  openComparison(): void {
    this.showPicturesComparison = true;
    this.comparisonMode = 'comparison';
    this.comparisonPose = 'FRONT';

    this.selectedAfterPicture = null;
    this.selectedBeforePicture = null;
    this.selectedSinglePicture = this.sortedPictures[0] || null;
    this.comparisonSelectionError = null;
  }

  closeComparison(): void {
    this.showPicturesComparison = false;
  }

  changeComparisonMode(mode: 'single' | 'comparison'): void {
    this.comparisonMode = mode;
    this.comparisonSelectionError = null;

    if (mode === 'single') {
      this.selectedSinglePicture =
        this.selectedAfterPicture ||
        this.selectedBeforePicture ||
        this.sortedPictures[0] ||
        null;
    }
  }


  changeComparisonPose(pose: 'FRONT' | 'SIDE' | 'BACK'): void {
    if (this.comparisonPose === pose) return;
    this.comparisonPose = pose;
    this.selectedBeforePicture = null;
    this.selectedAfterPicture = null;
    this.selectedSinglePicture = this.filteredComparisonPictures[0] || null;
    this.comparisonSelectionError = null;
  }

  get filteredComparisonPictures(): ProgressPicture[] {
    return this.sortedPictures.filter(p => (p.pose || 'FRONT').toUpperCase() === this.comparisonPose);
  }

  selectComparisonPicture(picture: ProgressPicture): void {
    if (this.comparisonMode === 'single') {
      this.selectedSinglePicture = picture;
      this.comparisonSelectionError = null;
      return;
    }

    if (!this.selectedBeforePicture || (this.selectedBeforePicture && this.selectedAfterPicture)) {
      this.selectedBeforePicture = picture;
      this.selectedAfterPicture = null;
      this.comparisonSelectionError = null;
    } else if (!this.selectedAfterPicture) {
      const candidateTime = new Date(picture.date).getTime();
      const beforeTime = new Date(this.selectedBeforePicture.date).getTime();

      if (candidateTime === beforeTime) {
        this.comparisonSelectionError = 'AFTER_PICTURE_DATE_MUST_BE_LATER';
        return;
      }

      if (candidateTime > beforeTime) {
        this.selectedAfterPicture = picture;
      } else {
        this.selectedAfterPicture = this.selectedBeforePicture;
        this.selectedBeforePicture = picture;
      }
      this.comparisonSelectionError = null;
    }
  }

  isSelectedAsBefore(picture: ProgressPicture): boolean {
    return this.selectedBeforePicture?.id === picture.id;
  }

  isSelectedAsAfter(picture: ProgressPicture): boolean {
    return this.selectedAfterPicture?.id === picture.id;
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

  private extractFileName(pathOrUrl: string | null | undefined): string {
    if (!pathOrUrl) return '';

    const withoutQuery = pathOrUrl.split('?')[0];
    const parts = withoutQuery.split('/');

    const fileName = parts.length ? parts[parts.length - 1] : '';
    try {
      return decodeURIComponent(fileName).toLowerCase();
    } catch {
      return fileName.toLowerCase();
    }
  }
}
