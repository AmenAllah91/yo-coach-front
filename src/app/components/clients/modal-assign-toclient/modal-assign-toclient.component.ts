import {Component, EventEmitter, Input, Output} from '@angular/core';

interface Client {
  id: number;
  name: string;
  email: string;
  image: string;
  selected: boolean;
}


@Component({
  selector: 'app-modal-assign-toclient',
  standalone: true,
  imports: [],
  templateUrl: './modal-assign-toclient.component.html',
  styleUrl: './modal-assign-toclient.component.scss'
})
export class ModalAssignToclientComponent {

  @Input() program: any;
  @Output() closeModal = new EventEmitter<void>();
  @Output() assignProgram = new EventEmitter<any>();
  @Output() cancel = new EventEmitter<void>();
  startDate = '';
  selectedClients: Client[] = [];
  searchTerm = '';



  clients: Client[] = [
    {
      id: 1,
      name: 'Sarah Smith',
      email: 'sarah.smith@example.com',
      image:
        'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=256&q=80',
      selected: false,
    },
    {
      id: 2,
      name: 'Michael Johnson',
      email: 'michael.j@example.com',
      image:
        'https://images.unsplash.com/photo-1599566150163-29194dcaad36?auto=format&fit=crop&w=256&q=80',
      selected: false,
    },
  ];

  johnDoeChip = {
    id: 0,
    name: 'John Doe',
    avatarText: 'JD',
  };

// ------------------- FILTRES -------------------

  get filteredClients(): Client[] {
    const term = this.searchTerm.toLowerCase().trim();
    if (!term) {
      return this.clients;
    }
    return this.clients.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        c.email.toLowerCase().includes(term),
    );
  }


// ------------------- SELECTION CLIENTS -------------------

  onToggleClient(client: Client): void {
    client.selected = !client.selected;

    if (client.selected) {
      // on ajoute s'il n'y est pas déjà
      if (!this.selectedClients.some((c) => c.id === client.id)) {
        this.selectedClients = [...this.selectedClients, client];
      }
    } else {
      // on retire
      this.selectedClients = this.selectedClients.filter(
        (c) => c.id !== client.id,
      );
    }
  }

  onRemoveClientFromChips(clientId: number): void {
    const client = this.clients.find((c) => c.id === clientId);
    if (client) {
      client.selected = false;
    }
    this.selectedClients = this.selectedClients.filter(
      (c) => c.id !== clientId,
    );
  }


  get selectedCount(): number {
    return this.selectedClients.length;
  }

  get assignDisabled(): boolean {
    return !this.startDate || this.selectedCount === 0;
  }


  close() {
    this.closeModal.emit();
  }

  onCancel(): void {
    this.cancel.emit();
  }

  onAssign(): void {
    if (this.assignDisabled) return;

    this.assignProgram.emit({
      date: this.startDate,
      clients: this.selectedClients, // directement les objets client
    });
  }
}
