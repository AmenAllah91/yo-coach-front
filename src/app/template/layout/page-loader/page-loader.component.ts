import { Component, OnInit } from '@angular/core';
import { LoadingBarModule } from '@ngx-loading-bar/core';
@Component({
    selector: 'app-page-loader',
    templateUrl: './page-loader.component.html',
    styleUrls: ['./page-loader.component.sass'],
    standalone: true,
    imports: [LoadingBarModule]
})
export class PageLoaderComponent implements OnInit {
  constructor() { }
  ngOnInit() { }
}
