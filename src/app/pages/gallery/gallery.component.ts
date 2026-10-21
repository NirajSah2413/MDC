import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { AppointmentModalComponent } from '../../components/appointment-modal/appointment-modal.component';
import { GalleryImage, SiteContent } from '../../models';
import { ClinicApiService } from '../../services/clinic-api.service';
import { UI_COPY } from '../../ui-copy';

@Component({
  selector: 'app-gallery',
  standalone: true,
  imports: [CommonModule, RouterLink, AppointmentModalComponent],
  templateUrl: './gallery.component.html'
})
export class GalleryComponent implements OnInit, OnDestroy {
  private readonly api = inject(ClinicApiService);
  private readonly sanitizer = inject(DomSanitizer);
  private videoObserver?: IntersectionObserver;
  private slideTimer?: number;
  private galleryRail?: ElementRef<HTMLDivElement>;
  @ViewChild('galleryRail') set galleryRailRef(element: ElementRef<HTMLDivElement> | undefined) {
    this.galleryRail = element;
  }
  @ViewChild('videoSection') set videoSectionRef(element: ElementRef<HTMLElement> | undefined) {
    if (!element || !this.safeVideoUrl) return;
    if (typeof IntersectionObserver === 'undefined') {
      this.videoStarted = true;
      return;
    }
    this.videoObserver?.disconnect();
    this.videoObserver = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        this.videoStarted = true;
        this.videoObserver?.disconnect();
      }
    }, { rootMargin: '80px' });
    this.videoObserver.observe(element.nativeElement);
  }
  readonly copy = UI_COPY;
  readonly today = new Date();
  readonly galleryPreview: GalleryImage[] = [
    { image: '/assets/images/clinic-interior.jpg', title: UI_COPY.home.galleryCaptions[0] },
    { image: '/assets/images/teeth-exam.jpg', title: UI_COPY.home.galleryCaptions[1] },
    { image: '/assets/images/orthodontics.jpg', title: UI_COPY.home.galleryCaptions[2] },
    { image: '/assets/images/clinic-team.jpg', title: UI_COPY.home.galleryCaptions[3] },
    { image: '/assets/images/child-dentistry.jpg', title: UI_COPY.home.galleryCaptions[4] }
  ];
  site?: SiteContent;
  loading = true;
  error = '';
  menuOpen = false;
  appointmentOpen = false;
  activeSlide = 0;
  videoStarted = false;
  safeVideoUrl: SafeResourceUrl | null = null;
  videoError = '';

  ngOnInit(): void {
    this.safeVideoUrl = this.sanitizeYoutubeUrl(this.copy.gallery.demoVideoUrl);
    this.api.getPublicSite().subscribe({
      next: site => {
        this.site = site;
        this.loading = false;
        if (this.gallerySlides.length > 1 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          this.slideTimer = window.setInterval(() => this.nextSlide(), 5000);
        }
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

  get gallerySlides(): GalleryImage[] {
    return this.site?.gallery.length ? this.site.gallery : this.galleryPreview;
  }

  nextSlide(): void {
    this.activeSlide = (this.activeSlide + 1) % this.gallerySlides.length;
  }

  previousSlide(): void {
    this.activeSlide = (this.activeSlide - 1 + this.gallerySlides.length) % this.gallerySlides.length;
  }

  scrollGallery(direction: -1 | 1): void {
    this.galleryRail?.nativeElement.scrollBy({ left: direction * 360, behavior: 'smooth' });
  }

  ngOnDestroy(): void {
    if (this.slideTimer !== undefined) window.clearInterval(this.slideTimer);
    this.videoObserver?.disconnect();
  }

  private sanitizeYoutubeUrl(value: string): SafeResourceUrl | null {
    let url: URL;
    try {
      url = new URL(value);
    } catch (error) {
      if (!(error instanceof TypeError)) throw error;
      this.videoError = this.copy.gallery.videoUnavailable;
      return null;
    }
    const allowedHosts = new Set(['youtube.com', 'www.youtube.com', 'youtu.be']);
    if (!allowedHosts.has(url.hostname) || url.protocol !== 'https:' || url.port ||
        url.username || url.password || (url.hostname !== 'youtu.be' && url.pathname !== '/watch')) {
      this.videoError = this.copy.gallery.videoUnavailable;
      return null;
    }
    const videoId = url.hostname === 'youtu.be'
      ? url.pathname.slice(1)
      : url.searchParams.get('v') || '';
    if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
      this.videoError = this.copy.gallery.videoUnavailable;
      return null;
    }
    return this.sanitizer.bypassSecurityTrustResourceUrl(
      `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=1&controls=1&playsinline=1&rel=0`
    );
  }
}
