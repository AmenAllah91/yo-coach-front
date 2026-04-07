import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddProgressPictureModalComponent } from './add-progress-picture-modal.component';

describe('AddProgressPictureModalComponent', () => {
  let component: AddProgressPictureModalComponent;
  let fixture: ComponentFixture<AddProgressPictureModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddProgressPictureModalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddProgressPictureModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
