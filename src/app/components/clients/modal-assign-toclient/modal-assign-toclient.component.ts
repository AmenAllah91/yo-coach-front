import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Client, ClientService } from 'app/service/client.service';
import { WorkoutService } from 'app/service/workout.service';
import { NutritionService } from 'app/service/nutrition.service';
import { catchError, forkJoin, map, of } from 'rxjs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

type AssignmentType = 'workout' | 'nutrition';
type ConflictResolution = 'START_AFTER' | 'REPLACE' | 'KEEP_BOTH';

interface ScheduleConflict {
  client: Client;
  program: any;
  resolution?: ConflictResolution;
}


@Component({
  selector: 'app-modal-assign-toclient',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './modal-assign-toclient.component.html',
  styleUrls: ['./modal-assign-toclient.component.scss'],
})
export class ModalAssignToclientComponent implements OnInit {
  ngOnInit(): void {
    this.recalculateEndDate();
    this.loadClient();
  }

  constructor(
    private clientService: ClientService,
    private workoutService: WorkoutService,
    private nutritionService: NutritionService,
    private translate: TranslateService
  ) {}
  // Nom du programme affiché sous le titre
  @Input() programName = '';
  @Input() showEndDate = false;
  @Input() assignmentType: AssignmentType = 'workout';
  @Input() durationDays = 1;
  @Input() includeFilePrograms = true;

  // Events vers le parent
  @Output() closeModal = new EventEmitter<void>();
  @Output() assignProgram = new EventEmitter<{
    date: string;
    endDate?: string;
    clients: Client[];
    conflictResolutions: Record<string, { resolution: ConflictResolution; conflict: any }>;
  }>();
  @Output() cancel = new EventEmitter<void>();

  startDate = '';
  endDate = '';
  selectedClients: Client[] = [];
  searchTerm = '';
  conflicts: ScheduleConflict[] = [];
  checkingConflicts = false;

  userid = sessionStorage.getItem('userId');

  clients: Client[] = [

  ];

  johnDoeChip = {
    id: 0,
    name: 'John Doe',
    avatarText: 'JD',
  };

  // ---------- FILTRE CLIENTS ----------
  get filteredClients(): Client[] {
    const term = this.searchTerm.toLowerCase().trim();
    if (!term) {
      return this.clients;
    }
    return this.clients.filter(
      (c) =>
        (c.firstName || '').toLowerCase().includes(term) ||
        (c.lastName || '').toLowerCase().includes(term) ||
        (c.email || '').toLowerCase().includes(term)
    );
  }

  loadClient() {
    if (!this.userid) return;

    this.clientService.getListClientsByCoachWithoutPagination(this.userid).subscribe((res) => {
      this.clients = Array.isArray(res) ? res : (res?.content || []);
    });
  }

  // ---------- SÉLECTION CLIENTS ----------
  onToggleClient(client: Client): void {
    client.selected = !client.selected;

    if (client.selected) {
      if (!this.selectedClients.some((c) => c.id === client.id)) {
        this.selectedClients = [...this.selectedClients, client];
      }
    } else {
      this.selectedClients = this.selectedClients.filter(
        (c) => c.id !== client.id
      );
      this.conflicts = this.conflicts.filter((conflict) => conflict.client.id !== client.id);
    }

    this.refreshConflicts();
  }

  onRemoveClientFromChips(clientId: any): void {
    const client = this.clients.find((c) => c.id === clientId);
    if (client) {
      client.selected = false;
    }
    this.selectedClients = this.selectedClients.filter(
      (c) => c.id !== clientId
    );
    this.conflicts = this.conflicts.filter((conflict) => conflict.client.id !== clientId);
  }

  get selectedCount(): number {
    return this.selectedClients.length;
  }

  get assignDisabled(): boolean {
    return (
      !this.startDate ||
      !this.endDate ||
      this.selectedCount === 0 ||
      this.checkingConflicts ||
      this.conflicts.some((conflict) => !conflict.resolution)
    );
  }

  get hasConflicts(): boolean {
    return this.conflicts.length > 0;
  }

