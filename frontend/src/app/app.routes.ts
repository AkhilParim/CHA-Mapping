import { Routes } from '@angular/router';
import { PlaceEditorComponent } from './components/place-editor/place-editor.component';
import { JourneyPlannerComponent } from './components/journey-planner/journey-planner.component';

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
        path: '',
        redirectTo: 'journey-planner',
        pathMatch: 'full'
    },
    {
        path: '**',
        redirectTo: 'journey-planner'
    }
];
