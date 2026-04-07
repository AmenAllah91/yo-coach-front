import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WebsiteLeadsComponent } from './website-leads.component';

describe('WebsiteLeadsComponent', () => {
  let component: WebsiteLeadsComponent;
  let fixture: ComponentFixture<WebsiteLeadsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WebsiteLeadsComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(WebsiteLeadsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
