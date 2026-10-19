import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map, switchMap } from 'rxjs';
import { AppointmentModalComponent } from '../../components/appointment-modal/appointment-modal.component';
import { SiteContent, Specialty } from '../../models';
import { ClinicApiService } from '../../services/clinic-api.service';
import { UI_COPY } from '../../ui-copy';

@Component({
  selector: 'app-specialty',
  standalone: true,
  imports: [CommonModule, RouterLink, AppointmentModalComponent],
  templateUrl: './specialty.component.html'
})
export class SpecialtyComponent implements OnInit {
  private readonly api = inject(ClinicApiService);
  private readonly route = inject(ActivatedRoute);
  readonly copy = UI_COPY;
  @ViewChild('specialtyRail') private specialtyRail?: ElementRef<HTMLDivElement>;
  readonly justdialUrl = 'https://www.justdial.com/Bilaspur-Chhattisgarh/MAHAMAYA-DANT-CHIKITSALAYA-Near-Dp-Vipra-Law-College-Sarkanda/9999P7752-7752-250313105920-P9C4_BZDET';
  readonly today = new Date();
  site?: SiteContent;
  specialty?: Specialty;
  error = '';
  appointmentOpen = false;
  menuOpen = false;

  ngOnInit(): void {
    this.route.paramMap.pipe(
      switchMap(params => this.api.getPublicSite().pipe(
        map(site => ({ site, slug: params.get('slug') }))
      ))
    ).subscribe({
      next: ({ site, slug }) => {
        this.site = site;
        this.specialty = site.specialties.find(item => item.slug === slug);
        this.error = this.specialty ? '' : this.copy.specialty.notFound;
        document.title = this.specialty
          ? `${this.specialty.name}${this.copy.pageTitles.separator}${site.clinic.name}`
          : this.copy.specialty.notFound;
      },
      error: (error: HttpErrorResponse) => {
        this.error = error.error?.error || this.copy.specialty.unavailable;
      }
    });
  }

  imageUrl(url: string): string {
    return this.api.assetUrl(url);
  }

  scrollSpecialties(direction: -1 | 1): void {
    this.specialtyRail?.nativeElement.scrollBy({ left: direction * 295, behavior: 'smooth' });
  }
}
