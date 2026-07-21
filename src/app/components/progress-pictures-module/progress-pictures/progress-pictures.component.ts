import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
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

  selectedSinglePicture: ProgressPicture | null = null;
  selectedAfterPicture: ProgressPicture | null = null;
  selectedBeforePicture: ProgressPicture | null = null;

  constructor(
    private progressPicturesService: ProgressPicturesService,
    private documentService: DocumentService,
    private coachSettingsService: CoachSettingsService
  ) {}

  ngOnInit(): void {
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
    this.showAddModal = true;
  }

  closeAddModal(): void {
    if (this.saving) return;
    this.showAddModal = false;
  }

  onSavePicture(payload: AddProgressPicturePayload): void {
    if (!this.clientId) {
      this.error = 'CLIENT_ID_MISSING';
      console.error('Progress picture save stopped: clientId is missing');
      return;
    }

    if (this.saving) {
      return;
    }

    this.saving = true;
    this.error = null;

    const folderPath = `${this.progressPicturesDirectory}/${this.clientId}`;
    const extension = payload.file.name.includes('.')
      ? `.${payload.file.name.split('.').pop()}`
      : '';
    const uniqueFile = new File(
      [payload.file],
      `progress-${Date.now()}-${Math.random().toString(36).slice(2, 10)}${extension}`,
      { type: payload.file.type, lastModified: payload.file.lastModified }
    );

    this.documentService
      .uploadFileInPath(uniqueFile, folderPath)
      .subscribe({
        next: (uploadedPath: string) => {
          const body: SaveProgressPictureRequest = {
            clientId: this.clientId,
            imageUrl: uploadedPath,
            weight: this.coachSettingsService.convertWeightToKg(payload.weight) ?? payload.weight,
            date: payload.date
          };

          this.progressPicturesService
            .createProgressPicture(body)
            .pipe(finalize(() => (this.saving = false)))
            .subscribe({
              next: (created) => {
                this.showAddModal = false;
                this.pictureAdded.emit(created);

                // Reload to get fresh URLs from DocumentService
                this.loadPictures();
              },
              error: (err) => {
                console.error('createProgressPicture failed:', err);
                this.error =
                  err?.error?.message ||
                  err?.message ||
                  'SAVE_PROGRESS_PICTURE_ERROR';
              }
            });
        },
        error: (err) => {
          console.error('uploadFileInPath failed:', err);
          this.saving = false;
          this.error =
            err?.error?.message ||
            err?.message ||
            'UPLOAD_PROGRESS_PICTURE_ERROR';
        }
      });
  }

  openComparison(): void {
    this.showPicturesComparison = true;
    this.comparisonMode = 'comparison';

    const sorted = this.sortedPictures;
    this.selectedAfterPicture = sorted[0] || null;
    this.selectedBeforePicture = sorted[1] || null;
    this.selectedSinglePicture = sorted[0] || null;
  }

  closeComparison(): void {
    this.showPicturesComparison = false;
  }

  changeComparisonMode(mode: 'single' | 'comparison'): void {
    this.comparisonMode = mode;

    if (mode === 'single') {
      this.selectedSinglePicture =
        this.selectedAfterPicture ||
        this.selectedBeforePicture ||
        this.sortedPictures[0] ||
        null;
    }
  }

  selectComparisonPicture(picture: ProgressPicture): void {
    if (this.comparisonMode === 'single') {
      this.selectedSinglePicture = picture;
      return;
    }

    if (!this.selectedBeforePicture || (this.selectedBeforePicture && this.selectedAfterPicture)) {
      this.selectedBeforePicture = picture;
      this.selectedAfterPicture =
        this.selectedAfterPicture?.id === picture.id ? null : this.selectedAfterPicture;
    } else if (!this.selectedAfterPicture) {
      this.selectedAfterPicture = picture;
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
