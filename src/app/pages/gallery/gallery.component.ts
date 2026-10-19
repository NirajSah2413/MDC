import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AppointmentModalComponent } from '../../components/appointment-modal/appointment-modal.component';
import { SiteContent } from '../../models';
import { ClinicApiService } from '../../services/clinic-api.service';
import { UI_COPY } from '../../ui-copy';

@Component({
  selector: 'app-gallery',
  standalone: true,
  imports: [CommonModule, RouterLink, AppointmentModalComponent],
  templateUrl: './gallery.component.html'
})
export class GalleryComponent implements OnInit {
  private readonly api = inject(ClinicApiService);
  readonly copy = UI_COPY;
  readonly today = new Date();
  site?: SiteContent;
  loading = true;
  error = '';
  menuOpen = false;
  appointmentOpen = false;

  ngOnInit(): void {
    this.api.getPublicSite().subscribe({
      next: site => {
        this.site = site;
        this.loading = false;
        document.title = `${this.copy.gallery.title}${this.copy.pageTitles.separator}${site.clinic.name}`;
      },
      error: (error: HttpErrorResponse) => {
        this.loading = false;
        this.error = error.error?.error || this.copy.gallery.loadError;
      }
    });
  }

  imageUrl(url: string): string {
    return this.api.assetUrl(url);
  }
}
