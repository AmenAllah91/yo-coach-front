import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class LoaderService {
  private loadingSubject = new BehaviorSubject<boolean>(false);
  private pendingRequests = 0;
  public loading$ = this.loadingSubject.asObservable();

  show() {
    this.pendingRequests += 1;
    if (this.pendingRequests === 1) {
      this.loadingSubject.next(true);
    }
  }

  hide() {
    this.pendingRequests = Math.max(0, this.pendingRequests - 1);
    if (this.pendingRequests === 0) {
      this.loadingSubject.next(false);
    }
  }
}
