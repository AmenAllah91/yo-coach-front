import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { FeatherModule } from 'angular-feather';
import { Client } from 'app/service/client.service';

/**
 * Compact client list shown beside a client profile so the coach can jump from
 * one client to another. Purely presentational: the host provides the clients
 * (already loaded for its own client switcher) and handles navigation.
 */
@Component({
  selector: 'app-client-nav-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, FeatherModule],
  templateUrl: './client-nav-panel.component.html',
  styleUrls: ['./client-nav-panel.component.scss'],
})
export class ClientNavPanelComponent implements AfterViewInit, OnDestroy {
  @Input() clients: Client[] = [];
  @Input() activeClientId = '';
  @Input() loading = false;
  @Input() open = true;
  @Output() openChange = new EventEmitter<boolean>();
  @Output() clientSelect = new EventEmitter<Client>();

  search = '';
  private headerObserver?: ResizeObserver;

  constructor(private host: ElementRef<HTMLElement>) {}

  ngAfterViewInit(): void {
    // The app bar height depends on its content, so follow it to keep the
    // sticky panel exactly below it.
    const header = document.querySelector<HTMLElement>('app-header .navbar');
    if (!header || typeof ResizeObserver === 'undefined') return;

    this.headerObserver = new ResizeObserver(() => {
      this.host.nativeElement.style.setProperty('--client-nav-top', `${header.offsetHeight}px`);
    });
    this.headerObserver.observe(header);
  }

  ngOnDestroy(): void {
    this.headerObserver?.disconnect();
  }

  get filteredClients(): Client[] {
    const term = this.search.trim().toLowerCase();
    if (!term) return this.clients;

    return this.clients.filter((client) =>
      `${client.firstName || ''} ${client.lastName || ''} ${client.email || ''}`
        .toLowerCase()
        .includes(term)
    );
  }

  setOpen(open: boolean): void {
    this.open = open;
    this.openChange.emit(open);
  }

  select(client: Client): void {
    if (!client.id || client.id === this.activeClientId) return;
    this.clientSelect.emit(client);
  }

  isActive(client: Client): boolean {
    return !!client.id && client.id === this.activeClientId;
  }

  fullName(client: Client): string {
    return `${client.firstName || ''} ${client.lastName || ''}`.trim() || client.email || '';
  }

  initials(client: Client): string {
    return `${client.firstName?.[0] || ''}${client.lastName?.[0] || ''}`.toUpperCase() || '--';
  }

  photo(client: Client): string {
    const url = String(client.avatarUrl || client.image || '').trim();
    return url && url.toLowerCase() !== 'not found' ? url : '';
  }

  onPhotoError(client: Client): void {
    client.avatarUrl = '';
    client.image = '';
  }

  program(client: Client): string {
    return client.currentProgramName || client.lastProgramName || client.program || '';
  }

  trackById(_: number, client: Client): string | undefined {
    return client.id;
  }
}
