import { Component, EventEmitter, HostListener, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { FeatherModule } from 'angular-feather';
import { Client, ClientService } from 'app/service/client.service';
import { ProgramScheduleService } from 'app/service/program-schedule.service';
import { AssignVisibilityNoteComponent } from '@shared/components/assign-visibility-note/assign-visibility-note.component';
import { AssignScheduleComponent } from '@shared/components/assign-schedule/assign-schedule.component';
import { AssignConfirmComponent, AssignConfirmRow } from '@shared/components/assign-confirm/assign-confirm.component';
import {
  AssignResult,
  ClientSchedulePreview,
  ProgramKind,
  affectedClientIds,
  changeSentence,
  programLengthDays,
} from '@shared/models/program-schedule';

type AssignmentType = 'workout' | 'nutrition';

/**
 * The one assignment window (backlog-programmes.md A1-A7), for the workout and nutrition libraries, the client profile
 * and the dashboard: one start date for all, the active clients only, a grey line under each client whose calendar
 * changes, a confirmation only when one does, then « Annuler » in the message.
 */
@Component({
  selector: 'app-modal-assign-toclient',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, FeatherModule, AssignVisibilityNoteComponent,
    AssignScheduleComponent, AssignConfirmComponent],
  templateUrl: './modal-assign-toclient.component.html',
  styleUrls: ['./modal-assign-toclient.component.scss'],
})
export class ModalAssignToclientComponent implements OnInit {
  @Input() programName = '';
  /** The program being assigned (its id, its days: the window says what the client will see). */
  @Input() program: any = null;
  @Input() assignmentType: AssignmentType = 'workout';
  /** A file program: the coach chooses its end. */
  @Input() showEndDate = false;
  /** Kept for the callers; the dates now come from the server. */
  @Input() durationDays = 1;
  @Input() includeFilePrograms = true;
  /** Assign to these clients only (client profile): no list to choose from. */
  @Input() presetClients: Client[] | null = null;

  @Output() closeModal = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();
  /** The assignment is done (the message with « Annuler » is shown by the window). */
  @Output() assigned = new EventEmitter<AssignResult>();

  step: 'select' | 'confirm' = 'select';
  startDate = '';
  endDate = '';
  previews: Record<string, ClientSchedulePreview> = {};
  checking = false;
  busy = false;
  clients: Client[] = [];
  clientsLoading = true;
  searchTerm = '';
  selectedIds: string[] = [];
  confirmRows: AssignConfirmRow[] = [];

  private readonly userId = sessionStorage.getItem('userId');

  constructor(private clientService: ClientService, public schedule: ProgramScheduleService) {}

