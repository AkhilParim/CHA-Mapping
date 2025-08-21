import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { Subscription } from 'rxjs';
import { ConfirmationDialogComponent } from '../confirmation-dialog/confirmation-dialog.component';
import { GeoInfoModalComponent } from '../geo-info-modal/geo-info-modal.component';
import { MapSelectorDialogComponent, MapSelectorData, MapSelectorResult } from '../map-selector-dialog/map-selector-dialog.component';
import mapboxgl from 'mapbox-gl';
import { environment } from '../../../environments/environment';
import 'mapbox-gl/dist/mapbox-gl.css';
import { PlacesService } from '../../services/places.service';
import { GeojsonService } from '../../services/geojson.service';
import { ConfigurationService } from '../../services/configuration.service';
import { HttpClientModule } from '@angular/common/http';
import { Collection } from '../../services/geojson.service';

interface EmotionState {
  x: number; // normalized coordinate: -1 to 1 (left to right)
  y: number; // normalized coordinate: -1 to 1 (top to bottom)
  text: string; // descriptive text of the emotion
}

interface PlaceFormData {
  id?: string;
  placeLabel: string;
  fromAddress: string;
  fromCoordinates: [number, number];
  leaveTime: string;
  poiAddress: string;
  poiCoordinates: [number, number];
  timeSpentAtPoi: number;
  toAddress: string;
  toCoordinates: [number, number];
  arriveTime: string;
  date: string;
  activityType: string;
  transportType: string;
  comments: string;
  geoId?: string;
  emotion?: EmotionState | null;
  geoVisualization?: {
    NDI?: {
      barNumber: number | null;
      leftLabel: string;
      rightLabel: string;
      hasData: boolean;
    };
    tes?: {
      barNumber: number | null;
      leftLabel: string;
      rightLabel: string;
      hasData: boolean;
    };
    MHLTH_CrudePrev?: {
      barNumber: number | null;
      leftLabel: string;
      rightLabel: string;
      hasData: boolean;
    };
  };
  geoValues?: {
    NDI?: number | null;
    tes?: number | null;
    MHLTH_CrudePrev?: number | null;
  };
}

