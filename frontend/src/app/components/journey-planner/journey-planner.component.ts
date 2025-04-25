import { Component, ElementRef, OnDestroy, OnInit, ViewChild, CUSTOM_ELEMENTS_SCHEMA, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import mapboxgl from 'mapbox-gl';
import { environment } from '../../../environments/environment';
import 'mapbox-gl/dist/mapbox-gl.css';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

interface Place {
  id: number;
  name: string;
  address: string;
  zipCode: string;
}

@Component({
  selector: 'app-journey-planner',
  standalone: true,
  imports: [
    CommonModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    FormsModule
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './journey-planner.component.html',
  styleUrl: './journey-planner.component.scss'
})
export class JourneyPlannerComponent implements OnInit, OnDestroy {
  @ViewChild('mapContainer') mapContainer!: ElementRef;
  @ViewChild('picker') datePicker: any;
  @ViewChild('addDateBtn') addDateBtn!: ElementRef;
  @ViewChild('dateSelector') dateSelector!: ElementRef;
  
  map!: mapboxgl.Map;
  places: Place[] = [
    { id: 1, name: 'Home', address: '1234 Main St.', zipCode: '11111' },
    { id: 2, name: 'School', address: '1234 Main St.', zipCode: '11111' },
    { id: 3, name: 'Pharmacy', address: '1234 Main St.', zipCode: '22222' },
    { id: 4, name: 'Grocery', address: '1234 Main St.', zipCode: '33333' }
  ];
  journeyDates: string[] = [];
  pickerDate: Date | null = null;
  activeDate: string | null = null;
  initialCoordinates: [number, number] = [-87.65888830611969, 41.874497559910914];
  private observer: MutationObserver | null = null;

  constructor(private ngZone: NgZone, private router: Router) {}

  ngOnInit(): void {
    mapboxgl.accessToken = environment.mapboxToken;
    this.setupDatePickerObserver();
  }

  ngAfterViewInit(): void {
    this.initializeMap();
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
    }
    if (this.observer) {
      this.observer.disconnect();
    }
  }

  private setupDatePickerObserver(): void {
    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        const nodes = Array.from(mutation.addedNodes);
        for (const node of nodes) {
          if (node instanceof HTMLElement && node.classList.contains('mat-datepicker-content')) {
            this.ngZone.run(() => {
              this.positionDatePicker(node as HTMLElement);
            });
          }
        }
      }
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  private positionDatePicker(element: HTMLElement): void {
    const buttonRect = this.addDateBtn.nativeElement.getBoundingClientRect();
    element.style.position = 'fixed';
    element.style.top = `${buttonRect.bottom + 8}px`;
    element.style.left = `${buttonRect.left}px`;
  }

  private initializeMap(): void {
    this.map = new mapboxgl.Map({
      container: this.mapContainer.nativeElement,
      style: 'mapbox://styles/mapbox/navigation-night-v1',
      center: this.initialCoordinates,
      zoom: 13
    });
  }

  openDatePicker(event: MouseEvent): void {
    this.datePicker.open();
  }

  onDateSelected(event: any): void {
    if (event && event.value instanceof Date) {
      this.pickerDate = event.value;
    }
  }

  onDatePickerClosed(): void {
    if (this.pickerDate) {
      const formattedDate = this.pickerDate.toLocaleDateString();
      if (!this.journeyDates.includes(formattedDate)) {
        this.journeyDates.push(formattedDate);
        // Sort dates chronologically
        this.journeyDates.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
      }
      this.setActiveDate(formattedDate);
      this.pickerDate = null;
    }
  }

  setActiveDate(date: string): void {
    this.activeDate = date;
    // Wait for the DOM to update
    setTimeout(() => this.scrollToActiveDate(), 0);
  }

  private scrollToActiveDate(): void {
    if (!this.dateSelector || !this.activeDate) return;

    const dateElements = this.dateSelector.nativeElement.getElementsByClassName('date');
    const activeElement = Array.from(dateElements).find(
      (el: any) => el.textContent.trim() === this.activeDate
    ) as HTMLElement;

    if (activeElement) {
      activeElement.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center'
      });
    }
  }

  addCard() {
    this.router.navigate(['/add']);
  }
}
