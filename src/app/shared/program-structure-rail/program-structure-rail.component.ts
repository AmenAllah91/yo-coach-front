import { AfterViewInit, Component, ElementRef, EventEmitter, Input, OnDestroy, Output, ViewEncapsulation, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { FeatherModule } from 'angular-feather';
import { TranslateModule } from '@ngx-translate/core';

/** État d'un jour dans la liste : rempli, repos (ou jour libre en nutrition), à corriger, trou, vide. */
export type RailDayState = 'FILLED' | 'REST' | 'INVALID' | 'GAP' | 'EMPTY' | string;

export interface RailDay<D = unknown> {
  /** Le jour de l'éditeur (renvoyé tel quel au clic). */
  day: D;
  id: unknown;
  /** « Jour 1 », déjà traduit. */
  title: string;
  /** « lun. 16 nov. » (vide pour un modèle sans dates). */
  date: string;
  state: RailDayState;
}

export interface RailWeek<W = unknown, D = unknown> {
  /** La semaine de l'éditeur (renvoyée telle quelle pour « Dupliquer la semaine »). */
  week: W;
  key: string | number;
  /** « Semaine 1 », déjà traduit. */
  label: string;
  /** « 16 nov. – 22 nov. » (vide pour un modèle sans dates). */
  range: string;
  /** Jours remplis de la semaine (sur 7). */
  ready: number;
  collapsed: boolean;
  days: RailDay<D>[];
}

/**
 * « Structure du programme » : la liste des semaines et des jours à gauche des éditeurs de programmes
 * (séances + les 3 éditeurs nutrition). Un seul composant pour que les 4 listes soient exactement pareilles.
 *
 * Styles : `program-structure-rail.component.scss` est la copie des règles de l'éditeur de séances
 * (même ordre, même poids), limitées à la liste par la classe `psr`. Encapsulation None car certaines règles
 * dépendent de l'état de la page (`.np-root.mobile-structure-open`, `.is-calendar`, `.pc-embedded`…).
 */
@Component({
  selector: 'app-program-structure-rail',
  standalone: true,
  imports: [CommonModule, DragDropModule, FeatherModule, TranslateModule],
  templateUrl: './program-structure-rail.component.html',
  styleUrls: ['./program-structure-rail.component.scss'],
  encapsulation: ViewEncapsulation.None,
  // La liste reste un enfant direct de `.np-shell` pour la mise en page (colonne de gauche, panneau sur téléphone).
  host: { '[style.display]': "'contents'" },
})
export class ProgramStructureRailComponent implements AfterViewInit, OnDestroy {
  @Input() weeks: RailWeek<any, any>[] = [];
  /** Tous les jours du programme, dans l'ordre (données du glisser-déposer). */
  @Input() days: unknown[] = [];
  /** Le jour ouvert (comparé par objet, puis par id). */
  @Input() activeDay: any = null;
  /** Clé du libellé d'un jour de repos : « Jour de repos » (séances) ou « Jour libre » (nutrition). */
  @Input() restLabel = 'REST_DAY';
  @Input() allExpanded = false;
  @Input() readOnly = false;
  @Input() canAddWeek = true;
  @Input() canCopyDay = false;
  @Input() addWeekLabel = '';

  @Output() daySelect = new EventEmitter<any>();
  @Output() weekToggle = new EventEmitter<RailWeek<any, any>>();
  @Output() toggleAll = new EventEmitter<void>();
  @Output() weekDuplicate = new EventEmitter<{ week: any; event: Event }>();
  @Output() dayDrop = new EventEmitter<CdkDragDrop<any[]>>();
  @Output() addWeek = new EventEmitter<void>();
  @Output() copyDay = new EventEmitter<void>();
  /** Téléphone : fermer le panneau. */
  @Output() closePanel = new EventEmitter<void>();

  private readonly el = inject(ElementRef<HTMLElement>);
  private headerObserver?: ResizeObserver;

  /**
   * La liste colle sous la barre de l'éditeur, elle-même sous l'en-tête de l'appli (`--wb-app-header`, posé sur
   * l'hôte de la page). On mesure la vraie hauteur de l'en-tête pour les 4 éditeurs (avant : seulement les séances,
   * la nutrition gardait 3.5rem et sa liste commençait 15 px plus haut).
   */
  ngAfterViewInit(): void {
    const header = document.querySelector<HTMLElement>('app-header .navbar, app-header nav');
    const page = (this.el.nativeElement as HTMLElement).closest('.np-root')?.parentElement as HTMLElement | null;
    if (!header || !page) return;
    const measure = () => {
      const height = Math.round(header.getBoundingClientRect().height);
      if (height > 0) page.style.setProperty('--wb-app-header', `${height}px`);
    };
    measure();
    if (typeof ResizeObserver !== 'undefined') {
      this.headerObserver = new ResizeObserver(measure);
      this.headerObserver.observe(header);
    }
  }

  ngOnDestroy(): void {
    this.headerObserver?.disconnect();
  }

  trackByWeek = (_: number, week: RailWeek) => week.key;
  trackByDay = (index: number, item: RailDay) => item.id ?? index;

  hasActive(week: RailWeek): boolean {
    return week.days.some((d) => this.isActive(d));
  }

  isActive(item: RailDay): boolean {
    const active = this.activeDay;
    if (!active) return false;
    return item.day === active || (item.id != null && item.id === active.id);
  }

  metaKey(state: RailDayState): string {
    return state === 'REST' ? this.restLabel
      : state === 'FILLED' ? 'PROGRAM_DAY_FILLED'
      : state === 'INVALID' ? 'PROGRAM_DAY_TO_FIX'
      : state === 'GAP' ? 'PROGRAM_DAY_GAP'
      : 'PROGRAM_DAY_EMPTY';
  }

  icon(state: RailDayState): string {
    return state === 'REST' ? 'moon' : state === 'INVALID' || state === 'GAP' ? 'alert-circle' : 'circle';
  }

  select(item: RailDay): void {
    this.daySelect.emit(item.day);
    this.closePanel.emit();
  }
}
