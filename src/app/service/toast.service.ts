import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface ToastAction {
  label: string;
  run: () => void;
  /** Font Awesome icon of the button (`fa-undo`...). */
  icon?: string;
}

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
  /** Lines under the message (what changed for each client after an assignment, backlog-programmes.md A7). */
  details?: string[];
  /** Buttons such as « Annuler » or « Réessayer »: running one closes the toast. */
  actions?: ToastAction[];
  /** Font Awesome icon instead of the type's one (`fa-calendar-check`...). */
  icon?: string;
  /** What the buttons do, in one short line under the details. */
  hint?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private toastsSubject = new BehaviorSubject<Toast[]>([]);
  public toasts$ = this.toastsSubject.asObservable();

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  show(toast: Omit<Toast, 'id'>): string {
    const newToast: Toast = {
      ...toast,
      id: this.generateId(),
      duration: toast.duration || 5000
    };

    const currentToasts = this.toastsSubject.value;
    this.toastsSubject.next([...currentToasts, newToast]);

    // Auto remove after duration
    setTimeout(() => {
      this.remove(newToast.id);
    }, newToast.duration);
    return newToast.id;
  }

  runAction(toast: Toast, action: ToastAction) {
    this.remove(toast.id);
    action.run();
  }

  success(title: string, message?: string) {
    this.show({ type: 'success', title, message });
  }

  error(title: string, message?: string) {
    this.show({ type: 'error', title, message });
  }

  warning(title: string, message?: string) {
    this.show({ type: 'warning', title, message });
  }

  info(title: string, message?: string) {
    this.show({ type: 'info', title, message });
  }

  remove(id: string) {
    const currentToasts = this.toastsSubject.value;
    this.toastsSubject.next(currentToasts.filter(toast => toast.id !== id));
  }
}