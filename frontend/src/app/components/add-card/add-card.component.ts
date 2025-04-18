import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import mapboxgl from 'mapbox-gl';
import { environment } from '../../../environments/environment';
import 'mapbox-gl/dist/mapbox-gl.css';

interface EmotionState {
  x: number;
  y: number;
  emoji: string;
}

@Component({
  selector: 'app-add-card',
  standalone: true,
  imports: [CommonModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './add-card.component.html',
  styleUrl: './add-card.component.scss'
})
export class AddCardComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapContainer') mapContainer!: ElementRef;
  @ViewChild('fromAddressSearch') fromAddressSearch!: ElementRef;
  @ViewChild('toAddressSearch') toAddressSearch!: ElementRef;
  @ViewChild('emotionGrid') emotionGrid!: ElementRef;

  map!: mapboxgl.Map;
  fromMarker: mapboxgl.Marker | null = null;
  toMarker: mapboxgl.Marker | null = null;
  initialCoordinates: [number, number] = [-87.65888830611969, 41.874497559910914]; // Default coordinates to UIC Innovation Center
  isSearchLoading = true;

  // Emotion grid properties
  showCrosshair = false;
  crosshairX = 0;
  crosshairY = 0;
  selectedX = 0;
  selectedY = 0;
  selectedEmotion: EmotionState | null = null;

  ngOnInit(): void {
    mapboxgl.accessToken = environment.mapboxToken;
    this.loadMapboxSearch();
  }

  ngAfterViewInit(): void {
    this.initializeMap();
    this.initializeEmotionGrid();
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
    }
    this.removeMarkers();
  }

  removeMarkers(): void {
    if (this.fromMarker) {
      this.fromMarker.remove();
    }
    if (this.toMarker) {
      this.toMarker.remove();
    }
  }

  loadMapboxSearch(): void {
    const script = document.createElement('script');
    script.id = 'search-js';
    script.defer = true;
    script.src = 'https://api.mapbox.com/search-js/v1.0.0/web.js';
    script.onload = () => {
      this.initializeSearchBox();
    };
    document.head.appendChild(script);
  }

  initializeMap(): void {
    this.map = new mapboxgl.Map({
      container: this.mapContainer.nativeElement,
      style: 'mapbox://styles/mapbox/navigation-night-v1',
      center: this.initialCoordinates,
      zoom: 13
    });
  }

  createMarker(coordinates: [number, number], isFromMarker: boolean): mapboxgl.Marker {
    const el = document.createElement('div');
    el.className = `custom-marker ${isFromMarker ? 'from-marker' : 'to-marker'}`;
    el.innerHTML = isFromMarker ? 'A' : 'B';

    return new mapboxgl.Marker({
      element: el
    })
      .setLngLat(coordinates)
      .addTo(this.map);
  }

  fitMapToMarkers(): void {
    if (!this.fromMarker && !this.toMarker) return;

    const bounds = new mapboxgl.LngLatBounds();
    
    if (this.fromMarker) {
      bounds.extend(this.fromMarker.getLngLat());
    }
    if (this.toMarker) {
      bounds.extend(this.toMarker.getLngLat());
    }

    this.map.fitBounds(bounds, {
      padding: 100, // Add some padding around the markers
      maxZoom: 15   // Limit maximum zoom level  // TODO: Might need to remove the maxZoom
    });
  }

  initializeSearchBox(): void {
    if (this.fromAddressSearch?.nativeElement && this.toAddressSearch?.nativeElement) {
      if (customElements.get('mapbox-search-box')) {
        // Initialize "From" search box
        const fromSearchBox = this.fromAddressSearch.nativeElement;
        fromSearchBox.accessToken = environment.mapboxToken;
        fromSearchBox.options = {
          proximity: this.initialCoordinates,  // TODO: Make the proximity based on the maps current location
          types: ['address', 'poi', 'neighborhood', 'place', 'city']
        };
        fromSearchBox.addEventListener('retrieve', (event: any) => {
          const coordinates = event.detail?.features?.[0]?.geometry?.coordinates;
          if (coordinates) {
            if (this.fromMarker) {
              this.fromMarker.remove();
            }
            this.fromMarker = this.createMarker(coordinates, true);
            this.fitMapToMarkers();
          }
        });

        // Initialize "To" search box
        const toSearchBox = this.toAddressSearch.nativeElement;
        toSearchBox.accessToken = environment.mapboxToken;
        toSearchBox.options = {
          proximity: this.initialCoordinates,
          types: ['address', 'poi', 'neighborhood', 'place', 'city']
        };
        toSearchBox.addEventListener('retrieve', (event: any) => {
          const coordinates = event.detail?.features?.[0]?.geometry?.coordinates;
          if (coordinates) {
            if (this.toMarker) {
              this.toMarker.remove();
            }
            this.toMarker = this.createMarker(coordinates, false);
            this.fitMapToMarkers();
          }
        });
        this.isSearchLoading = false;
      } else {
        // If the custom element is not yet defined, wait a bit and try again
        setTimeout(() => this.initializeSearchBox(), 100);
      }
    }
  }

  private initializeEmotionGrid(): void {
    const grid = this.emotionGrid.nativeElement;
    
    grid.addEventListener('mousemove', (e: MouseEvent) => {
      const rect = grid.getBoundingClientRect();
      this.showCrosshair = true;
      this.crosshairX = e.clientX - rect.left;
      this.crosshairY = e.clientY - rect.top;
    });

    grid.addEventListener('mouseleave', () => {
      this.showCrosshair = false;
    });

    grid.addEventListener('click', (e: MouseEvent) => {
      const rect = grid.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      // Calculate emotion based on position
      const xPercent = x / rect.width;
      const yPercent = y / rect.height;
      
      this.selectedX = x;
      this.selectedY = y;
      this.selectedEmotion = {
        x: xPercent,
        y: yPercent,
        emoji: this.getEmotionEmoji(xPercent, yPercent)
      };
    });
  }

  private getEmotionEmoji(x: number, y: number): string {
    // Create more granular emotion mapping based on position
    // x: 0 = dissatisfied, 1 = satisfied
    // y: 0 = calm, 1 = stressed
    
    // Divide the grid into a 3x3 matrix for more nuanced emotions
    if (x < 0.33) {
      if (y < 0.33) return '😌'; // Very calm but dissatisfied
      if (y < 0.66) return '😕'; // Neutral stress but dissatisfied
      return '😫'; // Very stressed and dissatisfied
    } else if (x < 0.66) {
      if (y < 0.33) return '😐'; // Very calm and neutral satisfaction
      if (y < 0.66) return '😶'; // Neutral stress and satisfaction
      return '😰'; // Very stressed and neutral satisfaction
    } else {
      if (y < 0.33) return '😊'; // Very calm and satisfied
      if (y < 0.66) return '🙂'; // Neutral stress and satisfied
      return '😅'; // Very stressed but satisfied
    }
  }
}
