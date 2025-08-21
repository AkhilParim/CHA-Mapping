import { Routes } from '@angular/router';
import { PlaceEditorComponent } from './components/place-editor/place-editor.component';
import { JourneyPlannerComponent } from './components/journey-planner/journey-planner.component';
import { ConfigurationComponent } from './components/configuration/configuration.component';

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
        path: '',
        redirectTo: 'journey-planner',
        pathMatch: 'full'
    },
    {
        path: '**',
        redirectTo: 'journey-planner'
    }
];
