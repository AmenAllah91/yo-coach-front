import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class WebsiteBuilderStateService {
  private draft: any = null;

  setDraft(data: any): void {
    this.draft = data;
  }

  getDraft(): any {
    return this.draft;
  }

  clearDraft(): void {
    this.draft = null;
  }
}
