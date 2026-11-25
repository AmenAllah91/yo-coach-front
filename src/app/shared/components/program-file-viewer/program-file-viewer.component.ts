import {
  ChangeDetectorRef, Component, ElementRef, EventEmitter, HostListener, Input, NgZone, OnChanges, OnDestroy, Output,
  SimpleChanges, ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { FeatherModule } from 'angular-feather';
import { Observable, Subscription } from 'rxjs';
import * as XLSX from 'xlsx';
import { WorkoutService } from 'app/service/workout.service';
import { NutritionService } from 'app/service/nutrition.service';
import { programFileOpenErrorKey, programFileSaveName, programFileTypeOfPlan } from '@shared/models/program-file-check';
import { SheetView, readWorkbook, sheetView } from './program-file-sheet';

/**
 * The one viewer of a program file (audit PDF/Excel 2026-11-23, lot 2), the same for the coach (profile, libraries,
 * calendar) and the client: a sharp PDF on a phone (device pixels), redrawn when the screen turns; an Excel file read
 * here (no CDN), with its sheets, merged cells, real row numbers and a limit that is said.
 * « overlay » covers the page (coach screens); « embedded » sits in the client page under its own header.
 */
@Component({
  selector: 'app-program-file-viewer',
  standalone: true,
  imports: [CommonModule, TranslateModule, FeatherModule],
  templateUrl: './program-file-viewer.component.html',
  styleUrl: './program-file-viewer.component.scss',
})
export class ProgramFileViewerComponent implements OnChanges, OnDestroy {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  @Input() plan: any = null;
  @Input() kind: 'workout' | 'nutrition' = 'workout';
  @Input() mode: 'overlay' | 'embedded' = 'overlay';
  /** The client's words in the messages (« Votre coach a retiré ce fichier »). */
  @Input() client = false;
  @Output() closed = new EventEmitter<void>();

  @ViewChild('pdfCanvas') pdfCanvas?: ElementRef<HTMLCanvasElement>;

  loading = false;
  /** Translation key: the file could not be shown. */
  error = '';
  /** Translation key: a short message above the file (the file stays shown). */
  notice = '';
  type: 'PDF' | 'EXCEL' = 'PDF';

  pdfPage = 1;
  pdfPages = 0;
  pdfZoom = 100;

  sheets: string[] = [];
  sheet = '';
  view: SheetView | null = null;

  private blob: Blob | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private pdfDocument: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private renderTask: any = null;
  private workbook: XLSX.WorkBook | null = null;
  private request?: Subscription;
  private resizeTimer: ReturnType<typeof setTimeout> | null = null;
  private lastWidth = 0;

  constructor(
    private workoutService: WorkoutService,
    private nutritionService: NutritionService,
    private cdr: ChangeDetectorRef,
    private zone: NgZone,
  ) {}

  get title(): string { return this.plan?.name || this.plan?.originalFileName || ''; }
  get fileName(): string { return this.plan?.originalFileName || ''; }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['plan'] || changes['kind']) this.load();
  }

  ngOnDestroy(): void {
    this.request?.unsubscribe();
    this.cancelRender();
    if (this.resizeTimer) clearTimeout(this.resizeTimer);
    this.pdfDocument?.destroy?.();
  }

  @HostListener('document:keydown.escape')
  close(): void {
    if (this.mode === 'overlay') this.closed.emit();
  }

  /** A PDF follows the width of its frame (phone turned, window resized). */
  @HostListener('window:resize')
  onResize(): void {
    if (this.type !== 'PDF' || !this.pdfDocument) return;
    if (this.resizeTimer) clearTimeout(this.resizeTimer);
    this.resizeTimer = setTimeout(() => {
      const width = this.frameWidth();
      if (Math.abs(width - this.lastWidth) > 8) this.renderPdf();
    }, 150);
  }

  private load(): void {
    this.request?.unsubscribe();
    this.cancelRender();
    this.pdfDocument?.destroy?.();
    this.pdfDocument = null;
    this.workbook = null;
    this.view = null;
    this.blob = null;
    this.error = '';
    this.notice = '';
    if (!this.plan) return;
    this.type = programFileTypeOfPlan(this.plan);
    this.loading = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const blob$: Observable<Blob> = this.kind === 'workout'
      ? this.workoutService.getWorkoutFileBlob(this.plan)
      : this.nutritionService.downloadNutritionFile(this.plan);
    this.request = blob$.subscribe({
      next: blob => { void this.show(blob); },
      error: (error: unknown) => {
        this.loading = false;
        this.error = programFileOpenErrorKey(error, this.client);
        this.cdr.markForCheck();
      },
    });
  }

  private async show(blob: Blob): Promise<void> {
    this.blob = blob;
    try {
      const data = await blob.arrayBuffer();
      // The bytes decide when they are clear (a « .xlsx » that is a PDF opens as a PDF).
      const head = new Uint8Array(data.slice(0, 1024));
      if (head[0] === 0x50 && head[1] === 0x4b) this.type = 'EXCEL';
      else if (head[0] === 0xd0 && head[1] === 0xcf) this.type = 'EXCEL';
      else if (new TextDecoder('latin1').decode(head).includes('%PDF-')) this.type = 'PDF';

      if (this.type === 'EXCEL') {
        this.workbook = readWorkbook(data);
        this.sheets = this.workbook.SheetNames || [];
        this.loading = false;
        this.showSheet(this.sheets[0] || '');
        if (!this.view?.rows.length && this.sheets.length <= 1) this.error = 'PROGRAM_FILES.VIEWER_EMPTY';
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pdfjs: any = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = 'assets/pdf.worker.min.mjs';
        this.pdfDocument = await pdfjs.getDocument({ data }).promise;
        this.pdfPages = this.pdfDocument.numPages || 0;
        this.pdfPage = 1;
        this.loading = false;
        this.cdr.detectChanges();
        await this.renderPdf();
      }
    } catch {
      this.loading = false;
      this.error = 'PROGRAM_FILES.ERROR_OPEN';
    }
    this.cdr.markForCheck();
  }

  showSheet(name: string): void {
    this.sheet = name;
    this.view = sheetView(this.workbook?.Sheets[name]);
  }

  goToPage(delta: number): void {
    const next = this.pdfPage + delta;
    if (next < 1 || (this.pdfPages && next > this.pdfPages)) return;
    this.pdfPage = next;
    void this.renderPdf();
  }

  zoom(delta: number): void {
    this.pdfZoom = Math.min(300, Math.max(50, this.pdfZoom + delta));
    void this.renderPdf();
  }

  private frameWidth(): number {
    const frame = this.pdfCanvas?.nativeElement.parentElement;
    return Math.max(260, (frame?.clientWidth || 800) - 16);
  }

  /** Drawn at the device's pixel density, shown at its CSS size: sharp on a phone (it was blurry). */
  private async renderPdf(): Promise<void> {
    const canvas = this.pdfCanvas?.nativeElement;
    if (!this.pdfDocument || !canvas) return;
    this.cancelRender();
    const context = canvas.getContext('2d');
    if (!context) return;
    const page = await this.pdfDocument.getPage(this.pdfPage);
    const width = this.frameWidth();
    this.lastWidth = width;
    const base = page.getViewport({ scale: 1 });
    const scale = (width / base.width) * (this.pdfZoom / 100);
    const ratio = Math.min(3, window.devicePixelRatio || 1);
    const viewport = page.getViewport({ scale: scale * ratio });
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    canvas.style.width = `${Math.floor(viewport.width / ratio)}px`;
    canvas.style.height = `${Math.floor(viewport.height / ratio)}px`;
    // Outside Angular: pdf.js draws with many timers.
    await this.zone.runOutsideAngular(async () => {
      this.renderTask = page.render({ canvasContext: context, viewport });
      try { await this.renderTask.promise; } catch { /* replaced by a newer drawing */ }
      this.renderTask = null;
    });
  }

  private cancelRender(): void {
    try { this.renderTask?.cancel(); } catch { /* finished already */ }
    this.renderTask = null;
  }

  download(): void {
    if (!this.blob) return;
    const url = URL.createObjectURL(this.blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = programFileSaveName(this.plan, this.type);
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  /** The browser's own PDF reader, in a new tab (search, print). */
  openInNewTab(): void {
    if (!this.blob) return;
    const pdf = this.blob.type === 'application/pdf' ? this.blob : new Blob([this.blob], { type: 'application/pdf' });
    const url = URL.createObjectURL(pdf);
    const tab = window.open(url, '_blank');
    this.notice = tab ? '' : 'PROGRAM_FILES.POPUP_BLOCKED';
    setTimeout(() => URL.revokeObjectURL(url), 10 * 60_000);
  }

  trackRow(_: number, row: { number: number }): number { return row.number; }
}