  ngOnInit(): void {
    if (this.presetClients?.length) {
      this.clients = this.presetClients.filter(client => !!client.id);
      this.selectedIds = this.clients.map(client => String(client.id));
      this.clientsLoading = false;
      return;
    }
    if (!this.userId) {
      this.clientsLoading = false;
      return;
    }
    // Active clients only (A1), read in the window without the full-screen loader.
    this.clientService.getActiveClientsForAssignment(this.userId, true).subscribe({
      next: clients => {
        this.clients = clients;
        this.clientsLoading = false;
      },
      error: () => (this.clientsLoading = false),
    });
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.busy) return;
    if (this.step === 'confirm') this.step = 'select';
    else this.close();
  }

  get kind(): ProgramKind {
    return this.assignmentType === 'nutrition' ? 'NUTRITION' : 'WORKOUT';
  }

  get locked(): boolean {
    return !!this.presetClients?.length;
  }

  get filteredClients(): Client[] {
    const term = this.searchTerm.toLowerCase().trim();
    if (!term) return this.clients;
    return this.clients.filter(client =>
      `${client.firstName || ''} ${client.lastName || ''} ${client.email || ''}`.toLowerCase().includes(term));
  }

  get allFilteredSelected(): boolean {
    const visible = this.filteredClients.filter(client => client.id);
    return visible.length > 0 && visible.every(client => this.isSelected(client));
  }

  /** The program's length, to show its end before any client is chosen (not for a file: the coach picks its end). */
  get lengthDays(): number | null {
    return this.showEndDate ? null : programLengthDays(this.program, this.kind);
  }

  get endMissing(): boolean {
    return this.showEndDate && (!this.endDate || this.endDate < this.startDate);
  }

  get assignDisabled(): boolean {
    return this.busy || this.checking || !this.startDate || this.endMissing || this.selectedIds.length === 0
      || !this.program?.id;
  }

  isSelected(client: Client): boolean {
    return !!client.id && this.selectedIds.includes(String(client.id));
  }

  toggle(client: Client): void {
    if (!client.id || this.locked || this.busy) return;
    const id = String(client.id);
    this.selectedIds = this.selectedIds.includes(id)
      ? this.selectedIds.filter(item => item !== id)
      : [...this.selectedIds, id];
  }

  toggleAllFiltered(): void {
    if (this.locked || this.busy) return;
    const visible = this.filteredClients.filter(client => client.id).map(client => String(client.id));
    if (this.allFilteredSelected) {
      this.selectedIds = this.selectedIds.filter(id => !visible.includes(id));
    } else {
      this.selectedIds = [...new Set([...this.selectedIds, ...visible])];
    }
  }

  name(client: Client | undefined): string {
    if (!client) return '';
    return `${client.firstName || ''} ${client.lastName || ''}`.trim() || client.email || '';
  }

  initials(client: Client): string {
    const value = `${client.firstName?.[0] || ''}${client.lastName?.[0] || ''}`.toUpperCase();
    return value || (client.email?.[0] || '?').toUpperCase();
  }

  avatar(client: Client): string | null {
    return client.avatarUrl || client.image || null;
  }

  linesFor(client: Client): string[] {
    const preview = client.id ? this.previews[String(client.id)] : undefined;
    return (preview?.changes || []).map(change => this.schedule.text(changeSentence(change, this.schedule.formatDate)));
  }

  errorFor(client: Client): string | null {
    const preview = client.id ? this.previews[String(client.id)] : undefined;
    return preview?.errorCode || null;
  }

  get selectedClients(): Client[] {
    return this.selectedIds.map(id => this.clients.find(client => String(client.id) === id)).filter((c): c is Client => !!c);
  }

  /* ---------------- assigning ---------------- */

  onAssign(): void {
    if (this.assignDisabled) return;
    const ids = this.selectedClients.filter(client => !this.errorFor(client)).map(client => String(client.id));
    const refused = this.selectedIds.filter(id => !ids.includes(id));
    if (ids.length === 0 && refused.length) {
      this.doAssign(this.selectedIds); // the server says why, client by client
      return;
    }
    const affected = affectedClientIds(this.previews, this.selectedIds);
    if (affected.length === 0) {
      this.doAssign(this.selectedIds);
      return;
    }
    // Changed clients first, the others after (A6).
    this.confirmRows = this.selectedClients.map(client => ({
      id: String(client.id),
      name: this.name(client),
      avatarUrl: this.avatar(client),
      lines: this.linesFor(client),
    })).sort((a, b) => Number(b.lines.length > 0) - Number(a.lines.length > 0));
    this.step = 'confirm';
  }

  doAssign(clientIds: string[]): void {
    if (!this.program?.id || clientIds.length === 0) return;
    this.busy = true;
    const names = Object.fromEntries(this.clients.map(client => [String(client.id), this.name(client)]));
    this.schedule.run({
      kind: this.kind,
      programId: String(this.program.id),
      startDate: this.startDate,
      endDate: this.showEndDate ? this.endDate : null,
      clientIds,
    }, names).subscribe({
      next: result => {
        this.busy = false;
        this.assigned.emit(result);
        if (result.results.some(item => item.ok)) this.closeModal.emit();
        else this.step = 'select';
      },
      error: error => {
        this.busy = false;
        this.schedule.announceError(error);
      },
    });
  }

  close(): void {
    if (this.busy) return;
    this.closeModal.emit();
  }

  onCancel(): void {
    if (this.busy) return;
    this.cancel.emit();
  }
}
