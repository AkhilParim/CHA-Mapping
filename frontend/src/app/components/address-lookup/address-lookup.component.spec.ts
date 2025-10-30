import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddressLookupComponent } from './address-lookup.component';

describe('AddressLookupComponent', () => {
  let component: AddressLookupComponent;
  let fixture: ComponentFixture<AddressLookupComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddressLookupComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddressLookupComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