@Component({
  selector: 'app-place-editor',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatDialogModule, HttpClientModule],
  providers: [GeojsonService, ConfigurationService],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './place-editor.component.html',
  styleUrl: './place-editor.component.scss'
})
export class PlaceEditorComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapContainer') mapContainer!: ElementRef;
  @ViewChild('fromAddressSearch') fromAddressSearch!: ElementRef;
  @ViewChild('poiAddressSearch') poiAddressSearch!: ElementRef;
  @ViewChild('toAddressSearch') toAddressSearch!: ElementRef;
  @ViewChild('emotionGrid') emotionGrid!: ElementRef;

  placeForm!: FormGroup;
  map!: mapboxgl.Map;
  fromMarker: mapboxgl.Marker | null = null;
  poiMarker: mapboxgl.Marker | null = null;
  toMarker: mapboxgl.Marker | null = null;
  initialCoordinates: [number, number] = [-87.65888830611969, 41.874497559910914];  // Default coordinates to UIC Innovation Center
  isSearchLoading = true;
  isEditMode = false;
  originalDate: string | null = null;
  formErrors: { [key: string]: string } = {};
  formSubmitted = false;
  geoProperties: Collection | null = null;
  currentGeoId: string | null = null;
  showGeoInfo = false;
  loadedGeoJsonData = false;
  geoJsonLoadError = false;

  // Store calculated visualization data
  visualizationData = {
    NDI: { barNumber: null as number | null, leftLabel: '', rightLabel: '', hasData: false },
    tes: { barNumber: null as number | null, leftLabel: '', rightLabel: '', hasData: false },
    MHLTH_CrudePrev: { barNumber: null as number | null, leftLabel: '', rightLabel: '', hasData: false }
  };

  activityTypes: string[] = [];
  transportTypes: string[] = [];
  // Emotion labels from configuration
  emotionLabelTop: string = '';
  emotionLabelRight: string = '';
  emotionLabelBottom: string = '';
  emotionLabelLeft: string = '';

  // Emotion grid properties
  showCrosshair = false;
  crosshairPosition = { x: 0, y: 0 };
  selectedEmotion: EmotionState | null = null;
  private resizeHandler?: () => void;
  private configSubscription?: Subscription;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    public router: Router,
    private placesService: PlacesService,
    private dialog: MatDialog,
    public geojsonService: GeojsonService,
    public configurationService: ConfigurationService
  ) {
    this.initializeForm();
  }

  private initializeForm(): void {
    this.loadGeoJsonData();

    const today = new Date();
    this.placeForm = this.fb.group({
      fromAddress: ['', Validators.required],
      fromCoordinates: [null, Validators.required],
      leaveTime: ['', Validators.required],
      poiAddress: ['', Validators.required],
      poiCoordinates: [null, Validators.required],
      timeSpentAtPoi: [0, [Validators.required, Validators.min(1)]],
      toAddress: ['', Validators.required],
      toCoordinates: [null, Validators.required],
      arriveTime: ['', Validators.required],
      date: [today.toISOString().split('T')[0], Validators.required],
      activityType: ['', Validators.required],
      transportType: ['', Validators.required],
      placeLabel: ['', Validators.required],
      comments: [''],
      emotion: [null]
    });

    // Subscribe to form changes for real-time validation
    this.placeForm.valueChanges.subscribe(() => {
      if (this.formSubmitted) {
        this.validateForm();
      }
    });

    // Get date and place ID from URL parameters
    this.route.queryParams.subscribe(params => {
      if (params['date']) {
        this.placeForm.patchValue({ date: params['date'] });
        this.originalDate = params['date'];
      }
      
      if (params['mode'] === 'edit' && params['placeId']) {
        this.isEditMode = true;
        const place = this.placesService.getPlaceById(params['date'], params['placeId']);
        if (place) {
          this.placeForm.patchValue({
            placeLabel: place.placeLabel || '',
            fromAddress: place.fromAddress,
            fromCoordinates: place.fromCoordinates,
            leaveTime: place.leaveTime,
            poiAddress: place.poiAddress,
            poiCoordinates: place.poiCoordinates,
            timeSpentAtPoi: place.timeSpentAtPoi,
            toAddress: place.toAddress,
            toCoordinates: place.toCoordinates,
            arriveTime: place.arriveTime,
            date: place.date,
            activityType: place.activityType,
            transportType: place.transportType,
            comments: place.comments,
            emotion: place.emotion || null
          });

          // Set up markers after form is initialized
          setTimeout(() => {
            if (place.fromCoordinates) {
              this.fromMarker = this.createMarker(place.fromCoordinates, 'from');
            }
            if (place.poiCoordinates) {
              this.poiMarker = this.createMarker(place.poiCoordinates, 'poi');
              // Set geo properties for edit mode (visualization calculation will happen after GeoJSON loads)
              if (this.loadedGeoJsonData) {
                this.geoProperties = this.geojsonService.getPropertiesAtPoint(place.poiCoordinates[0], place.poiCoordinates[1]);
                this.currentGeoId = this.extractGeoId(this.geoProperties);
                this.calculateAllVisualizationData();
              }
            }
            if (place.toCoordinates) {
              this.toMarker = this.createMarker(place.toCoordinates, 'to');
            }
            if (this.fromMarker || this.poiMarker || this.toMarker) {
              this.fitMapToMarkers();
            }
          });

          if (place.emotion) {
            // Ensure text property exists for backward compatibility
            this.selectedEmotion = {
              x: place.emotion.x,
              y: place.emotion.y,
              text: place.emotion.text || this.getEmotionText((place.emotion.x + 1) / 2, (place.emotion.y + 1) / 2)
            };
            // Update display after a short delay to ensure the emotion grid is rendered
            setTimeout(() => {
              this.updateEmotionDisplay();
            }, 100);
          }
        }
      }
    });
  }

  ngOnInit(): void {
    mapboxgl.accessToken = environment.mapboxToken;
    this.loadSearchScripts();
    
    // Subscribe to configuration changes
    this.configSubscription = this.configurationService.configuration$.subscribe(config => {
      if (config) {
        this.activityTypes = config.configuration.activityTypes;
        this.transportTypes = config.configuration.transportTypes;

        const el = config.configuration.emotionLabels;
        this.emotionLabelTop = el?.top?.trim?.() || '';
        this.emotionLabelRight = el?.right?.trim?.() || '';
        this.emotionLabelBottom = el?.bottom?.trim?.() || '';
        this.emotionLabelLeft = el?.left?.trim?.() || '';
      } else {
        this.activityTypes = [];
        this.transportTypes = [];
        this.emotionLabelTop = '';
        this.emotionLabelRight = '';
        this.emotionLabelBottom = '';
        this.emotionLabelLeft = '';
      }
    });
  }

  ngAfterViewInit(): void {
    this.initializeMap();
    this.initializeEmotionGrid();
    
    // Update emotion display after view initialization
    setTimeout(() => {
      this.updateEmotionDisplay();
    }, 100);
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
    }
    this.removeMarkers();
    
    // Remove resize event listener
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
    }
    
    // Unsubscribe from configuration changes
    if (this.configSubscription) {
      this.configSubscription.unsubscribe();
    }
  }

  removeMarkers(): void {
    if (this.fromMarker) {
      this.fromMarker.remove();
    }
    if (this.poiMarker) {
      this.poiMarker.remove();
    }
    if (this.toMarker) {
      this.toMarker.remove();
    }
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

  initializeMap(): void {
    this.map = new mapboxgl.Map({
      container: this.mapContainer.nativeElement,
      style: 'mapbox://styles/mapbox/navigation-night-v1',
      center: this.initialCoordinates,
      zoom: 13
    });
  }

  // Load GeoJSON data and initialize spatial querying functionality
  loadGeoJsonData(): void {
    this.geojsonService.loadGeoJson().subscribe({
      next: (geojsonData) => {
        const poiCoordinates = this.placeForm.get('poiCoordinates')?.value;
        if (poiCoordinates) {
          this.geoProperties = this.geojsonService.getPropertiesAtPoint(poiCoordinates[0], poiCoordinates[1]);
          this.currentGeoId = this.extractGeoId(this.geoProperties);
          // Calculate visualization data after GeoJSON data is loaded
          this.calculateAllVisualizationData();
        }
        this.loadedGeoJsonData = true;
        this.geoJsonLoadError = false;
      },
      error: (error) => {
        this.loadedGeoJsonData = true;
        this.geoJsonLoadError = true;
        console.error('Error loading GeoJSON data:', error);
      }
    });
  }

  createMarker(coordinates: [number, number], markerType: 'from' | 'poi' | 'to'): mapboxgl.Marker {
    const el = document.createElement('div');
    el.className = `custom-marker ${markerType}-marker`;
    
    switch (markerType) {
      case 'from':
        el.innerHTML = 'A';
        break;
      case 'poi':
        el.innerHTML = 'B';
        break;
      case 'to':
        el.innerHTML = 'C';
        break;
    }

    return new mapboxgl.Marker({
      element: el
    })
      .setLngLat(coordinates)
      .addTo(this.map);
  }

  fitMapToMarkers(): void {
    if (!this.fromMarker && !this.poiMarker && !this.toMarker) return;

    const bounds = new mapboxgl.LngLatBounds();
    
    if (this.fromMarker) {
      bounds.extend(this.fromMarker.getLngLat());
    }
    if (this.poiMarker) {
      bounds.extend(this.poiMarker.getLngLat());
    }
    if (this.toMarker) {
      bounds.extend(this.toMarker.getLngLat());
    }

    this.map.fitBounds(bounds, {
      padding: 100, // Add some padding around the markers
      maxZoom: 15   // Limit maximum zoom level
    });
  }

  initializeSearchBox(): void {
    if (this.fromAddressSearch?.nativeElement && this.poiAddressSearch?.nativeElement && this.toAddressSearch?.nativeElement) {
      if (customElements.get('mapbox-search-box')) {
        // Initialize all three search boxes
        this.initializeSearchListener(this.fromAddressSearch.nativeElement, 'from');
        this.initializeSearchListener(this.poiAddressSearch.nativeElement, 'poi');
        this.initializeSearchListener(this.toAddressSearch.nativeElement, 'to');
        this.isSearchLoading = false;
      } else {
        // If the custom element is not yet defined, wait a bit and try again
        setTimeout(() => this.initializeSearchBox(), 100);
      }
    }
  }

  private initializeSearchListener(
    searchBox: any,
    addressType: 'from' | 'poi' | 'to'
  ): void {
    searchBox.accessToken = environment.mapboxToken;
    searchBox.options = {
      proximity: this.initialCoordinates,
      types: ['address', 'poi', 'neighborhood', 'place', 'city']
    };

    // Set initial value if in edit mode
    if (this.isEditMode) {
      let address;
      switch (addressType) {
        case 'from':
          address = this.placeForm.get('fromAddress')?.value;
          break;
        case 'poi':
          address = this.placeForm.get('poiAddress')?.value;
          break;
        case 'to':
          address = this.placeForm.get('toAddress')?.value;
          break;
      }
      
      if (address) {
        // Need to wait for the component to be fully initialized
        setTimeout(() => {
          const input = searchBox.querySelector('input');
          if (input) {
            input.value = address;
          }
        }, 100);
      }
    }

    searchBox.addEventListener('retrieve', (event: any) => {
      const coordinates = event.detail?.features?.[0]?.geometry?.coordinates;
      const address = event.detail?.features?.[0]?.properties?.full_address;
      
      if (coordinates) {
        // Remove existing marker of this type
        let currentMarker;
        switch (addressType) {
          case 'from':
            currentMarker = this.fromMarker;
            break;
          case 'poi':
            currentMarker = this.poiMarker;
            break;
          case 'to':
            currentMarker = this.toMarker;
            break;
        }
        
        if (currentMarker) {
          currentMarker.remove();
        }

        // Create new marker and update form
        switch (addressType) {
          case 'from':
            this.fromMarker = this.createMarker(coordinates, 'from');
          this.placeForm.patchValue({
            fromAddress: address,
            fromCoordinates: coordinates
          });
            break;
          case 'poi':
            this.poiMarker = this.createMarker(coordinates, 'poi');
            this.geoProperties = this.geojsonService.getPropertiesAtPoint(coordinates[0], coordinates[1]);
            this.currentGeoId = this.extractGeoId(this.geoProperties);
            this.placeForm.patchValue({
              poiAddress: address,
              poiCoordinates: coordinates
            });
            // Calculate visualization data when POI coordinates changes
            this.calculateAllVisualizationData();
            break;
          case 'to':
            this.toMarker = this.createMarker(coordinates, 'to');
          this.placeForm.patchValue({
            toAddress: address,
            toCoordinates: coordinates
          });
            break;
        }
        
        this.fitMapToMarkers();
      }
    });
  }

  private initializeEmotionGrid(): void {
    const grid = this.emotionGrid.nativeElement;
    
    grid.addEventListener('mousemove', (e: MouseEvent) => {
      const rect = grid.getBoundingClientRect();
      this.showCrosshair = true;
      this.crosshairPosition = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    });

    grid.addEventListener('mouseleave', () => {
      this.showCrosshair = false;
    });

    grid.addEventListener('click', (e: MouseEvent) => {
      const rect = grid.getBoundingClientRect();
      const pixelPoint = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
      
      // Convert to normalized coordinates
      const normalized = this.pixelToNormalized(pixelPoint.x, pixelPoint.y, rect);
      
      // Calculate emotion based on position (using percentages for emoji calculation)
      const xPercent = pixelPoint.x / rect.width;
      const yPercent = pixelPoint.y / rect.height;
      
      this.selectedEmotion = {
        x: normalized.x, // Store normalized coordinates
        y: normalized.y, // Store normalized coordinates
        text: this.getEmotionText(xPercent, yPercent)
      };

      this.placeForm.patchValue({
        emotion: this.selectedEmotion
      });
    });

    // Add resize listener to update emotion display when grid size changes
    this.resizeHandler = this.updateEmotionDisplay.bind(this);
    window.addEventListener('resize', this.resizeHandler);
  }





  /**
   * Extract GeoID from geo properties
   * @param geoProperties - Properties from getPropertiesAtPoint
   * @returns GeoID string or null if not found
   */
  private extractGeoId(geoProperties: Collection | null): string | null {
    if (!geoProperties) return null;
    
    // Check IL_TES_BG collection for GEOID
    if (geoProperties['IL_TES_BG'] && geoProperties['IL_TES_BG']['GEOID']) {
      return geoProperties['IL_TES_BG']['GEOID'];
    }
    
    // Check NDI_202_Trt_IL_only collection for GeoID20_trt
    if (geoProperties['NDI_202_Trt_IL_only'] && geoProperties['NDI_202_Trt_IL_only']['GeoID20_trt']) {
      return geoProperties['NDI_202_Trt_IL_only']['GeoID20_trt'];
    }
    
    // Check IL_PLACES_MHLTH_TRACT collection for TractFIPS
    if (geoProperties['IL_PLACES_MHLTH_TRACT'] && geoProperties['IL_PLACES_MHLTH_TRACT']['TractFIPS']) {
      return geoProperties['IL_PLACES_MHLTH_TRACT']['TractFIPS'];
    }
    
    return null;
  }

  /**
   * Convert pixel coordinates to normalized coordinates (-1 to 1)
   * @param pixelX - X coordinate in pixels
   * @param pixelY - Y coordinate in pixels
   * @param gridRect - Grid element's bounding rectangle
   * @returns Normalized coordinates
   */
  private pixelToNormalized(pixelX: number, pixelY: number, gridRect: DOMRect): { x: number, y: number } {
    // Convert pixel position to percentage (0 to 1)
    const xPercent = pixelX / gridRect.width;
    const yPercent = pixelY / gridRect.height;
    
    // Convert percentage to normalized coordinates (-1 to 1)
    const normalizedX = (xPercent * 2) - 1; // 0->1 becomes -1->1
    const normalizedY = (yPercent * 2) - 1; // 0->1 becomes -1->1
    
    return { x: normalizedX, y: normalizedY };
  }

  /**
   * Convert normalized coordinates (-1 to 1) to pixel coordinates
   * @param normalizedX - Normalized X coordinate (-1 to 1)
   * @param normalizedY - Normalized Y coordinate (-1 to 1)
   * @param gridRect - Grid element's bounding rectangle
   * @returns Pixel coordinates
   */
  private normalizedToPixel(normalizedX: number, normalizedY: number, gridRect: DOMRect): { x: number, y: number } {
    // Convert normalized coordinates to percentage (0 to 1)
    const xPercent = (normalizedX + 1) / 2; // -1->1 becomes 0->1
    const yPercent = (normalizedY + 1) / 2; // -1->1 becomes 0->1
    
    // Convert percentage to pixel coordinates
    const pixelX = xPercent * gridRect.width;
    const pixelY = yPercent * gridRect.height;
    
    return { x: pixelX, y: pixelY };
  }

  /**
   * Update emotion display based on current grid size
   */
  private updateEmotionDisplay(): void {
    if (this.selectedEmotion && this.emotionGrid) {
      const gridRect = this.emotionGrid.nativeElement.getBoundingClientRect();
      const pixelCoords = this.normalizedToPixel(
        this.selectedEmotion.x, 
        this.selectedEmotion.y, 
        gridRect
      );
      
      // Update the display coordinates (these are used for positioning the emotion indicator)
      this.selectedEmotion = {
        ...this.selectedEmotion,
        x: this.selectedEmotion.x, // Keep normalized coordinates for storage
        y: this.selectedEmotion.y // Keep normalized coordinates for storage
      };
    }
  }

  /**
   * Get pixel coordinates for display purposes
   */
  getEmotionDisplayCoordinates(): { x: number, y: number } | null {
    if (!this.selectedEmotion || !this.emotionGrid) {
      return null;
    }
    
    const gridRect = this.emotionGrid.nativeElement.getBoundingClientRect();
    return this.normalizedToPixel(this.selectedEmotion.x, this.selectedEmotion.y, gridRect);
  }

  /**
   * Check if the given label is already in use by another place
   */
  private isLabelNotUnique(label: string): boolean {
    if (!label) return false;
    
    const trimmedLabel = label.trim();
    const currentPlaceId = this.isEditMode ? this.route.snapshot.queryParams['placeId'] : null;
    
    // Check all places across all dates
    const allDates = this.placesService.getAllDates();
    for (const date of allDates) {
      const places = this.placesService.getPlacesByDate(date);
      for (const place of places) {
        // Skip the current place being edited
        if (this.isEditMode && place.id === currentPlaceId) {
          continue;
        }
        
        // Check if labels match (case-insensitive)
        if (place.placeLabel && place.placeLabel.trim().toLowerCase() === trimmedLabel.toLowerCase()) {
          return true;
        }
      }
    }
    
    return false;
  }

  validateForm(): boolean {
    this.formErrors = {};
    
    if (this.placeForm.get('placeLabel')?.errors?.['required']) {
      this.formErrors['placeLabel'] = 'Please enter a label for this place';
    } else {
      // Check for unique label validation
      const currentLabel = this.placeForm.get('placeLabel')?.value?.trim();
      if (currentLabel && this.isLabelNotUnique(currentLabel)) {
        this.formErrors['placeLabel'] = 'This label already exists to another place. Please choose a different label.';
      }
    }
    
    if (this.placeForm.get('fromAddress')?.errors?.['required']) {
      this.formErrors['fromAddress'] = 'Please enter a starting location';
    }
    
    if (this.placeForm.get('fromCoordinates')?.errors?.['required']) {
      this.formErrors['fromCoordinates'] = 'Please select a valid starting location from the suggestions';
    }
    
    if (this.placeForm.get('leaveTime')?.errors?.['required']) {
      this.formErrors['leaveTime'] = 'Please enter a leave time';
    }
    
    if (this.placeForm.get('poiAddress')?.errors?.['required']) {
      this.formErrors['poiAddress'] = 'Please enter a point of interest';
    }
    
    if (this.placeForm.get('poiCoordinates')?.errors?.['required']) {
      this.formErrors['poiCoordinates'] = 'Please select a valid point of interest from the suggestions';
    }
    
    if (this.placeForm.get('timeSpentAtPoi')?.errors?.['required']) {
      this.formErrors['timeSpentAtPoi'] = 'Please enter time spent at POI';
    } else if (this.placeForm.get('timeSpentAtPoi')?.errors?.['min']) {
      this.formErrors['timeSpentAtPoi'] = 'Time spent must be at least 1 minute';
    }
    
    if (this.placeForm.get('toAddress')?.errors?.['required']) {
      this.formErrors['toAddress'] = 'Please enter a destination';
    }
    
    if (this.placeForm.get('toCoordinates')?.errors?.['required']) {
      this.formErrors['toCoordinates'] = 'Please select a valid destination from the suggestions';
    }
    
    if (this.placeForm.get('arriveTime')?.errors?.['required']) {
      this.formErrors['arriveTime'] = 'Please enter an arrival time';
    }
    
    if (this.placeForm.get('date')?.errors?.['required']) {
      this.formErrors['date'] = 'Please select a date';
    }
    
    if (this.placeForm.get('activityType')?.errors?.['required']) {
      this.formErrors['activityType'] = 'Please select an activity type';
    }
    
    if (this.placeForm.get('transportType')?.errors?.['required']) {
      this.formErrors['transportType'] = 'Please select a transport type';
    }

    return Object.keys(this.formErrors).length === 0;
  }

  onSubmit(): void {
    this.formSubmitted = true;
    
    if (!this.validateForm()) {
      // Scroll to the first error
      const firstError = Object.keys(this.formErrors)[0];
      const element = document.querySelector(`[data-field="${firstError}"]`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    if (this.placeForm.valid) {
      setTimeout(() => {
        const formData: PlaceFormData = this.placeForm.value;
        
        // Use stored visualization data instead of recalculating
        const geoVisualization = {
          NDI: this.visualizationData.NDI,
          tes: this.visualizationData.tes,
          MHLTH_CrudePrev: this.visualizationData.MHLTH_CrudePrev
        };

        // Extract raw geo values
        const geoValues = {
          NDI: this.geoProperties?.['NDI_202_Trt_IL_only']?.['NDI'] || null,
          tes: this.geoProperties?.['IL_TES_BG']?.['tes'] || null,
          MHLTH_CrudePrev: this.geoProperties?.['IL_PLACES_MHLTH_TRACT']?.['MHLTH_CrudePrev'] || null
        };
        
        const placeWithGeoData = {
          ...formData,
          emotion: formData.emotion || undefined,
          geoId: this.currentGeoId || undefined,
          geoVisualization,
          geoValues
        };
        
        if (this.isEditMode) {
          // Update existing place
          this.placesService.updatePlace(this.originalDate!, {
            ...placeWithGeoData,
            id: this.route.snapshot.queryParams['placeId']
          });
        } else {
          // Add new place
          this.placesService.addPlace({
            ...placeWithGeoData,
            id: '' // Will be generated by the service
          });
        }

        // Navigate back to journey planner
        this.router.navigate(['/journey-planner']);
      }, 0)
    }
  }

  onCancel(): void {
    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      data: {
        title: 'Cancel Place Entry',
        message: 'Are you sure you want to cancel? Any unsaved changes will be lost.',
        confirmText: 'Yes, Cancel',
        cancelText: 'No, Continue Editing',
        isDestructive: true
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.router.navigate(['/journey-planner']);
      }
    });
  }

  toggleShowGeoInfo(): void {
    this.showGeoInfo = !this.showGeoInfo;
  }

  getVisualizationData(type: string): { 
    barNumber: number | null, 
    leftLabel: string, 
    rightLabel: string,
    hasData: boolean 
  } {
    return this.visualizationData[type as keyof typeof this.visualizationData];
  }

  private calculateBarPosition(value: number, tertile33: number, tertile67: number): number {
    if (value <= tertile33) {
      return 1;
    } else if (value <= tertile67) {
      return 2;
    } else {
      return 3;
    }
  }

  /**
   * Calculate all visualization data at once and store in component properties
   */
  private calculateAllVisualizationData(): void {
    this.visualizationData.NDI = this.calculateVisualizationData('NDI');
    this.visualizationData.tes = this.calculateVisualizationData('tes');
    this.visualizationData.MHLTH_CrudePrev = this.calculateVisualizationData('MHLTH_CrudePrev');
  }

  /**
   * Calculate visualization data for a specific type
   */
  private calculateVisualizationData(type: string): { 
    barNumber: number | null, 
    leftLabel: string, 
    rightLabel: string,
    hasData: boolean 
  } {
    if (!this.geoProperties || !this.geojsonService.averages) {
      return { 
        barNumber: null, 
        leftLabel: '', 
        rightLabel: '', 
        hasData: false 
      };
    }

    let value: number | null = null;
    let tertile33: number | null = null;
    let tertile67: number | null = null;
    let leftLabel = '';
    let rightLabel = '';

    if (type === 'NDI') {
      value = this.geoProperties['NDI_202_Trt_IL_only']?.['NDI'] || null;
      tertile33 = this.geojsonService.averages['NDI_202_Trt_IL_only']?.['tertile_33'] || null;
      tertile67 = this.geojsonService.averages['NDI_202_Trt_IL_only']?.['tertile_67'] || null;
      leftLabel = 'Challenged community';
      rightLabel = 'Thriving community';
    } else if (type === 'tes') {
      value = this.geoProperties['IL_TES_BG']?.['tes'] || null;
      tertile33 = this.geojsonService.averages['IL_TES_BG']?.['tertile_33'] || null;
      tertile67 = this.geojsonService.averages['IL_TES_BG']?.['tertile_67'] || null;
      leftLabel = 'Needs more trees';
      rightLabel = 'Most trees';
    } else if (type === 'MHLTH_CrudePrev') {
      value = this.geoProperties['IL_PLACES_MHLTH_TRACT']?.['MHLTH_CrudePrev'] || null;
      tertile33 = this.geojsonService.averages['IL_PLACES_MHLTH_TRACT']?.['tertile_33'] || null;
      tertile67 = this.geojsonService.averages['IL_PLACES_MHLTH_TRACT']?.['tertile_67'] || null;
      leftLabel = 'Stressful vibes';
      rightLabel = 'Good vibes';
    }

    if (value === null || tertile33 === null || tertile67 === null) {
      return { 
        barNumber: null, 
        leftLabel, 
        rightLabel, 
        hasData: false 
      };
    }

    const barNumber = this.calculateBarPosition(value, tertile33, tertile67);

    return { 
      barNumber, 
      leftLabel, 
      rightLabel, 
      hasData: true 
    };
  }

  formatDate(dateString: string): string {
    if (!dateString) return '';
    
    // Parse the date string manually to avoid timezone issues
    const [year, month, day] = dateString.split('-').map(num => parseInt(num, 10));
    const date = new Date(year, month - 1, day); // month is 0-indexed
    
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  }

  openGeoInfoModal(id: string): void {
    // Define descriptions based on the data type
    const descriptions: Record<string, string> = {
      'NDI': `The Neighborhood Deprivation Index (NDI) measures how disadvantaged a
neighborhood is, considering community factors that impact health and well-being.`,
      'tes': `Tree Equity Score is a metric that helps cities assess how well they are delivering
equitable tree canopy cover to all residents. It is derived from tree canopy cover,
climate, demographic and socioeconomic data. Scores range from 0-100. The lower the
score, the greater priority for tree planting. A score of 100 means the neighborhood has
met tree planting goals.`,
      'MHLTH_CrudePrev': `CDC PLACES Data detailing the estimated prevalence among adults aged ≥ 18 years
who report that their mental health (including stress, depression, and problems with
emotions) was not good for 14 or more days during the past 30 days.`
    };

    // Get the visualization data (including pre-calculated bar number and labels)
    const vizData = this.getVisualizationData(id);

    // Using a generic Record type for modalData to allow for additional properties
    let modalData: Record<string, any> = {
      id: id,
      description: descriptions[id] || 'No additional information available for this metric.',
      type: id,
      barNumber: vizData.barNumber, // Pass the pre-calculated bar number
      leftLabel: vizData.leftLabel,   // Pass the dynamic left label
      rightLabel: vizData.rightLabel,  // Pass the dynamic right label
      hasData: vizData.hasData
    };

    // Add specific data for NDI visualization
    if (id === 'NDI' && this.geoProperties && this.geojsonService.averages) {
      modalData = {
        ...modalData,
        label: 'Community Conditions',
        value: this.geoProperties['NDI_202_Trt_IL_only']['NDI']
      };
    }
    
    // Add specific data for TES visualization
    else if (id === 'tes' && this.geoProperties && this.geojsonService.averages) {
      modalData = {
        ...modalData,
        label: 'Neighborhood Greenness',
        value: this.geoProperties['IL_TES_BG']['tes']
      };
    }
    
    // Add specific data for MHLTH_CrudePrev visualization
    else if (id === 'MHLTH_CrudePrev' && this.geoProperties && this.geojsonService.averages) {
      modalData = {
        ...modalData,
        label: 'Mental Wellbeing',
        value: this.geoProperties['IL_PLACES_MHLTH_TRACT']['MHLTH_CrudePrev']
      };
    }

    this.dialog.open(GeoInfoModalComponent, {
      width: '800px',
      maxWidth: '95vw',
      maxHeight: '90vh',
      panelClass: 'geo-info-modal-panel',
      autoFocus: false,
      restoreFocus: true,
      enterAnimationDuration: '300ms',
      exitAnimationDuration: '200ms',
      data: modalData
    });
  }

  openMapSelector(addressType: 'from' | 'poi' | 'to'): void {
    const currentCoords = this.placeForm.get(`${addressType}Coordinates`)?.value;
    const currentAddress = this.placeForm.get(`${addressType}Address`)?.value;
    
    const dialogData: MapSelectorData = {
      addressType,
      currentCoordinates: currentCoords,
      currentAddress: currentAddress
    };

    const dialogRef = this.dialog.open(MapSelectorDialogComponent, {
      width: '80vw',
      height: '80vh',
      maxWidth: '1000px',
      maxHeight: '80vh',
      data: dialogData
    });

    dialogRef.afterClosed().subscribe((result: MapSelectorResult | undefined) => {
      if (result) {
        this.updateAddressFromMap(addressType, result);
      }
    });
  }

  private updateAddressFromMap(addressType: 'from' | 'poi' | 'to', result: MapSelectorResult): void {
    // Remove existing marker of this type
    let currentMarker;
    switch (addressType) {
      case 'from':
        currentMarker = this.fromMarker;
        break;
      case 'poi':
        currentMarker = this.poiMarker;
        break;
      case 'to':
        currentMarker = this.toMarker;
        break;
    }
    
    if (currentMarker) {
      currentMarker.remove();
    }

    // Update form with selected address and coordinates
    switch (addressType) {
      case 'from':
        this.fromMarker = this.createMarker(result.coordinates, 'from');
        this.placeForm.patchValue({
          fromAddress: result.address,
          fromCoordinates: result.coordinates
        });
        // Update the search box value
        if (this.fromAddressSearch?.nativeElement) {
          const input = this.fromAddressSearch.nativeElement.querySelector('input');
          if (input) {
            input.value = result.address;
          }
        }
        break;
      case 'poi':
        this.poiMarker = this.createMarker(result.coordinates, 'poi');
        this.geoProperties = this.geojsonService.getPropertiesAtPoint(result.coordinates[0], result.coordinates[1]);
        this.currentGeoId = this.extractGeoId(this.geoProperties);
        this.placeForm.patchValue({
          poiAddress: result.address,
          poiCoordinates: result.coordinates
        });
        // Update the search box value
        if (this.poiAddressSearch?.nativeElement) {
          const input = this.poiAddressSearch.nativeElement.querySelector('input');
          if (input) {
            input.value = result.address;
          }
        }
        // Calculate visualization data when POI coordinates changes
        this.calculateAllVisualizationData();
        break;
      case 'to':
        this.toMarker = this.createMarker(result.coordinates, 'to');
        this.placeForm.patchValue({
          toAddress: result.address,
          toCoordinates: result.coordinates
        });
        // Update the search box value
        if (this.toAddressSearch?.nativeElement) {
          const input = this.toAddressSearch.nativeElement.querySelector('input');
          if (input) {
            input.value = result.address;
          }
        }
        break;
    }
    
    this.fitMapToMarkers();
  }

  private getEmotionText(x: number, y: number): string {
    // x: 0 = dissatisfied, 1 = satisfied
    // y: 0 = calm, 1 = stressed
    
    // Determine satisfaction level
    let satisfactionLevel = '';
    if (x < 0.33) {
      satisfactionLevel = 'Very dissatisfied';
    } else if (x < 0.66) {
      satisfactionLevel = 'Somewhat dissatisfied';
    } else if (x < 0.85) {
      satisfactionLevel = 'Somewhat satisfied';
    } else {
      satisfactionLevel = 'Very satisfied';
    }
    
    // Determine stress level
    let stressLevel = '';
    if (y < 0.33) {
      stressLevel = 'very calm';
    } else if (y < 0.66) {
      stressLevel = 'somewhat calm';
    } else if (y < 0.85) {
      stressLevel = 'somewhat stressed';
    } else {
      stressLevel = 'very stressed';
    }
    
    return `${satisfactionLevel} and ${stressLevel}`;
  }
}
