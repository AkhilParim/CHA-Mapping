import { Routes } from '@angular/router';
import { PlaceEditorComponent } from './components/place-editor/place-editor.component';
import { JourneyPlannerComponent } from './components/journey-planner/journey-planner.component';

export const routes: Routes = [
    {
        path: 'add',
        component: PlaceEditorComponent
    },
    {
        path: '',
        component: JourneyPlannerComponent
    }
];
