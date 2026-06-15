import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Client, ClientService } from 'app/service/client.service';



@Component({
  selector: 'app-modal-assign-toclient',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './modal-assign-toclient.component.html',
  styleUrls: ['./modal-assign-toclient.component.scss'],
})
export class ModalAssignToclientComponent implements OnInit {
  ngOnInit(): void {
    this.loadClient();
  }

  constructor(private clientService: ClientService) {}
  // Nom du programme affiché sous le titre
  @Input() programName = '';
  @Input() showEndDate = false;

  // Events vers le parent
  @Output() closeModal = new EventEmitter<void>();
  @Output() assignProgram = new EventEmitter<{
    date: string;
    endDate?: string;
    clients: Client[];
  }>();
  @Output() cancel = new EventEmitter<void>();

  startDate = '';
  endDate = '';
  selectedClients: Client[] = [];
  searchTerm = '';

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
        c.firstName.toLowerCase().includes(term) ||
        c.lastName.toLowerCase().includes(term) ||
        c.email.toLowerCase().includes(term)
    );
  }

  loadClient() {
    this.clientService.getClientsByCoach(this.userid).subscribe((res) => {
      this.clients = res.content;
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
    }
  }

  onRemoveClientFromChips(clientId: any): void {
    const client = this.clients.find((c) => c.id === clientId);
    if (client) {
      client.selected = false;
    }
    this.selectedClients = this.selectedClients.filter(
      (c) => c.id !== clientId
    );
  }

  get selectedCount(): number {
    return this.selectedClients.length;
  }

  get assignDisabled(): boolean {
    if (this.showEndDate) {
      return !this.startDate || !this.endDate || this.selectedCount === 0;
    }
    return !this.startDate || this.selectedCount === 0;
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
      endDate: this.showEndDate ? this.endDate : undefined,
      clients: this.selectedClients,
    });
  }
}
