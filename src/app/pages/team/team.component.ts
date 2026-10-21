import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AppointmentModalComponent } from '../../components/appointment-modal/appointment-modal.component';
import { ClinicDetails, Doctor } from '../../models';
import { ClinicApiService } from '../../services/clinic-api.service';
import { UI_COPY } from '../../ui-copy';

@Component({
  selector: 'app-team',
  standalone: true,
  imports: [CommonModule, RouterLink, AppointmentModalComponent],
  templateUrl: './team.component.html'
})
export class TeamComponent implements OnInit {
  private readonly api = inject(ClinicApiService);
  readonly copy = UI_COPY;
  readonly today = new Date();
  doctors: Doctor[] = [];
  clinic?: ClinicDetails;
  loading = true;
  error = '';
  menuOpen = false;
  appointmentOpen = false;

  ngOnInit(): void {
    forkJoin({
      doctors: this.api.getPublicDoctors(),
      site: this.api.getPublicSite()
    }).subscribe({
      next: result => {
        this.doctors = result.doctors;
        this.clinic = result.site.clinic;
        this.loading = false;
        document.title = `${this.copy.pageTitles.team}${this.copy.pageTitles.separator}${this.copy.brand.name}`;
      },
      error: (error: HttpErrorResponse) => {
        this.loading = false;
        this.error = error.error?.error || this.copy.team.loadError;
      }
    });
  }

  imageUrl(url: string): string {
    return this.api.assetUrl(url);
  }
}
