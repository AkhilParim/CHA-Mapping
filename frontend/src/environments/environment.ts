declare const process: any;

export const environment = {
    mapboxToken: process.env.MAPBOX_TOKEN || '',
    apiUrl: 'http://52.15.77.33/placeEditor',
    // Facilitator ZIP password for export encryption
    FACILITATOR_ZIP_PASSWORD: process.env.FACILITATOR_ZIP_PASSWORD || ''
};