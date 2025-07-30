import { Component, OnInit, Inject, ViewChild, ElementRef, OnDestroy, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { animate, style, transition, trigger } from '@angular/animations';
import { Place, PlacesService, LocationGroup } from '../../services/places.service';
import mapboxgl from 'mapbox-gl';
import { environment } from '../../../environments/environment';
import 'mapbox-gl/dist/mapbox-gl.css';

interface SummaryData {
  journeyDates: string[];
  placesByDate: Map<string, Place[]>;
}

@Component({
  selector: 'app-summary',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule
  ],
  animations: [
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('300ms ease-in', style({ opacity: 1 }))
      ])
    ]),
    trigger('slideIn', [
      transition(':enter', [
        style({ transform: 'translateY(20px)', opacity: 0 }),
        animate('300ms ease-out', style({ transform: 'translateY(0)', opacity: 1 }))
      ])
    ])
  ],
  templateUrl: './summary.component.html',
  styleUrl: './summary.component.scss'
})
export class SummaryComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapContainer') mapContainer!: ElementRef;
  
  journeyDates: string[] = [];
  placesByDate: Map<string, Place[]> = new Map();
  allPlaces: Place[] = [];
  totalPlaces = 0;
  map!: mapboxgl.Map;
  private poiMarkers: mapboxgl.Marker[] = [];
  private markerAlphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  initialCoordinates: [number, number] = [-87.65888830611969, 41.874497559910914]; // UIC Innovation Center Coordinates
  selectedPlaceId: string | null = null;
  
  // New properties for location grouping
  locationGroups: LocationGroup[] = [];
  private expandedPlaceIds: Set<string> = new Set();
  private highlightedMarkerAlphabet: string | null = null;
  private highlightedPlaceIds: Set<string> = new Set(); // Track highlighted cards from marker clicks
  
  constructor(
    public dialogRef: MatDialogRef<SummaryComponent>,
    @Inject(MAT_DIALOG_DATA) public data: SummaryData,
    private placesService: PlacesService
  ) {}

  ngOnInit(): void {
    this.journeyDates = this.data.journeyDates;
    this.placesByDate = this.data.placesByDate;
    
    // Calculate total places and create flat array of all places
    this.totalPlaces = Array.from(this.placesByDate.values())
      .reduce((total, places) => total + places.length, 0);
    
    // Create a flat array of all places in order
    this.allPlaces = [];
    this.journeyDates.forEach(date => {
      const places = this.placesByDate.get(date) || [];
      this.allPlaces.push(...places);
    });
    
    // Group places by location
    this.groupPlacesByLocation();
  }

  ngAfterViewInit(): void {
    this.initializeMap();
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
    }
    this.removePoiMarkers();
  }

  /**
   * Group places by location using the service
   */
  private groupPlacesByLocation(): void {
    this.locationGroups = this.placesService.groupPlacesByLocation(this.allPlaces, this.markerAlphabet);
  }

  initializeMap(): void {
    mapboxgl.accessToken = environment.mapboxToken;
    this.map = new mapboxgl.Map({
      container: this.mapContainer.nativeElement,
      style: 'mapbox://styles/mapbox/navigation-night-v1',
      center: this.initialCoordinates,
      zoom: 13
    });
    
    this.map.on('load', () => {
      // Ensure mapboxgl-map class is maintained (fix for marker drift issue #4048)
      this.mapContainer.nativeElement.classList.add('mapboxgl-map');
      this.renderPoiMarkers();
    });
  }

  private renderPoiMarkers(): void {
    if (!this.map) return;
    this.removePoiMarkers();
    if (!this.locationGroups || this.locationGroups.length === 0) return;
    
    let bounds: mapboxgl.LngLatBounds | null = null;
    
    this.locationGroups.forEach((group) => {
      const el = document.createElement('div');
      el.className = 'custom-marker poi-marker';
      el.innerHTML = group.alphabet;
      
      // Add badge if multiple places at this location
      if (group.places.length > 1) {
        const badge = document.createElement('div');
        badge.className = 'marker-badge';
        badge.textContent = group.places.length.toString();
        el.appendChild(badge);
      }
      
      // Add click event listener to marker
      el.addEventListener('click', (event) => {
        event.stopPropagation();
        this.onMarkerClick(group);
      });
      
      const marker = new mapboxgl.Marker(el, { 
        offset: [-16, -16]  // Center the marker properly
      })
        .setLngLat(group.coordinates)
        .addTo(this.map);
      
      this.poiMarkers.push(marker);
      
      if (!bounds) {
        bounds = new mapboxgl.LngLatBounds(group.coordinates, group.coordinates);
      } else {
        bounds.extend(group.coordinates);
      }
    });
    
    if (bounds && this.poiMarkers.length > 0) {
      this.map.fitBounds(bounds, { padding: 100, maxZoom: 15 });
    }
    
    // Apply initial highlighting
    this.updateMarkerHighlighting();
  }

  private removePoiMarkers(): void {
    this.poiMarkers.forEach(marker => marker.remove());
    this.poiMarkers = [];
  }

  /**
   * Update marker highlighting without recreating markers
   */
  private updateMarkerHighlighting(): void {
    this.poiMarkers.forEach((marker, index) => {
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
   * Handle marker click - only highlight related cards, don't expand them
   */
  private onMarkerClick(group: LocationGroup): void {
    // Clear previous highlights
    this.highlightedPlaceIds.clear();
    
    // Toggle highlighting for this group
    if (this.highlightedMarkerAlphabet === group.alphabet) {
      // If this marker was already highlighted, unhighlight it
      this.highlightedMarkerAlphabet = null;
    } else {
      // Highlight this marker and its related cards
      this.highlightedMarkerAlphabet = group.alphabet;
      group.places.forEach(place => this.highlightedPlaceIds.add(place.id!));
    }
    
    // Update marker highlighting
    this.updateMarkerHighlighting();
  }

  private zoomToPlace(place: Place): void {
    if (!this.map || !place.poiCoordinates || !Array.isArray(place.poiCoordinates) || place.poiCoordinates.length !== 2) {
      return;
    }
    
    this.map.easeTo({
      center: place.poiCoordinates,
      zoom: 16,
      duration: 1000
    });
  }

  private resetMapView(): void {
    if (!this.map || this.locationGroups.length === 0) return;
    
    let bounds: mapboxgl.LngLatBounds | null = null;
    
    this.locationGroups.forEach((group) => {
      if (!bounds) {
        bounds = new mapboxgl.LngLatBounds(group.coordinates, group.coordinates);
      } else {
        bounds.extend(group.coordinates);
      }
    });
    
    if (bounds && this.poiMarkers.length > 0) {
      this.map.fitBounds(bounds, { padding: 100, maxZoom: 15, duration: 1000 });
    }
  }

  getPlaceAlphabet(place: Place): string {
    const group = this.locationGroups.find(g => g.places.includes(place));
    return group ? group.alphabet : 'A';
  }

  togglePlaceExpansion(place: Place): void {
    const wasExpanded = this.expandedPlaceIds.has(place.id!);
    
    if (wasExpanded) {
      // Collapse this place
      this.expandedPlaceIds.delete(place.id!);
    } else {
      // Close all other places and expand this one (accordion behavior)
      this.expandedPlaceIds.clear();
      this.expandedPlaceIds.add(place.id!);
    }
    
    // Clear any marker highlighting when cards are clicked
    this.highlightedMarkerAlphabet = null;
    this.highlightedPlaceIds.clear();
    this.updateMarkerHighlighting();
  }

  isPlaceExpanded(place: Place): boolean {
    return this.expandedPlaceIds.has(place.id!);
  }

  isPlaceHighlighted(place: Place): boolean {
    return this.highlightedPlaceIds.has(place.id!);
  }

  getVisualizationData(place: Place, type: string): { 
    barNumber: number | null, 
    leftLabel: string, 
    rightLabel: string,
    hasData: boolean 
  } {
    // Use stored visualization data from the place object
    const storedData = place.geoVisualization?.[type as keyof typeof place.geoVisualization];
    
    if (storedData) {
      return storedData;
    }
    
    // Fallback for places that don't have stored visualization data
    return { 
      barNumber: null, 
      leftLabel: '', 
      rightLabel: '', 
      hasData: false 
    };
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }

  onSubmit(): void {
    this.downloadAsCSV();
    this.dialogRef.close(true);
  }

  // Format time for display
  formatTime(time: string): string {
    if (!time) return '';
    
    try {
      const [hour, minute] = time.split(':').map(part => parseInt(part, 10));
      if (isNaN(hour) || isNaN(minute)) return time;
      
      const period = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 || 12;
      return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
    } catch {
      return time;
    }
  }

  public downloadAsCSV(): void {
    // Define the CSV headers with more detailed information
    const headers = [
      'Date', 
      'Activity Number', 
      'Activity Type', 
      'Place Name', 
      'From Address',
      'From Address Coordinates',
      'Leave Time',
      'POI Address',
      'POI Coordinates',
      'POI GeoID',
      'Duration at POI (minutes)',
      'To Address',
      'To Address Coordinates',
      'Arrive Time',
      'Transportation', 
      'Feeling',
      'Emotion Grid Coordinates', 
      'Comments',
      'NDI (Neighborhood Deprivation Index)',
      'TES (Tree Equity Score)',
      'MHLTH (Mental Health Crude Prevalence)'
    ];
    
    // Create CSV content starting with headers
    let csvContent = headers.join(',') + '\n';
    
    // Add data rows
    this.journeyDates.forEach(date => {
      const places = this.placesByDate.get(date) || [];
      places.forEach((place, index) => {
        // Format coordinates as "lat,lng" strings
        const fromCoords = place.fromCoordinates ? 
          `"${place.fromCoordinates[1]},${place.fromCoordinates[0]}"` : '';
        const poiCoords = place.poiCoordinates ? 
          `"${place.poiCoordinates[1]},${place.poiCoordinates[0]}"` : '';
        const toCoords = place.toCoordinates ? 
          `"${place.toCoordinates[1]},${place.toCoordinates[0]}"` : '';
        
        // Format emotion text and coordinates
        const emotionText = place.emotion ? (place.emotion.text) : '';
        const emotionCoords = place.emotion ? 
          `"(${place.emotion.x.toFixed(3)},${place.emotion.y.toFixed(3)})"` : '';
        
        // Format geo values
        const ndiValue = place.geoValues?.NDI ? place.geoValues.NDI.toString() : '';
        const tesValue = place.geoValues?.tes ? place.geoValues.tes.toString() : '';
        const mhlthValue = place.geoValues?.MHLTH_CrudePrev ? place.geoValues.MHLTH_CrudePrev.toString() : '';

        const rowData = [
          date,
          (index + 1).toString(),
          this.escapeCSVField(place.activityType),
          this.escapeCSVField(place.placeLabel || ''),
          this.escapeCSVField(place.fromAddress),
          fromCoords,
          this.escapeCSVField(place.leaveTime || ''),
          this.escapeCSVField(place.poiAddress),
          poiCoords,
          this.escapeCSVField(place.geoId || ''),
          place.timeSpentAtPoi ? place.timeSpentAtPoi.toString() : '',
          this.escapeCSVField(place.toAddress),
          toCoords,
          this.escapeCSVField(place.arriveTime || ''),
          this.escapeCSVField(place.transportType),
          this.escapeCSVField(emotionText),
          emotionCoords,
          this.escapeCSVField(place.comments || ''),
          ndiValue,
          tesValue,
          mhlthValue
        ];
        csvContent += rowData.join(',') + '\n';
      });
    });
    
    // Create a Blob with the CSV content
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    
    // Generate a unique timestamp for the filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `CHA_Mapping_${timestamp}.csv`;
    
    // Create a download link and trigger the download
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
  
  private escapeCSVField(field: string): string {
    // If the field contains commas, quotes, or newlines, wrap it in quotes
    // and escape any existing quotes
    if (field && (field.includes(',') || field.includes('"') || field.includes('\n'))) {
      return '"' + field.replace(/"/g, '""') + '"';
    }
    return field;
  }
} 