import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { FeatherModule } from 'angular-feather';

export interface AssignConfirmRow {
  id: string;
  name: string;
  avatarUrl?: string | null;
  /** What changes on this client's calendar; none: "Aucun changement". */
  lines: string[];
}

/**
 * The confirmation shown when at least one client's calendar changes (backlog-programmes.md A6): one box per client
 * with its sentence, all ticked; the coach unticks the ones to leave alone and assigns to the rest without going back.
 */
@Component({
  selector: 'app-assign-confirm',
  standalone: true,
  imports: [CommonModule, TranslateModule, FeatherModule],
  templateUrl: './assign-confirm.component.html',
  styleUrls: ['./assign-confirm.component.scss'],
})
export class AssignConfirmComponent implements OnChanges {
  @Input() rows: AssignConfirmRow[] = [];
  @Input() programName = '';
  @Input() startLabel = '';
  @Input() busy = false;
  /** The step's title (« Modifier les dates » says what it confirms). */
  @Input() titleKey = 'ASSIGN_FLOW.CONFIRM_TITLE';

  @Output() confirm = new EventEmitter<string[]>();
  @Output() back = new EventEmitter<void>();

  selected = new Set<string>();
  showUnchanged = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['rows']) this.selected = new Set(this.rows.map(row => row.id));
  }

  get changed(): AssignConfirmRow[] {
    return this.rows.filter(row => row.lines.length > 0);
  }

  get unchanged(): AssignConfirmRow[] {
    return this.rows.filter(row => row.lines.length === 0);
  }

  get count(): number {
    return this.selected.size;
  }

  get single(): boolean {
    return this.rows.length === 1;
  }

  toggle(id: string): void {
    if (this.busy || this.single) return;
    const next = new Set(this.selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.selected = next;
  }

  isSelected(id: string): boolean {
    return this.selected.has(id);
  }

  initials(name: string): string {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || '?';
  }

  submit(): void {
    if (this.busy || this.count === 0) return;
    this.confirm.emit(this.rows.map(row => row.id).filter(id => this.selected.has(id)));
  }
}
