CHA Mapping
===========

Overview
--------
- Frontend: Angular 18 SPA with Mapbox GL, local persistence, and export flows.
- Backend: Express API with MongoDB to store application configuration and theme tokens.
- Data utilities: Python scripts to filter/prepare GeoJSON datasets.


Monorepo structure
------------------
```
/backend                # Express API (configuration + theme)
/frontend               # Angular 18 application
  /public               # Static assets (copied to dist)
  /public/data          # GeoJSON files loaded at runtime
/transform_geojson      # Python scripts for GeoJSON processing
README.md
```


Key features
------------
- Address lookup with Mapbox Search, click-to-drop markers, reverse geocoding, clipboard copy.
- Journey planning with date-based organization and proximity-based grouping (100m) using Haversine distance.
- Geo insight overlays: point-in-polygon lookup and tertile calculations for NDI, TES, and Mental Health prevalence.
- Runtime theming via CSS variables applied from backend-stored theme tokens.


Architecture
------------
- Frontend (Angular 18, standalone components)
  - Routes: `/journey-planner` (default), `/place-editor`, `/configuration`, `/address-lookup`.
  - Services: configuration/theme API, GeoJSON loader with Turf.js, localStorage-based places service.
  - Static GeoJSON loaded from `frontend/public/data/...`.
- Backend (Node/Express + MongoDB)
  - Endpoints for application configuration and theme tokens.
  - Uses database `PlaceEditor` with collections `app_configuration` and `theme_configuration`.
- Data processing
  - Python script to filter Illinois features from national GeoJSON.


Frontend
--------
Tech
- Angular 18, Angular Material/CDK, Mapbox GL (`mapbox-gl`), Mapbox Search Web Component, Turf.js, RxJS.

Important configuration
- Base href for build: `/cha-mapping/` (see `frontend/angular.json`).
- Assets copied from `frontend/public/` into the build output (`dist`).
- Runtime environments:
  - Dev: `frontend/src/environments/environment.ts` → `apiUrl: http://localhost:3050`
  - Prod: `frontend/src/environments/environment.production.ts` → `apiUrl: http://ip-address/placeEditor`

Environment variables (consumed at build/runtime)
- `MAPBOX_TOKEN` (required): Mapbox access token used by Mapbox GL and Search.
- `FACILITATOR_ZIP_PASSWORD` (optional): used by export flows if applicable.

Install & run
```bash
cd frontend
npm install
npm start
# App: http://localhost:4200
```

Build
```bash
cd frontend
npm run build
# Output: frontend/dist (served with baseHref /cha-mapping/)
```

Lint & test
```bash
cd frontend
npm run lint
npm test
```

Routes (`src/app/app.routes.ts`)
- ``/journey-planner`` (default redirect)
- ``/place-editor``
- ``/configuration``
- ``/address-lookup``

Core services
- `ConfigurationService`
  - GET/POST `apiUrl/configuration` for activity/transport types and labels.
  - GET/POST `apiUrl/theme` for theme tokens; applied as CSS variables in `AppComponent`.
- `GeojsonService`
  - Loads GeoJSON from `public/data`:
    - `NDI_202_Trt_IL_only.geojson`
    - `il_tes_bg_wgs84.geojson`
    - `il_places_mhlth_tract_wgs84.geojson`
  - Provides point-in-polygon lookups and tertile calculations for indicators.
- `PlacesService`
  - Manages places grouped by date.
  - Persists to localStorage under key `cha-mapping-places`.
  - Proximity grouping within 100 meters using Haversine distance.

Address lookup (`address-lookup` component)
- Mapbox Search Box with proximity biased to current map center.
- Click on map to drop marker; reverse geocodes to update address.
- Copy selected address to clipboard with modern API fallback.


Backend
-------
Tech
- Node 18+, Express 4, MongoDB Node Driver 6, CORS, dotenv.

Server
- Port: `3050`
- Database: `PlaceEditor`
- Collections: `app_configuration`, `theme_configuration`
- DB endpoint:
  - Dev: `mongodb://127.0.0.1:27017/PlaceEditor`
  - Prod: `process.env.DB_END_POINT_2` when `NODE_ENV=production`

Install & run
```bash
cd backend
npm install
npm run dev   # or: npm start
# Requires MongoDB at 127.0.0.1:27017 or set DB_END_POINT_2 on the server with NODE_ENV=production
```

Environment variables
- `NODE_ENV` (`production` to use `DB_END_POINT_2`)
- `DB_END_POINT_2` (MongoDB connection string for production)

API endpoints
- GET `/configuration`
  - Returns the application configuration document.
- POST `/configuration`
  - Upserts configuration: `{ configuration: { activityTypes: string[], transportTypes: string[], perceptionLabels? } }`.
- GET `/theme`
  - Returns `{ theme: Record<string,string>, lastUpdated: string|null }`.
- POST `/theme`
  - Validates allowed CSS variable keys and color values, then upserts theme.

Allowed theme CSS variables
- `--color-text-default`, `--color-text-muted`, `--color-text-disabled`, `--color-text-secondary`
- `--color-accent-50`, `--color-accent`, `--color-accent-hover`, `--color-accent-active`, `--color-on-accent`
  - Accepted color formats: `#hex`, `rgb(a)`, `hsl(a)`.


Data processing scripts
-----------------------
Location: `transform_geojson/`

Ex: `get_IL_places.py`
- Filters Illinois features (`stabbr == 'IL'`) from `data/input/NDI_202_Trt_AllStates.geojson` and writes `data/output/NDI_202_Trt_IL_only_wgs84.geojson`.
- The geojson file must be in WGS84 format. transform_geojson converts the file to WGS84.

Run
```bash
cd transform_geojson
pip install pyproj tqdm
python get_IL_places.py
```

Deployment notes
----------------
- Frontend `baseHref` is `/cha-mapping/` (important for hosting under a subpath).
- Ensure the server at `apiUrl` is reachable from the deployed frontend.
- Provide `MAPBOX_TOKEN` during frontend build/serve.
- For production backend, set `NODE_ENV=production` and `DB_END_POINT_2`.


Developer utilities
-------------------
- Generate PGP assets (if used by export flows):
```bash
cd frontend
npm run gen:pgp
```


Troubleshooting
---------------
- Map not loading: verify `MAPBOX_TOKEN` and that the token has Mapbox GL and Search access.
- Geo layers empty: confirm GeoJSON files exist in `frontend/public/data/` and are reachable.
- Config not loading: ensure backend is running and MongoDB contains a configuration document (or POST one via the API).
- Deployed app 404 on refresh: confirm your hosting respects Angular SPA fallback and the `baseHref` `/cha-mapping/`.
