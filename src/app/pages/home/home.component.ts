import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, OnInit, ViewChild, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { AppointmentModalComponent } from '../../components/appointment-modal/appointment-modal.component';
import { SiteContent } from '../../models';
import { ClinicApiService } from '../../services/clinic-api.service';
import { UI_COPY } from '../../ui-copy';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, AppointmentModalComponent],
  styleUrl: './home.component.scss',
  templateUrl: './home.component.html'
})
export class HomeComponent implements OnInit {
  private readonly api = inject(ClinicApiService);
  readonly copy = UI_COPY;
  @ViewChild('specialtyRail') private specialtyRail?: ElementRef<HTMLDivElement>;
  readonly justdialUrl = 'https://www.justdial.com/Bilaspur-Chhattisgarh/MAHAMAYA-DANT-CHIKITSALAYA-Near-Dp-Vipra-Law-College-Sarkanda/9999P7752-7752-250313105920-P9C4_BZDET';
  readonly today = new Date();
  readonly galleryPreview = [
    { image: '/assets/images/clinic-interior.jpg', title: UI_COPY.home.galleryCaptions[0] },
    { image: '/assets/images/teeth-exam.jpg', title: UI_COPY.home.galleryCaptions[1] },
    { image: '/assets/images/orthodontics.jpg', title: UI_COPY.home.galleryCaptions[2] },
    { image: '/assets/images/clinic-team.jpg', title: UI_COPY.home.galleryCaptions[3] },
    { image: '/assets/images/child-dentistry.jpg', title: UI_COPY.home.galleryCaptions[4] }
  ];
  site?: SiteContent;
  error = '';
  appointmentOpen = false;
  promotionOpen = false;
  menuOpen = false;
  loading = true;

  imageUrl(url: string): string {
    return this.api.assetUrl(url);
  }

  scrollSpecialties(direction: -1 | 1): void {
    this.specialtyRail?.nativeElement.scrollBy({ left: direction * 295, behavior: 'smooth' });
  }

  ngOnInit(): void {
    this.loadSiteContent();
  }

  loadSiteContent(): void {
    this.loading = true;
    this.error = '';
    this.api.getPublicSite().subscribe({
      next: site => {
        this.site = site;
        this.loading = false;
        this.promotionOpen = this.promoIsLive(site);
      },
      error: (error: HttpErrorResponse) => {
        this.loading = false;
        this.error = error.status === 0
          ? this.copy.home.apiUnavailable
          : error.error?.error || this.copy.home.loadError;
      }
    });
  }

  @HostListener('document:keydown.escape')
  closeOverlays(): void {
    this.appointmentOpen = false;
    this.promotionOpen = false;
  }

  private promoIsLive(site: SiteContent): boolean {
    const promo = site.promotion;
    const todayParts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(new Date());
    const todayValues = Object.fromEntries(todayParts.map(part => [part.type, part.value]));
    const today = `${todayValues['year']}-${todayValues['month']}-${todayValues['day']}`;
    return promo.enabled && !!promo.title && !!promo.message &&
      promo.startsAt.slice(0, 10) === today;
  }

  dismissPromo(): void {
    this.promotionOpen = false;
  }
}
