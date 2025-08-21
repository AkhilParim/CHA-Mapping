import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, tap, take, map } from 'rxjs/operators';

export interface AppConfiguration {
  _id?: string;
  version?: string;
  lastUpdated?: Date;
  configuration: {
    activityTypes: string[];
    transportTypes: string[];
    emotionLabels?: {
      top: string;
      right: string;
      bottom: string;
      left: string;
    };
  };
}

@Injectable({
  providedIn: 'root'
})
export class ConfigurationService {
  private readonly API_BASE_URL = 'http://localhost:3050';

  private configurationSubject = new BehaviorSubject<AppConfiguration | null>(null);
  public configuration$ = this.configurationSubject.asObservable();
  public configError = false;

  constructor(private http: HttpClient) {
    this.loadConfiguration().pipe(take(1)).subscribe();
  }

  /**
   * Load configuration from API.
   */
  loadConfiguration(): Observable<void> {
    return this.http.get<AppConfiguration>(`${this.API_BASE_URL}/configuration`).pipe(
      tap((config) => {
        const activities = config?.configuration?.activityTypes ?? [];
        const transports = config?.configuration?.transportTypes ?? [];

        if (!activities.length || !transports.length) {
          this.configurationSubject.next(null);
          this.configError = true;
          return;
        }

        this.configurationSubject.next(config);
        this.configError = false;
      }),
      map(() => void 0),
      catchError(() => {
        this.configurationSubject.next(null);
        this.configError = true;
        return of(void 0);
      })
    );
  }

  /**
   * Save configuration to API. Also validates and emits error state if lists are empty.
   */
  saveConfiguration(config: AppConfiguration): Observable<any> {
    const activities = config?.configuration?.activityTypes ?? [];
    const transports = config?.configuration?.transportTypes ?? [];

    return this.http.post(`${this.API_BASE_URL}/configuration`, config).pipe(
      tap(() => {
        if (!activities.length || !transports.length) {
          this.configurationSubject.next(null);
          this.configError = true;
        } else {
          this.configurationSubject.next(config);
          this.configError = false;
        }
      })
    );
  }
} 