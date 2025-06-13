import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface Place {
  id: string;
  placeLabel: string;
  fromAddress: string;
  toAddress: string;
  fromCoordinates: [number, number];
  toCoordinates: [number, number];
  date: string;
  startTime: string;
  endTime: string;
  activityType: string;
  transportType: string;
  comments: string;
  emotion?: {
    x: number;
    y: number;
    emoji: string;
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
} 