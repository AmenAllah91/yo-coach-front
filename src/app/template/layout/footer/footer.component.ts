import { Component, OnInit } from '@angular/core';
import { FeatherModule } from 'angular-feather';
import { TranslateModule } from '@ngx-translate/core';

@Component({
    selector: 'app-footer',
    templateUrl: './footer.component.html',
    styleUrls: ['./footer.component.sass'],
    standalone: true,
    imports: [FeatherModule, TranslateModule]
})
export class FooterComponent implements OnInit {

  constructor() { }

  ngOnInit(): void {
  }

}
