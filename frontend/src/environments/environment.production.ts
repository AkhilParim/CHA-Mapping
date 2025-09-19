declare const process: any;

export const environment = {
    production: true,
    mapboxToken: process.env.MAPBOX_TOKEN || '',
    apiUrl: 'http://52.15.77.33/placeEditor',
    FACILITATOR_ZIP_PASSWORD: process.env.FACILITATOR_ZIP_PASSWORD || ''
};


