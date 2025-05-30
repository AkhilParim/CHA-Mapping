import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, forkJoin } from 'rxjs';
import { catchError, tap, map } from 'rxjs/operators';
import { point, booleanPointInPolygon } from '@turf/turf';
import { FeatureCollection, Feature, Polygon, MultiPolygon } from 'geojson';

export interface Collection {
  'NDI_202_Trt_IL_only': any;
  'IL_TES_BG': any;
  'IL_PLACES_MHLTH_TRACT': any;
}

@Injectable({
  providedIn: 'root'
})
export class GeojsonService {
  private ndiFeatureCollection: FeatureCollection | null = null;
  private ilTesBgCollection: FeatureCollection | null = null;
  private ilPlacesMhlthTractCollection: FeatureCollection | null = null;
  private loaded = false;
  averages: Collection = {'NDI_202_Trt_IL_only': {}, 'IL_TES_BG': {}, 'IL_PLACES_MHLTH_TRACT': {}};

  constructor(private http: HttpClient) {}

  loadGeoJson(): Observable<FeatureCollection[]> {
    // If already loaded, return the cached data
    if (this.loaded && this.ndiFeatureCollection && this.ilTesBgCollection && this.ilPlacesMhlthTractCollection) {
      return of([this.ndiFeatureCollection, this.ilTesBgCollection, this.ilPlacesMhlthTractCollection]);
    }
    
    const ndi$ = this.http.get<FeatureCollection>('data/NDI_202_Trt_IL_only.geojson').pipe(
      catchError(error => {
        console.error('Error loading NDI GeoJSON data:', error);
        return of(this.createEmptyFeatureCollection());
      })
    );
    
    const ilTesBg$ = this.http.get<FeatureCollection>('data/il_tes_bg_wgs84.geojson').pipe(
      catchError(error => {
        console.error('Error loading IL TES BG GeoJSON data:', error);
        return of(this.createEmptyFeatureCollection());
      })
    );
    
    const ilPlacesMhlthTract$ = this.http.get<FeatureCollection>('data/il_places_mhlth_tract_wgs84.geojson').pipe(
      catchError(error => {
        console.error('Error loading IL Places MHLTH Tract GeoJSON data:', error);
        return of(this.createEmptyFeatureCollection());
      })
    );
    
    return forkJoin([ndi$, ilTesBg$, ilPlacesMhlthTract$]).pipe(
      tap(([ndi, ilTesBg, ilPlacesMhlth]) => {
        this.ndiFeatureCollection = ndi;
        this.ilTesBgCollection = ilTesBg;
        this.ilPlacesMhlthTractCollection = ilPlacesMhlth;
        this.calculateStateAverages();
        this.loaded = true;
      }),
      map(results => results)
    );
  }

  private createEmptyFeatureCollection(): FeatureCollection {
    return {
      type: 'FeatureCollection',
      features: []
    };
  }

  getPropertiesAtPoint(lng: number, lat: number): Collection {
    if (!this.loaded) return {'NDI_202_Trt_IL_only': [], 'IL_TES_BG': [], 'IL_PLACES_MHLTH_TRACT': []};
    
    const turfPoint = point([lng, lat]);
    const results: Collection = {'NDI_202_Trt_IL_only': [], 'IL_TES_BG': [], 'IL_PLACES_MHLTH_TRACT': []};
    const collections: Collection =  {
      'NDI_202_Trt_IL_only': this.ndiFeatureCollection, 
      'IL_TES_BG': this.ilTesBgCollection, 
      'IL_PLACES_MHLTH_TRACT': this.ilPlacesMhlthTractCollection
    };

    // Check each feature collection
    for (const [collectionName, collection] of Object.entries(collections)) {
      if (!collection) continue;

      // Find all polygons that contain the point
      for (const feature of collection.features) {
        // Only check polygons
        if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
          try {
            // Cast the feature to the appropriate type for turf.booleanPointInPolygon
            const polygonFeature = feature as Feature<Polygon | MultiPolygon>;
            if (booleanPointInPolygon(turfPoint, polygonFeature)) {
              results[collectionName as keyof Collection] = feature.properties!;
            }
          } catch (e) {
            console.error('Error checking point in polygon:', e);
          }
        }
      }
    }
    return results;
  }

  calculateStateAverages(): void {
    // Calculate NDI averages
    if (this.ndiFeatureCollection) {
      let lowestNDI = 100; let highestNDI = 0;
      this.averages['NDI_202_Trt_IL_only']['state_average'] = this.ndiFeatureCollection.features.reduce((acc, feature) => {
        if (feature['properties']!['stabbr'] == 'IL' && feature['properties']!['NDI'] != null) {
          if (feature['properties']!['NDI'] < lowestNDI) {
            lowestNDI = feature['properties']!['NDI'];
          }
          if (feature['properties']!['NDI'] > highestNDI) {
            highestNDI = feature['properties']!['NDI'];
          }
        }
        return acc + feature.properties!['NDI'];
      }, 0) / this.ndiFeatureCollection.features.length;
      this.averages['NDI_202_Trt_IL_only']['lowest_NDI'] = lowestNDI;
      this.averages['NDI_202_Trt_IL_only']['highest_NDI'] = highestNDI;
    }

    // Calculate Tree Equity Score (TES) averages
    if (this.ilTesBgCollection) {
      let lowestTES = 100; let highestTES = 0;
      this.averages['IL_TES_BG']['state_average'] = this.ilTesBgCollection.features.reduce((acc, feature) => {
        if (feature.properties!['tes'] != null) {
          const tesValue = feature.properties!['tes'];
          if (tesValue < lowestTES) {
            lowestTES = tesValue;
          }
          if (tesValue > highestTES) {
            highestTES = tesValue;
          }
          return acc + tesValue;
        }
        return acc;
      }, 0) / this.ilTesBgCollection.features.filter(f => f.properties!['tes'] != null).length;
      this.averages['IL_TES_BG']['lowest_tes'] = lowestTES;
      this.averages['IL_TES_BG']['highest_tes'] = highestTES;
    }

    // Calculate Mental Health Crude Prevalence averages
    if (this.ilPlacesMhlthTractCollection) {
      let lowestMHLTH = 100; let highestMHLTH = 0;
      this.averages['IL_PLACES_MHLTH_TRACT']['state_average'] = this.ilPlacesMhlthTractCollection.features.reduce((acc, feature) => {
        if (feature.properties!['MHLTH_CrudePrev'] != null) {
          const mhlthValue = feature.properties!['MHLTH_CrudePrev'];
          if (mhlthValue < lowestMHLTH) {
            lowestMHLTH = mhlthValue;
          }
          if (mhlthValue > highestMHLTH) {
            highestMHLTH = mhlthValue;
          }
          return acc + mhlthValue;
        }
        return acc;
      }, 0) / this.ilPlacesMhlthTractCollection.features.filter(f => f.properties!['MHLTH_CrudePrev'] != null).length;
      this.averages['IL_PLACES_MHLTH_TRACT']['lowest_MHLTH_CrudePrev'] = lowestMHLTH;
      this.averages['IL_PLACES_MHLTH_TRACT']['highest_MHLTH_CrudePrev'] = highestMHLTH;
    }
  }
} 