import { Component, OnInit } from '@angular/core';
import { FeatherModule } from 'angular-feather';

@Component({
    selector: 'app-footer',
    templateUrl: './footer.component.html',
    styleUrls: ['./footer.component.sass'],
    standalone: true,
    imports: [FeatherModule]
})
export class FooterComponent implements OnInit {

  constructor() { }

  ngOnInit(): void {
  }

}
