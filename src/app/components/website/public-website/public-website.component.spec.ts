import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PublicWebsiteComponent } from './public-website.component';

describe('PublicWebsiteComponent', () => {
  let component: PublicWebsiteComponent;
  let fixture: ComponentFixture<PublicWebsiteComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PublicWebsiteComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(PublicWebsiteComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
