import { Component, ElementRef, OnDestroy, OnInit, ViewChild, CUSTOM_ELEMENTS_SCHEMA, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import mapboxgl from 'mapbox-gl';
import { environment } from '../../../environments/environment';
import 'mapbox-gl/dist/mapbox-gl.css';

@Component({
  selector: 'app-address-lookup',
  standalone: true,
  imports: [CommonModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './address-lookup.component.html',
  styleUrl: './address-lookup.component.scss'
})
export class AddressLookupComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapContainer') mapContainer!: ElementRef;
  @ViewChild('addressSearch') addressSearch!: ElementRef;

  map!: mapboxgl.Map;
  marker: mapboxgl.Marker | null = null;
  selectedAddress: string = '';
  selectedCoordinates: [number, number] | null = null;
  initialCoordinates: [number, number] = [-87.65888830611969, 41.874497559910914]; // UIC Innovation Center
  userLocation: [number, number] | null = null;
  isSearchLoading = true;
  copySuccess = false;
  copyError = false;
  isLocatingUser = false;

  constructor() {}

  ngOnInit(): void {
    mapboxgl.accessToken = environment.mapboxToken;
    this.loadSearchScripts();
    this.getUserLocation();
  }

  ngAfterViewInit(): void {
    this.initializeMap();
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
    }
    if (this.marker) {
      this.marker.remove();
    }
  }

  initializeMap(): void {
    // Use user location if available, otherwise fall back to initial coordinates
    const mapCenter = this.userLocation || this.initialCoordinates;
    const mapZoom = 12;

    this.map = new mapboxgl.Map({
      container: this.mapContainer.nativeElement,
      style: 'mapbox://styles/mapbox/navigation-night-v1',
      center: mapCenter,
      zoom: mapZoom
    });

    // Ensure proximity follows the visible map center
    this.map.on('load', () => {
      this.updateSearchProximity();
    });
    this.map.on('moveend', () => {
      this.updateSearchProximity();
    });

    // Add click event to map to allow placing markers
    this.map.on('click', (e) => {
      this.placeMarkerAtCoordinates([e.lngLat.lng, e.lngLat.lat], 'click');
    });
  }

  loadSearchScripts(): void {
    const script = document.createElement('script');
    script.id = 'search-js';
    script.defer = true;
    script.src = 'https://api.mapbox.com/search-js/v1.0.0/web.js';
    script.onload = () => {
      this.initializeSearchBox();
    };
    document.head.appendChild(script);
  }

  initializeSearchBox(): void {
    if (this.addressSearch?.nativeElement) {
      if (customElements.get('mapbox-search-box')) {
        this.initializeSearchListener(this.addressSearch.nativeElement);
        this.isSearchLoading = false;
      } else {
        // If the custom element is not yet defined, wait a bit and try again
        setTimeout(() => this.initializeSearchBox(), 100);
      }
    }
  }

  private initializeSearchListener(searchBox: any): void {
    searchBox.accessToken = environment.mapboxToken;
    // Use current map center if available; otherwise user location or initial coordinates
    const currentCenter = this.map?.getCenter();
    const proximityCoordinates = currentCenter
      ? [currentCenter.lng, currentCenter.lat]
      : (this.userLocation || this.initialCoordinates);
    searchBox.options = {
      proximity: proximityCoordinates,
      types: ['address', 'poi', 'neighborhood', 'place', 'city']
    };

    // After searchbox is initialized, sync proximity once more
    this.updateSearchProximity();

    searchBox.addEventListener('retrieve', (event: any) => {
      const coordinates = event.detail?.features?.[0]?.geometry?.coordinates;
      const address = event.detail?.features?.[0]?.properties?.full_address;
      
      if (coordinates && address) {
        this.selectedAddress = address;
        this.selectedCoordinates = coordinates;
        // Keep the address provided by the search result (no reverse geocode override)
        this.placeMarkerAtCoordinates(coordinates, 'search');
      }
    });
  }

  /**
   * Keep the search results biased to the visible map center
   */
  private updateSearchProximity(): void {
    try {
      if (!this.map || !this.addressSearch?.nativeElement) return;
      const center = this.map.getCenter();
      const el: any = this.addressSearch.nativeElement;
      const prevOptions = el.options || {};
      el.options = { ...prevOptions, proximity: [center.lng, center.lat] };
    } catch (_) {
      // no-op: if search box not ready yet
    }
  }

  private placeMarkerAtCoordinates(
    coordinates: [number, number],
    source: 'click' | 'search' = 'click'
  ): void {
    // Remove existing marker if any
    if (this.marker) {
      this.marker.remove();
    }

    // Create new marker
    const el = document.createElement('div');
    el.className = 'custom-marker location-marker';
    el.innerHTML = '📍';

    this.marker = new mapboxgl.Marker({ element: el })
      .setLngLat(coordinates)
      .addTo(this.map);

    // Update coordinates
    this.selectedCoordinates = coordinates;

    // For user clicks (or any non-search source), reverse geocode to refresh address
    if (source === 'click') {
      this.reverseGeocode(coordinates);
    }

    // Center map on marker
    this.map.flyTo({
      center: coordinates,
      zoom: 15,
      duration: 1000
    });
  }

  private async reverseGeocode(coordinates: [number, number]): Promise<void> {
    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${coordinates[0]},${coordinates[1]}.json?access_token=${environment.mapboxToken}`
      );
      const data = await response.json();
      
      if (data.features && data.features.length > 0) {
        this.selectedAddress = data.features[0].place_name;
      }
    } catch (error) {
      console.error('Error reverse geocoding:', error);
      this.selectedAddress = `Location: ${coordinates[1].toFixed(6)}, ${coordinates[0].toFixed(6)}`;
    }
  }

  async copyAddress(): Promise<void> {
    if (!this.selectedAddress) {
      return;
    }

    this.copySuccess = false;
    this.copyError = false;

    try {
      // Try modern clipboard API first
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(this.selectedAddress);
        this.copySuccess = true;
      } else {
        // Fallback to execCommand method
        const textArea = document.createElement('textarea');
        textArea.value = this.selectedAddress;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        
        if (successful) {
          this.copySuccess = true;
        } else {
          this.copyError = true;
        }
      }
    } catch (error) {
      console.error('Failed to copy address:', error);
      this.copyError = true;
    }

    // Clear success/error message after 3 seconds
    setTimeout(() => {
      this.copySuccess = false;
      this.copyError = false;
    }, 3000);
  }

  clearSelection(): void {
    this.selectedAddress = '';
    this.selectedCoordinates = null;
    if (this.marker) {
      this.marker.remove();
      this.marker = null;
    }
    this.copySuccess = false;
    this.copyError = false;

    // Reset map view to user location if available, otherwise to initial coordinates
    const resetCenter = this.userLocation || this.initialCoordinates;
    const resetZoom = this.userLocation ? 14 : 13;
    
    this.map.flyTo({
      center: resetCenter,
      zoom: resetZoom,
      duration: 1000
    });
  }

  /**
   * Get user's current location using the Geolocation API
   */
  private getUserLocation(): void {
    if (!navigator.geolocation) {
      console.log('Geolocation is not supported by this browser. Using default location.');
      return;
    }

    this.isLocatingUser = true;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        // Success - store user location
        this.userLocation = [position.coords.longitude, position.coords.latitude];
        this.isLocatingUser = false;
        console.log('User location acquired:', this.userLocation);

        // If map is already initialized, update its center
        if (this.map) {
          this.map.flyTo({
            center: this.userLocation,
            zoom: 13,
            duration: 1500
          });
          // Update search proximity to follow the new center
          this.updateSearchProximity();
        }
      },
      (error) => {
        // Error or denied - fall back to default location
        this.isLocatingUser = false;
        console.log('Geolocation error, using default location:', error.message);
        // We'll use initialCoordinates as fallback (already set)
      },
      {
        enableHighAccuracy: false,
        timeout: 5000,
        maximumAge: 0
      }
    );
  }
}

