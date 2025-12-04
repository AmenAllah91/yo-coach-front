import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ModalAssignToclientComponent } from './modal-assign-toclient.component';

describe('ModalAssignToclientComponent', () => {
  let component: ModalAssignToclientComponent;
  let fixture: ComponentFixture<ModalAssignToclientComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ModalAssignToclientComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ModalAssignToclientComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
