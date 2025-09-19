declare const process: any;

export const environment = {
    mapboxToken: process.env.MAPBOX_TOKEN || '',
    apiUrl: 'http://52.15.77.33/placeEditor',
    // apiUrl: 'http://localhost:3050', // Local development server
    FACILITATOR_ZIP_PASSWORD: process.env.FACILITATOR_ZIP_PASSWORD || ''
};