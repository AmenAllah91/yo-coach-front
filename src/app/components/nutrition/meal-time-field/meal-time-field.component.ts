import { CommonModule } from '@angular/common';
import { Component, ElementRef, EventEmitter, HostListener, Input, OnDestroy, Output, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FeatherModule } from 'angular-feather';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

/**
 * Optional meal time in the nutrition builders: a pill that opens a small panel (time field + usual times).
 * Closing the panel with an empty field keeps the meal without time: never an error, never a default time.
 */
@Component({
  selector: 'app-meal-time-field',
  standalone: true,
  imports: [CommonModule, FormsModule, FeatherModule, TranslateModule],
  templateUrl: './meal-time-field.component.html',
  styleUrls: ['./meal-time-field.component.scss'],
})
export class MealTimeFieldComponent implements OnDestroy {
  /** "HH:mm", or '' when the meal has no time. */
  @Input() value: string | null | undefined = '';
  @Output() valueChange = new EventEmitter<string>();

  @ViewChild('timeInput') timeInput?: ElementRef<HTMLInputElement>;

  /** Fixed position under the pill: meal cards clip their overflow, an absolute panel would be cut. */
  panelTop = 0;
  panelLeft = 0;

  open = false;
  draft = '';

  readonly presets: { time: string; label: string }[] = [
    { time: '07:30', label: 'BREAKFAST' },
    { time: '10:30', label: 'SNACK' },
    { time: '12:30', label: 'LUNCH' },
    { time: '16:30', label: 'SNACK' },
    { time: '20:00', label: 'DINNER' },
  ];

  constructor(private host: ElementRef<HTMLElement>, private translate: TranslateService) {}

  get hasTime(): boolean { return !!this.normalize(this.value); }

  /** 08:00 (fr) / 8:00 AM (en). */
  label(time: string | null | undefined): string {
    const value = this.normalize(time);
    if (!value) return '';
    const [h, m] = value.split(':').map(Number);
    const fr = (this.translate.currentLang || 'fr').startsWith('fr');
    // 07:30 in French (24 h, two digits), 7:30 AM in English.
    return new Intl.DateTimeFormat(fr ? 'fr-FR' : 'en-US', { hour: fr ? '2-digit' : 'numeric', minute: '2-digit' })
      .format(new Date(2000, 0, 1, h, m));
  }

  toggle(): void {
    if (this.open) { this.commit(); return; }
    this.draft = this.normalize(this.value);
    const pill = this.host.nativeElement.getBoundingClientRect();
    // Under the pill, or above it when the panel (about 300 px) would leave the screen.
    this.panelTop = pill.bottom + 308 > window.innerHeight ? Math.max(8, pill.top - 300) : pill.bottom + 8;
    this.panelLeft = Math.max(8, Math.min(pill.left, window.innerWidth - 288));
    this.open = true;
    document.addEventListener('scroll', this.onScroll, true);
    document.addEventListener('mousedown', this.onOutside, true);
    setTimeout(() => this.timeInput?.nativeElement.focus());
  }

  pick(time: string): void {
    this.draft = time;
    this.commit();
  }

  /** Saves the field as it is: an empty one means "no time". */
  commit(): void {
    if (!this.open) return;
    this.closePanel();
    this.emit(this.normalize(this.draft));
  }

  remove(): void {
    this.closePanel();
    this.draft = '';
    this.emit('');
  }

  cancel(): void { this.closePanel(); }

  /**
   * Document listeners only while the panel is open: one field per meal listening to every mousedown ran change
   * detection on each click of the builder (and a day click could be lost while its button was re-rendered).
   */
  private onOutside = (event: MouseEvent): void => {
    if (!this.host.nativeElement.contains(event.target as Node)) this.commit();
  };

  /** The panel is fixed: it closes (keeping the typed time) when anything scrolls (captured: inner panes too) or resizes. */
  private onScroll = (): void => this.commit();

  @HostListener('window:resize')
  onViewportChange(): void { this.commit(); }

  ngOnDestroy(): void { this.removeListeners(); }

  private closePanel(): void {
    this.open = false;
    this.removeListeners();
  }

  private removeListeners(): void {
    document.removeEventListener('scroll', this.onScroll, true);
    document.removeEventListener('mousedown', this.onOutside, true);
  }

  @HostListener('keydown.escape')
  onEscape(): void { this.cancel(); }

  private emit(time: string): void {
    if (time === this.normalize(this.value)) return;
    this.value = time;
    this.valueChange.emit(time);
  }

  /** "8:5", "08:05:00" → "08:05"; anything else → ''. */
  private normalize(time: string | null | undefined): string {
    const match = /^(\d{1,2}):(\d{2})/.exec(String(time || '').trim());
    if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return '';
    return `${match[1].padStart(2, '0')}:${match[2]}`;
  }
}
