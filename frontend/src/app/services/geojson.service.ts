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
        this.calculateTertiles();
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

  calculateTertiles(): void {
    // Calculate NDI tertiles
    if (this.ndiFeatureCollection) {
      const ndiValues: number[] = [];
      
      this.ndiFeatureCollection.features.forEach(feature => {
        if (feature['properties']!['stabbr'] == 'IL' && feature['properties']!['NDI'] != null) {
          const ndiValue = feature['properties']!['NDI'];
          ndiValues.push(ndiValue);
        }
      });
      
      if (ndiValues.length > 0) {
        ndiValues.sort((a, b) => a - b);
        this.averages['NDI_202_Trt_IL_only']['tertile_33'] = this.calculatePercentile(ndiValues, 33);
        this.averages['NDI_202_Trt_IL_only']['tertile_67'] = this.calculatePercentile(ndiValues, 67);
      }
    }

    // Calculate Tree Equity Score (TES) tertiles
    if (this.ilTesBgCollection) {
      const tesValues: number[] = [];
      
      this.ilTesBgCollection.features.forEach(feature => {
        if (feature.properties!['tes'] != null) {
          const tesValue = feature.properties!['tes'];
          tesValues.push(tesValue);
        }
      });
      
      if (tesValues.length > 0) {
        tesValues.sort((a, b) => a - b);
        this.averages['IL_TES_BG']['tertile_33'] = this.calculatePercentile(tesValues, 33);
        this.averages['IL_TES_BG']['tertile_67'] = this.calculatePercentile(tesValues, 67);
      }
    }

    // Calculate Mental Health Crude Prevalence tertiles
    if (this.ilPlacesMhlthTractCollection) {
      const mhlthValues: number[] = [];
      
      this.ilPlacesMhlthTractCollection.features.forEach(feature => {
        if (feature.properties!['MHLTH_CrudePrev'] != null) {
          const mhlthValue = feature.properties!['MHLTH_CrudePrev'];
          mhlthValues.push(mhlthValue);
        }
      });
      
      if (mhlthValues.length > 0) {
        mhlthValues.sort((a, b) => a - b);
        this.averages['IL_PLACES_MHLTH_TRACT']['tertile_33'] = this.calculatePercentile(mhlthValues, 33);
        this.averages['IL_PLACES_MHLTH_TRACT']['tertile_67'] = this.calculatePercentile(mhlthValues, 67);
      }
    }
  }

  private calculatePercentile(sortedValues: number[], percentile: number): number {
    const index = (percentile / 100) * (sortedValues.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    
    if (lower === upper) {
      return sortedValues[lower];
    }
    
    const weight = index - lower;
    return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
  }
} 