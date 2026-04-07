import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

export interface AddProgressPicturePayload {
  file: File;
  weight: number;
  date: string;
}

@Component({
  selector: 'app-add-progress-picture-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './add-progress-picture-modal.component.html',
  styleUrls: ['./add-progress-picture-modal.component.scss']
})
export class AddProgressPictureModalComponent implements OnChanges {
  @Input() isOpen = false;
  @Input() saving = false;

  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<AddProgressPicturePayload>();

  selectedFile: File | null = null;
  filePreviewUrl: string | ArrayBuffer | null = null;
  weight: number | null = null;
  date = this.getToday();

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen']?.currentValue) {
      this.resetForm();
    }
  }

  private getToday(): string {
    return new Date().toISOString().split('T')[0];
  }

  private resetForm(): void {
    this.selectedFile = null;
    this.filePreviewUrl = null;
    this.weight = null;
    this.date = this.getToday();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    if (!file || !file.type.startsWith('image/')) return;

    this.selectedFile = file;

    const reader = new FileReader();
    reader.onload = () => {
      this.filePreviewUrl = reader.result;
    };
    reader.readAsDataURL(file);
  }

  isFormValid(): boolean {
    return !!this.selectedFile && !!this.weight && this.weight > 0 && !!this.date;
  }

  submit(): void {
    if (!this.isFormValid() || !this.selectedFile || this.weight == null) {
      console.log(this.isFormValid());
      return;
    }
    this.save.emit({
      file: this.selectedFile,
      weight: this.weight,
      date: this.date
    });
  }

  onClose(): void {
    if (this.saving) return;
    this.close.emit();
  }
}
