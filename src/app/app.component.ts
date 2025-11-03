import {Component} from '@angular/core';
import {Observable} from "rxjs";
import {LoaderService} from "./service/loader.service";
import {ToastService} from "./service/toast.service";


@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {
  isLoading: Observable<boolean>;

  constructor(
    public loaderService: LoaderService,
    public toastService: ToastService
  ) {
    this.isLoading = this.loaderService.loading$;
  }

  getToastIcon(type: string): string {
    switch (type) {
      case 'success': return 'fa-check-circle';
      case 'error': return 'fa-times-circle';
      case 'warning': return 'fa-exclamation-triangle';
      case 'info': return 'fa-info-circle';
      default: return 'fa-info-circle';
    }
  }

}
