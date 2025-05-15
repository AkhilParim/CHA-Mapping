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
}

@Injectable({
  providedIn: 'root'
})
export class PlacesService {
  private placesMap = new Map<string, Place[]>();
  private selectedDateSubject = new BehaviorSubject<string | null>(null);
  selectedDate$ = this.selectedDateSubject.asObservable();

  constructor() {
//     this.placesMap.set('2025-05-01', [{
//         "fromAddress": "2222 West Taylor Street, Chicago, Illinois 60612, United States",
//         "toAddress": "1240 W Harrison St, Chicago, Illinois 60607, United States",
//         "placeLabel": "First Place",
//         "fromCoordinates": [
//             -87.682169,
//             41.869197
//         ],
//         "toCoordinates": [
//             -87.65873046,
//             41.87448231
//         ],
//         "date": "2025-05-21",
//         "startTime": "22:52",
//         "endTime": "22:52",
//         "activityType": "School",
//         "transportType": "Bus",
//         "comments": "comment",
//         "emotion": {
//             "x": 605.203125,
//             "y": 99,
//             "emoji": "🤔"
//         },
//         "id": "ma677xwbd4fy0hmpenw"
//     }, {
//       "fromAddress": "801 S Paulina St, Chicago, Illinois 60612, United States",
//       "toAddress": "2222 West Taylor Street, Chicago, Illinois 60612, United States",
//       "fromCoordinates": [
//           -87.66855458,
//           41.8712151
//       ],
//       "toCoordinates": [
//           -87.682169,
//           41.869197
//       ],
//       "date": "2025-05-01",
//       "startTime": "16:31",
//       "endTime": "16:41",
//       "activityType": "Home",
//       "transportType": "Bus",
//       "placeLabel": "sweet home",
//       "comments": "",
//       "emotion": {
//           "x": 737.6015625,
//           "y": 142,
//           "emoji": "🙂"
//       },
//       "id": "mafxfuyif7wx55y96v"
//   }]);
//   this.placesMap.set('2025-05-02', [{
//     "fromAddress": "801 S Paulina St, Chicago, Illinois 60612, United States",
//     "toAddress": "2222 West Taylor Street, Chicago, Illinois 60612, United States",
//     "fromCoordinates": [
//         -87.66855458,
//         41.8712151
//     ],
//     "toCoordinates": [
//         -87.682169,
//         41.869197
//     ],
//     "date": "2025-05-15",
//     "startTime": "04:02",
//     "endTime": "12:02",
//     "activityType": "School",
//     "transportType": "Bus",
//     "placeLabel": "fdfds",
//     "comments": "",
//     "emotion": {
//         "x": 631.6015625,
//         "y": 243,
//         "emoji": "😅"
//     },
//     "id": "mafyurr09b53wesl7zp"
// }]);
  }

  setSelectedDate(date: string | null): void {
    this.selectedDateSubject.next(date);
  }

  getSelectedDate(): string | null {
    return this.selectedDateSubject.getValue();
  }

  addDate(date: string): void {
    this.placesMap.set(date, []);
  }

  addPlace(place: Place): void {
    const date = place.date;
    const places = this.placesMap.get(date) || [];
    place.id = this.generateId();
    if (!place.placeLabel) place.placeLabel = '';
    places.push(place);
    console.log(place);
    
    this.placesMap.set(date, places);
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
        }
      }
    }
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
      }
    }
  }

  clearAllData(): void {
    this.placesMap.clear();
    this.selectedDateSubject.next(null);
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }
} 