import { Routes } from '@angular/router';
import { UI_COPY } from './ui-copy';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/home/home.component').then(module => module.HomeComponent), title: UI_COPY.pageTitles.home },
  { path: 'gallery', loadComponent: () => import('./pages/gallery/gallery.component').then(module => module.GalleryComponent), title: UI_COPY.pageTitles.gallery },
  { path: 'team', loadComponent: () => import('./pages/team/team.component').then(module => module.TeamComponent), title: UI_COPY.pageTitles.team },
  { path: 'admin', loadComponent: () => import('./pages/admin/admin.component').then(module => module.AdminComponent), title: UI_COPY.pageTitles.admin },
  { path: 'specialities/:slug', loadComponent: () => import('./pages/specialty/specialty.component').then(module => module.SpecialtyComponent) },
  { path: '**', redirectTo: '' }
];
