import { Injectable } from '@angular/core';
import {BehaviorSubject} from "rxjs";

@Injectable({
  providedIn: 'root'
})
export class ModalUiStateService {

  constructor() { }

  private sidebarOpenSubject = new BehaviorSubject<boolean>(false);
  sidebarOpen$ = this.sidebarOpenSubject.asObservable();

  private sidebarWidthSubject = new BehaviorSubject<number>(0);
  sidebarWidth$ = this.sidebarWidthSubject.asObservable();

  toggleSidebar() {
    this.sidebarOpenSubject.next(!this.sidebarOpenSubject.value);
  }

  setSidebarWidth(width: number) {
    this.sidebarWidthSubject.next(width);
  }

}
