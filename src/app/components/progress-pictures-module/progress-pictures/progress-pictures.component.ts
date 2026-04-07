import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { finalize } from 'rxjs/operators';
import { TranslateModule } from '@ngx-translate/core';
import { DocumentService } from 'app/service/document.service';
import {
  ProgressPicture,
  ProgressPicturesService,
  SaveProgressPictureRequest
} from 'app/service/progress-pictures.service';
import {
  AddProgressPictureModalComponent,
  AddProgressPicturePayload
} from "../add-progress-picture-modal/add-progress-picture-modal.component";

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
    private documentService: DocumentService
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

    console.log(this.clientId);
    this.loadPictures();
  }

  loadPictures(): void {
    if (!this.clientId) return;

    this.loading = true;
    this.error = null;

    this.progressPicturesService
      .getProgressPicturesByClient(this.clientId)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (pictures) => {
          this.pictures = (pictures ?? []).sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
          );
        },
        error: () => {
          this.error = 'LOAD_PROGRESS_PICTURES_ERROR';
        }
      });
  }

  openAddModal(): void {
    this.showAddModal = true;
  }

  closeAddModal(): void {
    if (this.saving) return;
    this.showAddModal = false;
  }

  onSavePicture(payload: AddProgressPicturePayload): void {
    console.log('onSavePicture payload:', payload);
    console.log('clientId:', this.clientId);
    console.log('saving:', this.saving);

    if (!this.clientId) {
      this.error = 'CLIENT_ID_MISSING';
      console.error('Progress picture save stopped: clientId is missing');
      return;
    }

    if (this.saving) {
      console.warn('Progress picture save stopped: already saving');
      return;
    }

    this.saving = true;
    this.error = null;

    this.documentService
      .uploadFileInPath(payload.file, `${this.progressPicturesDirectory}/${this.clientId}`)
      .subscribe({
        next: (uploadedPath: string) => {
          const body: SaveProgressPictureRequest = {
            clientId: this.clientId,
            imageUrl: uploadedPath,
            weight: payload.weight,
            date: payload.date
          };

          this.progressPicturesService
            .createProgressPicture(body)
            .pipe(finalize(() => (this.saving = false)))
            .subscribe({
              next: (created) => {
                this.pictures = [created, ...this.pictures].sort(
                  (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
                );
                this.showAddModal = false;
                this.pictureAdded.emit(created);
              },
              error: () => {
                this.error = 'SAVE_PROGRESS_PICTURE_ERROR';
              }
            });
        },
        error: () => {
          this.saving = false;
          this.error = 'UPLOAD_PROGRESS_PICTURE_ERROR';
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
}
