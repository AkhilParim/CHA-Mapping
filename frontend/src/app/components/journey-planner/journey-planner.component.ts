import { Component, ElementRef, OnDestroy, OnInit, ViewChild, CUSTOM_ELEMENTS_SCHEMA, NgZone, AfterViewInit } from '@angular/core';
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
import { PlacesService, Place, LocationGroup } from '../../services/places.service';
import { Subscription } from 'rxjs';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { ConfirmationDialogComponent } from '../../components/confirmation-dialog/confirmation-dialog.component';
import { SummaryComponent } from '../../components/summary/summary.component';

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
    FormsModule,
    MatDialogModule
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './journey-planner.component.html',
  styleUrl: './journey-planner.component.scss'
})
export class JourneyPlannerComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapContainer') mapContainer!: ElementRef;
  @ViewChild('picker') datePicker: any;
  @ViewChild('addDateBtn') addDateBtn!: ElementRef;
  @ViewChild('dateSelector') dateSelector!: ElementRef;
  
  map!: mapboxgl.Map;
  places: Place[] = [];
  journeyDates: string[] = [];
  pickerDate: Date | null = null;
  activeDate: string | null = null;
  selectedPlace: Place | null = null;
  initialCoordinates: [number, number] = [-87.65888830611969, 41.874497559910914]; // UIC Innovation Center Coordinates
  private observer: MutationObserver | null = null;
  private subscription: Subscription | null = null;
  private toMarkers: mapboxgl.Marker[] = [];
  private markerAlphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  
  // Location grouping properties
  locationGroups: LocationGroup[] = [];
  highlightedPlaces: Set<string> = new Set();
  highlightedMarkerAlphabet: string | null = null;

  constructor(
    private ngZone: NgZone, 
    private router: Router,
    private placesService: PlacesService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    mapboxgl.accessToken = environment.mapboxToken;
    this.setupDatePickerObserver();

    // Subscribe to selected date changes
    this.subscription = this.placesService.selectedDate$.subscribe(date => {
      if (date) {
        this.activeDate = date;
      } else {
        const allDates = this.placesService.getAllDates();
        if (allDates.length > 0) {
          this.activeDate = allDates[allDates.length - 1];
        } else {
          this.activeDate = null;
        }
      }
      if (this.activeDate) {
        this.places = this.placesService.getPlacesByDate(this.activeDate);
        // Group places by location
        this.groupPlacesByLocation();
        // Wait for the DOM to update before scrolling and rendering markers
        setTimeout(() => {
          this.scrollToActiveDate();
          this.renderToMarkers();
        }, 0);
      } else {
        this.places = [];
        this.locationGroups = [];
        this.renderToMarkers();
      }
    });

    // Initialize dates
    this.journeyDates = this.placesService.getAllDates();
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
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
    this.removeToMarkers();
  }

  initializeMap(): void {
    this.map = new mapboxgl.Map({
      container: this.mapContainer.nativeElement,
      style: 'mapbox://styles/mapbox/navigation-night-v1',
      center: this.initialCoordinates,
      zoom: 13
    });
    this.map.on('load', () => {
      this.renderToMarkers();
    });
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

  openDatePicker(event: MouseEvent): void {
    this.datePicker.open();
  }

  onDateSelected(event: any): void {
    if (event && event.value instanceof Date) {
      const selectedDate = event.value.toISOString().split('T')[0];
      if (!this.journeyDates.includes(selectedDate)) {
        this.journeyDates.push(selectedDate);
        this.journeyDates.sort();
      }
      this.placesService.setSelectedDate(selectedDate);
      this.placesService.addDate(selectedDate);
      this.pickerDate = null;
    }
  }

  onDatePickerClosed(): void {
    // Reset pickerDate when the date picker is closed
    this.pickerDate = null;
  }

  setActiveDate(date: string): void {
    this.placesService.setSelectedDate(date);
    this.selectedPlace = null; // Reset selected place when changing dates
    // Clear highlights when changing dates
    this.highlightedPlaces.clear();
    this.highlightedMarkerAlphabet = null;
    this.locationGroups.forEach(g => g.isHighlighted = false);
    // Wait for the DOM to update
    setTimeout(() => this.scrollToActiveDate(), 0);
  }

  selectPlace(place: Place): void {
    // Clear all group highlights
    this.highlightedPlaces.clear();
    this.locationGroups.forEach(g => g.isHighlighted = false);
    
    this.selectedPlace = this.selectedPlace === place ? null : place;
    
    if (this.selectedPlace) {
      // Find the group that contains this place and highlight its marker
      const group = this.locationGroups.find(g => g.places.includes(this.selectedPlace!));
      if (group) {
        this.highlightedMarkerAlphabet = group.alphabet;
      }
    } else {
      this.highlightedMarkerAlphabet = null;
    }
    
    this.updateMarkerHighlighting();
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

  addPlace(): void {
    if (this.activeDate) {
      this.router.navigate(['/place-editor'], {
        queryParams: { 
          date: this.activeDate,
          mode: 'add'
        }
      });
    }
  }

  editCard(): void {
    if (this.activeDate && this.selectedPlace) {
      this.router.navigate(['/place-editor'], {
        queryParams: { 
          date: this.activeDate,
          placeId: this.selectedPlace.id,
          mode: 'edit'
        }
      });
    }
  }

  removeCard(): void {
    if (this.activeDate && this.selectedPlace) {
      const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
        data: {
          title: 'Remove Place',
          message: 'Are you sure you want to remove this place?',
          confirmText: 'Yes, Remove',
          cancelText: 'No, Keep',
          isDestructive: true
        }
      });

      dialogRef.afterClosed().subscribe(result => {
        if (result) {
          this.placesService.removePlace(this.activeDate!, this.selectedPlace!.id);
          this.selectedPlace = null;
          this.places = this.placesService.getPlacesByDate(this.activeDate!);
        }
      });
    }
  }

  isEditRemoveDisabled(): boolean {
    return !this.selectedPlace;
  }

  onCancel(): void {
    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      data: {
        title: 'Cancel Activity',
        message: 'Are you sure you want to cancel this activity?',
        confirmText: 'Yes, Cancel',
        cancelText: 'No, Keep Editing',
        isDestructive: true
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.resetApplication();
      }
    });
  }

  onSubmit(): void {
    // Open the summary dialog instead of confirmation dialog
    const journeyDates = this.placesService.getAllDates();
    
    // Create a Map of places by date to pass to the summary component
    const placesByDate = new Map<string, Place[]>();
    journeyDates.forEach(date => {
      if (this.placesService.getPlacesByDate(date).length > 0) {
        placesByDate.set(date, this.placesService.getPlacesByDate(date));
      }
    });
    
    const dialogRef = this.dialog.open(SummaryComponent, {
      maxWidth: '95vw',
      maxHeight: '95vh',
      width: '90vw',
      height: '95vh',
      panelClass: 'summary-dialog',
      data: {
        journeyDates: Array.from(placesByDate.keys()),
        placesByDate
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.resetApplication();
      }
    });
  }

  private resetApplication(): void {
    // Clear all places and dates
    this.placesService.clearAllData();
    
    // Reset component state
    this.places = [];
    this.journeyDates = [];
    this.activeDate = null;
    this.selectedPlace = null;
    this.pickerDate = null;

    // Reset map view
    if (this.map) {
      this.map.setCenter(this.initialCoordinates);
      this.map.setZoom(13);
    }
  }

  private renderToMarkers(): void {
    if (!this.map) return;
    this.removeToMarkers();
    if (!this.locationGroups || this.locationGroups.length === 0) return;
    
    let bounds: mapboxgl.LngLatBounds | null = null;
    
    this.locationGroups.forEach((group) => {
      const el = document.createElement('div');
      el.className = 'custom-marker to-marker';
      el.innerHTML = group.alphabet;
      
      // Add badge if multiple places at same location
      if (group.places.length > 1) {
        const badge = document.createElement('span');
        badge.className = 'marker-badge';
        badge.textContent = group.places.length.toString();
        el.appendChild(badge);
      }
      
      // Add click event listener to marker
      el.addEventListener('click', (event) => {
        event.stopPropagation();
        this.onMarkerClick(group);
      });
      
      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat(group.coordinates)
        .addTo(this.map);
      this.toMarkers.push(marker);
      
      if (!bounds) {
        bounds = new mapboxgl.LngLatBounds(group.coordinates, group.coordinates);
      } else {
        bounds.extend(group.coordinates);
      }
    });
    
    if (bounds && this.toMarkers.length > 0) {
      this.map.fitBounds(bounds, { padding: 100, maxZoom: 15 });
    }
    
    // Apply initial highlighting
    this.updateMarkerHighlighting();
  }

  private removeToMarkers(): void {
    this.toMarkers.forEach(marker => marker.remove());
    this.toMarkers = [];
  }



  /**
   * Group places by location using the service
   */
  private groupPlacesByLocation(): void {
    this.locationGroups = this.placesService.groupPlacesByLocation(this.places, this.markerAlphabet);
  }

  /**
   * Handle marker click - toggle highlighting all places in the group
   */
  private onMarkerClick(group: LocationGroup): void {
    // Clear individual place selection when marker is clicked
    this.selectedPlace = null;
    
    if (group.isHighlighted) {
      // Remove highlighting
      this.highlightedPlaces.clear();
      this.highlightedMarkerAlphabet = null;
      group.isHighlighted = false;
    } else {
      // Clear previous highlights
      this.highlightedPlaces.clear();
      this.locationGroups.forEach(g => g.isHighlighted = false);
      
      // Add highlighting for this group
      group.places.forEach(place => this.highlightedPlaces.add(place.id));
      this.highlightedMarkerAlphabet = group.alphabet;
      group.isHighlighted = true;
    }
    
    this.updateMarkerHighlighting();
  }

  /**
   * Update marker highlighting without recreating markers
   */
  private updateMarkerHighlighting(): void {
    this.toMarkers.forEach((marker, index) => {
      const el = marker.getElement();
      if (!el) return;
      
      const group = this.locationGroups[index];
      if (this.highlightedMarkerAlphabet === group.alphabet) {
        el.classList.add('selected-marker');
      } else {
        el.classList.remove('selected-marker');
      }
    });
  }

  /**
   * Check if a place is highlighted
   */
  isPlaceHighlighted(place: Place): boolean {
    return this.highlightedPlaces.has(place.id);
  }
}
