import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UsersComponent } from './users.component';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';
import { UsersService } from '../../../service/users.service';

describe('UsersComponent', () => {
  let component: UsersComponent;
  let fixture: ComponentFixture<UsersComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UsersComponent, TranslateModule.forRoot()],
      providers: [{ provide: UsersService, useValue: {
        getAdminStats: () => of({totalUsers:1,totalCoachs:1,totalClients:0,totalAdmins:0,totalSuspendus:0}),
        getAdminUsers: () => of({content:[{id:'test-coach',firstName:'Test',lastName:'Coach',email:'coach@example.test',authorities:['ROLE_COACH'],activated:true}],totalElements:1})
      } }]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(UsersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.users-table').textContent).toContain('Test Coach');
  });
});
