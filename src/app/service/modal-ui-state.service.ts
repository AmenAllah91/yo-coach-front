import { Injectable } from '@angular/core';
import {BehaviorSubject} from "rxjs";

export interface DeleteModalConfig {
  title: string;
  message: string;
  itemName?: string;
  confirmText?: string;
  cancelText?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ModalUiStateService {

  constructor() { }

  private sidebarOpenSubject = new BehaviorSubject<boolean>(false);
  sidebarOpen$ = this.sidebarOpenSubject.asObservable();

  private sidebarWidthSubject = new BehaviorSubject<number>(0);
  sidebarWidth$ = this.sidebarWidthSubject.asObservable();

  private deleteModalShowSubject = new BehaviorSubject<boolean>(false);
  private deleteModalConfigSubject = new BehaviorSubject<DeleteModalConfig | null>(null);
  private deleteModalResolveSubject = new BehaviorSubject<((value: boolean) => void) | null>(null);

  deleteModalShow$ = this.deleteModalShowSubject.asObservable();
  deleteModalConfig$ = this.deleteModalConfigSubject.asObservable();

  toggleSidebar() {
    this.sidebarOpenSubject.next(!this.sidebarOpenSubject.value);
  }

  setSidebarWidth(width: number) {
    this.sidebarWidthSubject.next(width);
  }

  openDeleteModal(config: DeleteModalConfig): Promise<boolean> {
    console.log('Opening delete modal with config:', config);
    return new Promise((resolve) => {
      this.deleteModalConfigSubject.next({
        confirmText: 'Delete',
        cancelText: 'Cancel',
        ...config
      });
      this.deleteModalResolveSubject.next(resolve);
      this.deleteModalShowSubject.next(true);
      console.log('Delete modal state set to true');
    });
  }

  confirmDelete(): void {
    const resolve = this.deleteModalResolveSubject.value;
    if (resolve) {
      resolve(true);
    }
    this.closeDeleteModal();
  }

  cancelDelete(): void {
    const resolve = this.deleteModalResolveSubject.value;
    if (resolve) {
      resolve(false);
    }
    this.closeDeleteModal();
  }

  private closeDeleteModal(): void {
    this.deleteModalShowSubject.next(false);
    this.deleteModalConfigSubject.next(null);
    this.deleteModalResolveSubject.next(null);
  }

}
