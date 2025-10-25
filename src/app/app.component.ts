import {Component} from '@angular/core';
import {Observable} from "rxjs";
import {LoaderService} from "./service/loader.service";


@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {
  isLoading: Observable<boolean>;

  constructor(
    private loaderService: LoaderService,
  ) {
    this.isLoading = this.loaderService.isLoading$;
  }

}
