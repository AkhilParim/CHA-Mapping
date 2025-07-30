import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface Place {
  id: string;
  placeLabel: string;
  fromAddress: string;
  fromCoordinates: [number, number];
  leaveTime: string;
  poiAddress: string;
  poiCoordinates: [number, number];
  timeSpentAtPoi: number; // in minutes
  toAddress: string;
  toCoordinates: [number, number];
  arriveTime: string;
  date: string;
  activityType: string;
  transportType: string;
  comments: string;
  geoId?: string; // GeoID from any of the geo files
  emotion?: {
    x: number;
    y: number;
    text: string;
  };
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

export interface LocationGroup {
  coordinates: [number, number];
  places: Place[];
  alphabet: string;
  isExpanded?: boolean;    // For summary component
  isHighlighted?: boolean; // For journey-planner component
}

@Injectable({
  providedIn: 'root'
})
export class PlacesService {
  private placesMap = new Map<string, Place[]>();
  private selectedDateSubject = new BehaviorSubject<string | null>(null);
  selectedDate$ = this.selectedDateSubject.asObservable();
  private readonly STORAGE_KEY = 'cha-mapping-places';

  constructor() {
    this.loadFromLocalStorage();
    // Set the first available date (when sorted) as the selected date
    const dates = this.getAllDates();
    if (dates.length > 0) {
      this.selectedDateSubject.next(dates[0]);
    }
  }

  private saveToLocalStorage(): void {
    try {
      const placesObject = Object.fromEntries(this.placesMap);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(placesObject));
    } catch (error) {
      console.error('Error saving places to localStorage:', error);
    }
  }

  private loadFromLocalStorage(): void {
    try {
      const placesJson = localStorage.getItem(this.STORAGE_KEY);
      if (placesJson) {
        const placesObject = JSON.parse(placesJson);
        this.placesMap = new Map(Object.entries(placesObject));
      }
    } catch (error) {
      console.error('Error loading places from localStorage:', error);
    }
  }

  setSelectedDate(date: string | null): void {
    this.selectedDateSubject.next(date);
  }

  getSelectedDate(): string | null {
    return this.selectedDateSubject.getValue();
  }

  addDate(date: string): void {
    if (!this.placesMap.has(date)) {
      this.placesMap.set(date, []);
      this.saveToLocalStorage();
    }
  }

  addPlace(place: Place): void {
    const date = place.date;
    const places = this.placesMap.get(date) || [];
    place.id = this.generateId();
    if (!place.placeLabel) place.placeLabel = '';
    places.push(place);
    console.log(place);
    
    this.placesMap.set(date, places);
    this.saveToLocalStorage();
  }

  getPlacesByDate(date: string): Place[] {
    return this.placesMap.get(date) || [];
  }

  getAllDates(): string[] {
    return Array.from(this.placesMap.keys()).sort();
  }

  getPlaceById(date: string, id: string): Place | null {
    const places = this.placesMap.get(date);
    return places?.find(p => p.id === id) || null;
  }

  updatePlace(oldDate: string, place: Place): void {
    if (oldDate !== place.date) {
      this.removePlace(oldDate, place.id);
      this.addPlace(place);
    } else {
      const places = this.placesMap.get(oldDate);
      if (places) {
        const index = places.findIndex(p => p.id === place.id);
        if (index !== -1) {
          if (!place.placeLabel) place.placeLabel = '';
          places[index] = place;
          this.placesMap.set(oldDate, places);
          this.saveToLocalStorage();
        }
      }
    }
    console.log('Updated place:', place, this.placesMap);
  }

  removePlace(date: string, placeId: string): void {
    const places = this.placesMap.get(date);
    if (places) {
      const index = places.findIndex(p => p.id === placeId);
      if (index !== -1) {
        places.splice(index, 1);
        if (places.length === 0) {
          this.placesMap.delete(date);
        } else {
          this.placesMap.set(date, places);
        }
        this.saveToLocalStorage();
      }
    }
  }

  clearAllData(): void {
    this.placesMap.clear();
    this.selectedDateSubject.next(null);
    localStorage.removeItem(this.STORAGE_KEY);
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }

  /**
   * Calculate distance between two coordinates using Haversine formula
   * @param coords1 - First coordinate pair [lng, lat]
   * @param coords2 - Second coordinate pair [lng, lat]
   * @returns Distance in meters
   */
  calculateDistance(coords1: [number, number], coords2: [number, number]): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = coords1[1] * Math.PI / 180; // φ, λ in radians
    const φ2 = coords2[1] * Math.PI / 180;
    const Δφ = (coords2[1] - coords1[1]) * Math.PI / 180;
    const Δλ = (coords2[0] - coords1[0]) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }

  /**
   * Group places by location (within 10 meters of each other)
   * @param places - Array of places to group
   * @param markerAlphabet - String of alphabet characters for markers
   * @returns Array of location groups
   */
  groupPlacesByLocation(places: Place[], markerAlphabet: string): LocationGroup[] {
    const locationGroups: LocationGroup[] = [];
    let alphabetIndex = 0;

    places.forEach(place => {
      if (!place.poiCoordinates) return;

      // Find if this place should be grouped with an existing group
      let addedToGroup = false;
      for (const group of locationGroups) {
        const distance = this.calculateDistance(place.poiCoordinates, group.coordinates);
        if (distance <= 100) { // Within 100 meters
          group.places.push(place);
          addedToGroup = true;
          break;
        }
      }

      if (!addedToGroup) {
        // Create new group
        locationGroups.push({
          coordinates: place.poiCoordinates,
          places: [place],
          alphabet: markerAlphabet[alphabetIndex % markerAlphabet.length],
          isExpanded: false,
          isHighlighted: false
        });
        alphabetIndex++;
      }
    });

    return locationGroups;
  }
} 