  get assignmentButtonLabel(): string {
    return this.translate.instant(this.hasConflicts ? 'CONFIRM_ASSIGNMENT' : 'ASSIGN_PROGRAM');
  }

  onStartDateChange(): void {
    this.recalculateEndDate();
    this.refreshConflicts();
  }

  setConflictResolution(conflict: ScheduleConflict, resolution: ConflictResolution): void {
    conflict.resolution = resolution;
  }

  hasClientConflict(client: Client): boolean {
    return this.conflicts.some((conflict) => conflict.client.id === client.id);
  }

  getClientDisplayName(client: Client): string {
    return `${client.firstName || ''} ${client.lastName || ''}`.trim() || client.email || 'Client';
  }

  getProgramName(program: any): string {
    return program?.name || program?.programName || 'Existing program';
  }

  formatDate(value?: string): string {
    if (!value) return '-';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleDateString('en-GB');
  }

  private recalculateEndDate(): void {
    if (!this.startDate) {
      this.endDate = '';
      return;
    }

    const duration = Math.max(Number(this.durationDays) || 1, 1);
    this.endDate = this.addDays(this.startDate, duration - 1);
  }

  private refreshConflicts(): void {
    if (!this.startDate || !this.endDate || this.selectedClients.length === 0 || !this.userid) {
      this.conflicts = [];
      return;
    }

    this.checkingConflicts = true;
    const previousResolutions = new Map(
      this.conflicts
        .filter((conflict) => conflict.client.id && conflict.resolution)
        .map((conflict) => [conflict.client.id, conflict.resolution])
    );

    const checks = this.selectedClients.map((client) => {
      if (!client.id) {
        return of(null);
      }

      const visibleProgramType = this.includeFilePrograms ? 'ALL' : 'APP';
      const request$ = this.assignmentType === 'nutrition'
        ? this.nutritionService.getNutritionPlanByCoachIdAndClient(this.userid!, client.id, 0, 200, visibleProgramType)
        : this.workoutService.getWorkoutByCoachIdAndClient(this.userid!, client.id, 0, 200, visibleProgramType);

      return request$.pipe(
        map((response: any) => {
          const programs = Array.isArray(response) ? response : (response?.content || []);
          const conflictProgram = programs.find((program: any) => this.overlaps(program));

          if (!conflictProgram) return null;

          return {
            client,
            program: conflictProgram,
            resolution: previousResolutions.get(client.id),
          } as ScheduleConflict;
        }),
        catchError(() => of(null))
      );
    });

    forkJoin(checks).subscribe((results) => {
      this.conflicts = results.filter((result): result is ScheduleConflict => !!result);
      this.checkingConflicts = false;
    });
  }

  private overlaps(program: any): boolean {
    if (!program?.startDate || !program?.endDate) return false;

    const existingStart = this.toDayTime(program.startDate);
    const existingEnd = this.toDayTime(program.endDate);
    const nextStart = this.toDayTime(this.startDate);
    const nextEnd = this.toDayTime(this.endDate);

    return existingStart <= nextEnd && nextStart <= existingEnd;
  }

  private toDayTime(value: string): number {
    return new Date(`${value}T00:00:00`).getTime();
  }

  private addDays(value: string, days: number): string {
    const date = new Date(`${value}T00:00:00`);
    date.setDate(date.getDate() + days);
    return this.toDateInputValue(date);
  }

  private toDateInputValue(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // ---------- ACTIONS ----------
  close(): void {
    this.closeModal.emit();
  }

  onCancel(): void {
    this.cancel.emit();
  }

  onAssign(): void {
    if (this.assignDisabled) return;

    this.assignProgram.emit({
      date: this.startDate,
      endDate: this.endDate,
      clients: this.selectedClients,
      conflictResolutions: this.conflicts.reduce((acc, conflict) => {
        if (conflict.client.id && conflict.resolution) {
          acc[conflict.client.id] = {
            resolution: conflict.resolution,
            conflict: conflict.program,
          };
        }
        return acc;
      }, {} as Record<string, { resolution: ConflictResolution; conflict: any }>),
    });
  }
}
