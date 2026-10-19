import { Routes } from '@angular/router';
import { AdminComponent } from './pages/admin/admin.component';
import { GalleryComponent } from './pages/gallery/gallery.component';
import { HomeComponent } from './pages/home/home.component';
import { SpecialtyComponent } from './pages/specialty/specialty.component';
import { UI_COPY } from './ui-copy';

export const routes: Routes = [
  { path: '', component: HomeComponent, title: UI_COPY.pageTitles.home },
  { path: 'gallery', component: GalleryComponent, title: UI_COPY.pageTitles.gallery },
  { path: 'admin', component: AdminComponent, title: UI_COPY.pageTitles.admin },
  { path: 'specialities/:slug', component: SpecialtyComponent },
  { path: '**', redirectTo: '' }
];
