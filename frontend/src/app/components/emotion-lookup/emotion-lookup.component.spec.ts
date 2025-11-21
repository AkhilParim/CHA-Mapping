import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EmotionLookupComponent } from './emotion-lookup.component';

describe('EmotionLookupComponent', () => {
  let component: EmotionLookupComponent;
  let fixture: ComponentFixture<EmotionLookupComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmotionLookupComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EmotionLookupComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});


