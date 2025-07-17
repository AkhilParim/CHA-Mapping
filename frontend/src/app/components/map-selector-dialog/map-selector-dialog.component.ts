import { Component, ElementRef, Inject, OnDestroy, OnInit, AfterViewInit, ViewChild, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import mapboxgl from 'mapbox-gl';
import { environment } from '../../../environments/environment';
import 'mapbox-gl/dist/mapbox-gl.css';

export interface MapSelectorData {
  addressType: 'from' | 'poi' | 'to';
  currentCoordinates?: [number, number];
  currentAddress?: string;
}

export interface MapSelectorResult {
  coordinates: [number, number];
  address: string;
}

@Component({
  selector: 'app-map-selector-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatProgressSpinnerModule
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <div class="map-selector-dialog">
      <h2 mat-dialog-title>Select {{getAddressTypeLabel()}} Location</h2>
      
      <div mat-dialog-content class="dialog-content">
        <div class="instructions">
          <p>Click anywhere on the map to select a location</p>
        </div>
        
        <div class="map-container">
          <div #mapContainer class="map"></div>
        </div>
        
        <div class="address-preview" *ngIf="selectedAddress && !isLoadingAddress">
          <div class="address-info">
            <strong>Selected Address:</strong>
            <p>{{ selectedAddress }}</p>
          </div>
        </div>
        
        <div class="loading-section" *ngIf="isLoadingAddress">
          <mat-spinner diameter="20"></mat-spinner>
          <span>Getting address...</span>
        </div>
      </div>
      
      <div mat-dialog-actions align="end">
        <button mat-button (click)="onCancel()">Cancel</button>
        <button mat-raised-button 
                color="primary" 
                [disabled]="!selectedCoordinates || isLoadingAddress"
                (click)="onConfirm()">
          Confirm Location
        </button>
      </div>
    </div>
  `,
  styles: [`
    .map-selector-dialog {
      width: 100%;
      height: 100%;
    }

    .dialog-content {
      padding: 0;
      margin: 0;
      height: 60vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .instructions {
      padding: 12px 16px;
      background-color: #f5f5f5;
      border-bottom: 1px solid #ddd;
      margin: 0;
      flex-shrink: 0;
      
      p {
        margin: 0;
        color: #666;
        font-size: 13px;
      }
    }

    .map-container {
      flex: 1;
      position: relative;
      min-height: 200px;
    }

    .map {
      width: 100%;
      height: 100%;
    }

    ::ng-deep .mapboxgl-canvas-container .mapboxgl-canvas {
      cursor: url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJDOC4xMyAyIDUgNS4xMyA1IDlDNSAxNC4yNSAxMiAyMiAxMiAyMkMxMiAyMiAxOSAxNC4yNSAxOSA5QzE5IDUuMTMgMTUuODcgMiAxMiAyWiIgZmlsbD0iIzk5OTk5OSIgZmlsbC1vcGFjaXR5PSIwLjciLz4KPGNpcmNsZSBjeD0iMTIiIGN5PSI5IiByPSIyLjUiIGZpbGw9IndoaXRlIi8+Cjwvc3ZnPgo=') 12 22, crosshair !important;
    }

    .address-preview {
      padding: 12px 16px;
      border-top: 1px solid #ddd;
      background-color: #f9f9f9;
      flex-shrink: 0;
      
      .address-info {
        strong {
          color: #333;
          font-size: 13px;
        }
        
        p {
          margin: 4px 0 0 0;
          color: #666;
          font-size: 12px;
          line-height: 1.3;
        }
      }
    }

    .loading-section {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      border-top: 1px solid #ddd;
      background-color: #f9f9f9;
      flex-shrink: 0;
      
      span {
        color: #666;
        font-size: 13px;
      }
    }

    ::ng-deep .mat-mdc-dialog-title::before {
        display: none;
    }

    ::ng-deep .cdk-overlay-pane .mat-mdc-dialog-panel {
      height: auto !important;
      max-height: 85vh !important;
      max-width: 90vw !important;
    }

    ::ng-deep .mat-mdc-dialog-container .mdc-dialog__surface {
      height: auto !important;
      max-width: 90vw !important;
      max-height: 85vh !important;
    }

    ::ng-deep .mat-mdc-dialog-content {
      padding: 0 !important;
      overflow: hidden !important;
    }

    ::ng-deep .mat-mdc-dialog-title {
      padding: 16px 24px 12px 24px !important;
      margin: 0 !important;
      font-size: 18px !important;
      font-weight: 500 !important;
    }

    ::ng-deep .mat-mdc-dialog-actions {
      padding: 12px 24px 16px 24px !important;
      margin: 0 !important;
      min-height: auto !important;
    }

    .custom-marker {
      width: 32px;
      height: 32px;
      cursor: pointer;
      filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
      
      svg {
        width: 100%;
        height: 100%;
      }
    }

    @media (max-width: 768px) {
      .dialog-content {
        height: 55vh;
      }
      
      ::ng-deep .cdk-overlay-pane .mat-mdc-dialog-panel {
        max-height: 80vh !important;
      }
      
      ::ng-deep .mat-mdc-dialog-container .mdc-dialog__surface {
        max-height: 80vh !important;
      }
    }
  `]
})
export class MapSelectorDialogComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapContainer') mapContainer!: ElementRef;

  map!: mapboxgl.Map;
  selectedCoordinates: [number, number] | null = null;
  selectedAddress: string | null = null;
  isLoadingAddress = false;
  currentMarker: mapboxgl.Marker | null = null;
  
  private readonly initialCoordinates: [number, number] = [-87.65888830611969, 41.874497559910914]; // UIC Innovation Center

  constructor(
    public dialogRef: MatDialogRef<MapSelectorDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: MapSelectorData
  ) {}

  ngOnInit(): void {
    mapboxgl.accessToken = environment.mapboxToken;
  }

  ngAfterViewInit(): void {
    this.initializeMap();
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
    }
  }

  private initializeMap(): void {
    const center = this.data.currentCoordinates || this.initialCoordinates;
    
    this.map = new mapboxgl.Map({
      container: this.mapContainer.nativeElement,
      style: 'mapbox://styles/mapbox/navigation-night-v1',
      center: center,
      zoom: 13
    });

    this.map.on('load', () => {
      // Show existing marker if there are current coordinates
      if (this.data.currentCoordinates) {
        this.setMarker(this.data.currentCoordinates);
        this.selectedCoordinates = this.data.currentCoordinates;
        this.selectedAddress = this.data.currentAddress || null;
      }
      
      // Add click event listener after map is loaded
      this.map.on('click', (event) => {
        const coordinates: [number, number] = [event.lngLat.lng, event.lngLat.lat];
        this.setMarker(coordinates);
        this.selectedCoordinates = coordinates;
        this.reverseGeocode(coordinates);
      });
    });
  }

  private setMarker(coordinates: [number, number]): void {
    // Remove existing marker
    if (this.currentMarker) {
      this.currentMarker.remove();
      this.currentMarker = null;
    }

    // Create new marker element with SVG
    const el = document.createElement('div');
    el.className = 'custom-marker';
    el.style.width = '32px';
    el.style.height = '32px';
    el.style.cursor = 'pointer';
    
    // Create SVG location pin
    el.innerHTML = `
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13 15.87 2 12 2Z" 
              fill="#ff4444" 
              stroke="white" 
              stroke-width="1"/>
        <circle cx="12" cy="9" r="2.5" fill="white"/>
      </svg>
    `;
    
    // Create and add marker to map
    this.currentMarker = new mapboxgl.Marker({ 
      element: el,
      anchor: 'bottom'
    })
      .setLngLat(coordinates)
      .addTo(this.map);
  }

  private async reverseGeocode(coordinates: [number, number]): Promise<void> {
    this.isLoadingAddress = true;
    this.selectedAddress = null;

    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${coordinates[0]},${coordinates[1]}.json?access_token=${environment.mapboxToken}&types=address,poi,neighborhood,place`
      );

      if (!response.ok) {
        throw new Error('Failed to reverse geocode');
      }

      const data = await response.json();
      
      if (data.features && data.features.length > 0) {
        this.selectedAddress = data.features[0].place_name;
      } else {
        this.selectedAddress = `${coordinates[1].toFixed(6)}, ${coordinates[0].toFixed(6)}`;
      }
    } catch (error) {
      console.error('Error reverse geocoding:', error);
      this.selectedAddress = `${coordinates[1].toFixed(6)}, ${coordinates[0].toFixed(6)}`;
    } finally {
      this.isLoadingAddress = false;
    }
  }

  getAddressTypeLabel(): string {
    switch (this.data.addressType) {
      case 'from': return 'From (A)';
      case 'poi': return 'Point of Interest (B)';
      case 'to': return 'To (C)';
      default: return 'Location';
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onConfirm(): void {
    if (this.selectedCoordinates && this.selectedAddress) {
      const result: MapSelectorResult = {
        coordinates: this.selectedCoordinates,
        address: this.selectedAddress
      };
      this.dialogRef.close(result);
    }
  }
} 