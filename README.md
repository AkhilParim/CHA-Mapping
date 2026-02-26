CHA Mapping
===========

A web application for community health assessment (CHA) journey planning, place editing, geo-insight overlays, and address lookup — built as an Angular 18 SPA backed by a small Express/MongoDB API.


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
.env.example            # Template for required environment variables
README.md
```


Prerequisites
-------------
Make sure the following are installed before getting started:

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 18 or later | https://nodejs.org |
| npm | 9 or later | bundled with Node |
| Angular CLI | 18 | `npm install -g @angular/cli@18` |
| MongoDB | 6 or later | https://www.mongodb.com/try/download/community |
| Python | 3.8+ | only needed for data transform scripts |
| Mapbox account | — | free tier works; token required at build time |


Environment setup
-----------------
Both the frontend build and the backend server read configuration from a `.env` file
in the repository root.

1. Copy the example file:
   ```bash
   cp .env.example .env
   ```

2. Fill in the values (see descriptions below):
   ```
   MAPBOX_TOKEN=<your Mapbox public access token>
   FACILITATOR_ZIP_PASSWORD=<password used when exporting encrypted ZIP files>
   DB_END_POINT_2=<MongoDB connection string used in production>
   ```

Getting a Mapbox token
- Sign up at https://account.mapbox.com/auth/signup/
- In your account dashboard go to "Access tokens" and create a public token.
- The token must have scopes for Mapbox GL JS and the Search/Geocoding APIs.

The `.env` file is listed in `.gitignore` and must never be committed.


Key features
------------
- Address lookup with Mapbox Search, click-to-drop markers, reverse geocoding, clipboard copy.
- Journey planning with date-based organization and proximity-based grouping (100 m) using Haversine distance.
- Geo insight overlays: point-in-polygon lookup and tertile calculations for NDI, TES, and Mental Health prevalence.
- Runtime theming via CSS variables applied from backend-stored theme tokens.


Architecture
------------
- Frontend (Angular 18, standalone components)
  - Routes: `/journey-planner` (default), `/place-editor`, `/configuration`, `/address-lookup`, `/perception-lookup`.
  - Services: configuration/theme API, GeoJSON loader with Turf.js, localStorage-based places service.
  - Static GeoJSON loaded from `frontend/public/data/...`.
- Backend (Node/Express + MongoDB)
  - Endpoints for application configuration and theme tokens.
  - Uses database `PlaceEditor` with collections `app_configuration` and `theme_configuration`.
- Data processing
  - Python script to filter Illinois features from a national GeoJSON.


Frontend
--------
Tech
- Angular 18, Angular Material/CDK, Mapbox GL (`mapbox-gl`), Mapbox Search Web Component, Turf.js, RxJS.

Install & run
```bash
cd frontend
npm install
npm start
# App: http://localhost:4200
```

Build
```bash
# Served at the root path (default, works for most deployments):
cd frontend
npm run build
# Output: frontend/dist

# Served under a subpath (e.g. /cha-mapping/):
npm run build:subpath
# Equivalent to: ng build --base-href /cha-mapping/

# Any custom subpath:
ng build --base-href /your-subpath/
```

> **Note:** If you deploy the frontend under a subpath, your web server must
> also serve the Angular SPA fallback (rewrite all unmatched routes to
> `index.html`) for deep-link navigation to work.

Lint & test
```bash
cd frontend
npm run lint
npm test
```

Environment variables (consumed at build time via custom webpack config)
- `MAPBOX_TOKEN` (required): Mapbox access token used by Mapbox GL and Search.
- `FACILITATOR_ZIP_PASSWORD` (optional): password used by the encrypted export flow.

Runtime environments
- Dev:  `frontend/src/environments/environment.ts`            → `apiUrl: http://localhost:3050`
- Prod: `frontend/src/environments/environment.production.ts` → `apiUrl: http://<your-server-url>/placeEditor`

Update `environment.production.ts` with your own API URL before building for production.

Routes (`src/app/app.routes.ts`)
- `/journey-planner`  (default redirect)
- `/place-editor`
- `/configuration`
- `/address-lookup`
- `/perception-lookup`

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
  - Persists to sessionStorage under key `cha-mapping-places`.
  - Proximity grouping within 100 meters using Haversine distance.

Address lookup (`address-lookup` component)
- Mapbox Search Box with proximity biased to current map center.
- Click on map to drop marker; reverse geocodes to update address.
- Copy selected address to clipboard with modern API fallback.


Backend
-------
Tech
- Node 18+, Express 4, MongoDB Node Driver 6, CORS, dotenv.

Install & run
```bash
cd backend
npm install
npm run dev   # nodemon (auto-reload)
# or: npm start
# Requires MongoDB at 127.0.0.1:27017
```

Server
- Port: `3050`
- Database: `PlaceEditor`
- Collections: `app_configuration`, `theme_configuration`
- DB endpoint:
  - Dev: `mongodb://127.0.0.1:27017/PlaceEditor` (hardcoded default)
  - Prod: value of `DB_END_POINT_2` env var when `NODE_ENV=production`

Environment variables
- `NODE_ENV`      — set to `production` to switch to the `DB_END_POINT_2` connection string
- `DB_END_POINT_2` — full MongoDB connection string for production (e.g. `mongodb+srv://user:pass@cluster/PlaceEditor`)

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

Install Python dependencies
```bash
cd transform_geojson
pip install pyproj tqdm
```

`get_IL_places.py`
- Reads `data/input/NDI_202_Trt_AllStates.geojson` (national GeoJSON, any CRS).
- Filters features where `stabbr == 'IL'` and reprojects to WGS 84.
- Writes `data/output/NDI_202_Trt_IL_only_wgs84.geojson`.

```bash
cd transform_geojson
python get_IL_places.py
```


Deployment notes
----------------
- **Frontend base path:** by default the build output expects to be served at `/`.
  If hosting under a subpath (e.g. `/cha-mapping/`), use `npm run build:subpath`
  or pass `--base-href /your-path/` to `ng build`.
- **SPA routing fallback:** configure your server to rewrite all 404s to `index.html`.
- **Production API URL:** update `frontend/src/environments/environment.production.ts`
  with the URL of your deployed backend before running the production build.
- **Backend env vars:** set `NODE_ENV=production` and `DB_END_POINT_2` on the server.
- **Mapbox token:** provide `MAPBOX_TOKEN` in `.env` before building the frontend.


Developer utilities
-------------------
Generate PGP assets (used by the encrypted export flow):
```bash
cd frontend
npm run gen:pgp
```


Troubleshooting
---------------
- Map not loading: verify `MAPBOX_TOKEN` is set and the token has Mapbox GL and Search API access.
- Geo layers empty: confirm GeoJSON files exist in `frontend/public/data/` and are reachable at runtime.
- Config not loading: ensure the backend is running and MongoDB contains a configuration document (or POST one via the `/configuration` endpoint).
- Deployed app 404 on refresh: confirm your hosting is configured to serve `index.html` as the SPA fallback.
- Wrong asset paths after deploy: check that `--base-href` matches the subpath your server is serving the app under.


Contributing
------------
Contributions are welcome! Please follow these steps:

1. Fork the repository and create a feature branch from `main`.
2. Make your changes, keeping commits small and focused.
3. Ensure `npm run lint` and `npm test` pass in the `frontend/` directory.
4. Open a pull request with a clear description of the change and the motivation behind it.

Please do not commit `.env` files or any credentials.


License
-------
This project is licensed under the MIT License.

Copyright (c) 2025 UIC Innovation Center

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
