import { Routes } from '@angular/router';
import { PlaceEditorComponent } from './components/place-editor/place-editor.component';
import { JourneyPlannerComponent } from './components/journey-planner/journey-planner.component';
import { ConfigurationComponent } from './components/configuration/configuration.component';
import { AddressLookupComponent } from './components/address-lookup/address-lookup.component';
import { EmotionLookupComponent } from './components/emotion-lookup/emotion-lookup.component';

export const routes: Routes = [
    {
        path: 'place-editor',
        component: PlaceEditorComponent
    },
    {
        path: 'journey-planner',
        component: JourneyPlannerComponent
    },
    {
        path: 'configuration',
        component: ConfigurationComponent
    },
    {
        path: 'address-lookup',
        component: AddressLookupComponent
    },
    {
        path: 'emotion-lookup',
        component: EmotionLookupComponent
    },
    {
        path: '',
        redirectTo: 'journey-planner',
        pathMatch: 'full'
    },
    {
        path: '**',
        redirectTo: 'journey-planner'
    }
];
