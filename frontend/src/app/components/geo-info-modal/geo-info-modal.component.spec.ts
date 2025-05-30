import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GeoInfoModalComponent } from './geo-info-modal.component';

describe('GeoInfoModalComponent', () => {
  let component: GeoInfoModalComponent;
  let fixture: ComponentFixture<GeoInfoModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GeoInfoModalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GeoInfoModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
