import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import {
  AdminProfile,
  Appointment,
  AppointmentStatus,
  ClinicOffer,
  Doctor,
} from '../../models';
import { ClinicApiService } from '../../services/clinic-api.service';
import { UI_COPY } from '../../ui-copy';

type AdminTab = 'appointments' | 'doctors' | 'promotion' | 'profile';

const currentClinicYear = Number(
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
  }).format(new Date()),
);

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './admin.component.html',
})
export class AdminComponent implements OnInit {
  private readonly api = inject(ClinicApiService);
  readonly copy = UI_COPY;
  username = '';
  password = '';
  loginError = '';
  requestError = '';
  busy = false;
  loading = false;
  signedIn = false;
  tab: AdminTab = 'appointments';
  filter: 'waiting' | 'done' | 'cancelled' | 'all' = 'waiting';
  appointments: Appointment[] = [];
  archiveAppointments: Appointment[] = [];
  archiveSearched = false;
  archiveLoading = false;
  readonly archiveYears = Array.from(
    { length: 10 },
    (_, index) => currentClinicYear - index,
  );
  readonly archiveMonths = Array.from({ length: 12 }, (_, index) => index + 1);
  readonly offerMinDate = this.clinicDate();
  archiveYear = currentClinicYear;
  archiveMonth = new Date().getMonth() + 1;
  offers: ClinicOffer[] = [];
  newOffer = { title: '', message: '', image: '', displayDate: '' };
  doctors: Doctor[] = [];
  newDoctorImageFile: File | null = null;
  newDoctor = {
    name: '',
    qualification: '',
    description: '',
    expertise: '',
    image: '',
  };
  profile?: AdminProfile;
  notice = '';
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';
  showCurrentPassword = false;
  showNewPassword = false;
  showConfirmPassword = false;

  ngOnInit(): void {
    if (this.api.hasToken()) this.loadDashboard();
  }

  signIn(): void {
    this.loginError = '';
    this.busy = true;
    this.api.login(this.username, this.password).subscribe({
      next: (result) => {
        this.api.saveToken(result.token);
        this.password = '';
        window.alert(this.copy.admin.loginSuccessful);
        this.loadDashboard();
      },
      error: (error: HttpErrorResponse) => {
        this.loginError = error.error?.error || this.copy.admin.loginError;
        this.busy = false;
      },
    });
  }

  signOut(): void {
    this.api.clearToken();
    this.signedIn = false;
    this.appointments = [];
  }

  loadDashboard(): void {
    this.loading = true;
    this.requestError = '';
    forkJoin({
      appointments: this.api.getAppointments(),
      profile: this.api.getAdminProfile(),
      offers: this.api.getOffers(),
      doctors: this.api.getAdminDoctors(),
    }).subscribe({
      next: (result) => {
        this.profile = result.profile;
        this.appointments = result.appointments;
        this.offers = result.offers;
        this.doctors = result.doctors;
        this.signedIn = true;
        this.busy = false;
        this.loading = false;
      },
      error: (error: HttpErrorResponse) => {
        this.busy = false;
        this.loading = false;
        if (error.status === 401) {
          this.api.clearToken();
          this.loginError = this.copy.admin.sessionExpired;
        } else {
          this.requestError =
            error.error?.error || this.copy.admin.loadDashboardError;
        }
      },
    });
  }

  selectTab(tab: AdminTab): void {
    this.tab = tab;
    this.notice = '';
    this.requestError = '';
  }

  get waitingCount(): number {
    return this.appointments.filter(
      (appointment) => appointment.status === 'waiting',
    ).length;
  }

  get doneCount(): number {
    return this.appointments.filter(
      (appointment) => appointment.status === 'done',
    ).length;
  }

  get cancelledCount(): number {
    return this.appointments.filter(
      (appointment) => appointment.status === 'cancelled',
    ).length;
  }

  get visibleAppointments(): Appointment[] {
    return this.appointments
      .filter((item) => this.filter === 'all' || item.status === this.filter)
      .sort((a, b) => {
        if (this.filter === 'all') {
          const order: Record<AppointmentStatus, number> = {
            waiting: 0,
            cancelled: 1,
            done: 2,
          };
          if (order[a.status] !== order[b.status])
            return order[a.status] - order[b.status];
        }
        if (a.status === 'done' && b.status === 'done') {
          return (
            new Date(a.requestedAt).getTime() -
            new Date(b.requestedAt).getTime()
          );
        }
        return (
          new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()
        );
      });
  }

  get activeOrScheduledOffers(): ClinicOffer[] {
    const today = this.clinicDate();
    return this.offers.filter(
      (offer) => offer.enabled && offer.displayDate >= today,
    );
  }

  get pastOrInactiveOffers(): ClinicOffer[] {
    const today = this.clinicDate();
    return this.offers.filter(
      (offer) => !offer.enabled || offer.displayDate < today,
    );
  }

  isOfferExpired(offer: ClinicOffer): boolean {
    return offer.displayDate < this.clinicDate();
  }

  isOfferLive(offer: ClinicOffer): boolean {
    return offer.enabled && offer.displayDate === this.clinicDate();
  }

  searchArchive(): void {
    this.archiveLoading = true;
    this.requestError = '';
    this.api
      .getAppointmentArchive(this.archiveYear, this.archiveMonth)
      .subscribe({
        next: (archive) => {
          this.archiveAppointments = archive.appointments;
          this.archiveSearched = true;
          this.archiveLoading = false;
        },
        error: (error: HttpErrorResponse) => {
          this.archiveLoading = false;
          this.requestError =
            error.error?.error || this.copy.admin.archiveLoadError;
        },
      });
  }

  updateStatus(appointment: Appointment, status: AppointmentStatus): void {
    this.busy = true;
    this.api.updateAppointment(appointment.id, status).subscribe({
      next: () => {
        appointment.status = status;
        appointment.statusUpdatedAt = new Date().toISOString();
        const archivedAppointment = this.archiveAppointments.find(
          (item) => item.id === appointment.id,
        );
        if (archivedAppointment && archivedAppointment !== appointment) {
          archivedAppointment.status = status;
          archivedAppointment.statusUpdatedAt = appointment.statusUpdatedAt;
        }
        const recentAppointment = this.appointments.find(
          (item) => item.id === appointment.id,
        );
        if (recentAppointment && recentAppointment !== appointment) {
          recentAppointment.status = status;
          recentAppointment.statusUpdatedAt = appointment.statusUpdatedAt;
        }
        this.busy = false;
        this.notice = this.copy.admin.appointmentMarked[status];
      },
      error: (error: HttpErrorResponse) => {
        this.busy = false;
        this.requestError =
          error.error?.error || this.copy.admin.updateAppointmentError;
      },
    });
  }

  saveProfile(): void {
    if (!this.profile) return;
    this.busy = true;
    this.api.saveAdminProfile(this.profile).subscribe({
      next: (result) => {
        this.busy = false;
        this.notice = result.message;
        this.requestError = '';
      },
      error: (error: HttpErrorResponse) => {
        this.busy = false;
        this.requestError =
          error.error?.error || this.copy.admin.saveProfileError;
      },
    });
  }

  changePassword(): void {
    this.requestError = '';
    if (!this.passwordIsStrong) {
      this.requestError = this.copy.admin.passwordRequirementsError;
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.requestError = this.copy.admin.passwordMismatch;
      return;
    }
    this.busy = true;
    this.api
      .changeAdminPassword(this.currentPassword, this.newPassword)
      .subscribe({
        next: (result) => {
          this.busy = false;
          this.currentPassword = '';
          this.newPassword = '';
          this.confirmPassword = '';
          this.showCurrentPassword = false;
          this.showNewPassword = false;
          this.showConfirmPassword = false;
          this.notice = result.message;
        },
        error: (error: HttpErrorResponse) => {
          this.busy = false;
          this.requestError =
            error.error?.error || this.copy.admin.changePasswordError;
        },
      });
  }

  get passwordIsStrong(): boolean {
    return (
      this.passwordHasMinLength &&
      this.passwordHasLowercase &&
      this.passwordHasUppercase &&
      this.passwordHasNumber &&
      this.passwordHasSymbol
    );
  }

  get passwordHasMinLength(): boolean {
    return this.newPassword.length >= 12;
  }

  get passwordHasLowercase(): boolean {
    return /[a-z]/.test(this.newPassword);
  }

  get passwordHasUppercase(): boolean {
    return /[A-Z]/.test(this.newPassword);
  }

  get passwordHasNumber(): boolean {
    return /\d/.test(this.newPassword);
  }

  get passwordHasSymbol(): boolean {
    return /[^A-Za-z0-9\s]/.test(this.newPassword);
  }

  get passwordStrengthScore(): number {
    return [
      this.passwordHasMinLength,
      this.passwordHasLowercase,
      this.passwordHasUppercase,
      this.passwordHasNumber,
      this.passwordHasSymbol,
    ].filter(Boolean).length;
  }

  get passwordsMatch(): boolean {
    return !!this.confirmPassword && this.newPassword === this.confirmPassword;
  }

  uploadProfileImage(file: File | null): void {
    if (!file || !this.profile) return;
    this.busy = true;
    this.api.uploadImage(file).subscribe({
      next: (result) => {
        if (this.profile) this.profile.imageUrl = result.url;
        this.busy = false;
        this.notice = this.copy.admin.profileImageUploaded;
      },
      error: (error: HttpErrorResponse) => {
        this.busy = false;
        this.requestError =
          error.error?.error || this.copy.admin.profileImageError;
      },
    });
  }

  uploadOfferImage(file: File | null): void {
    if (!file) return;
    this.busy = true;
    this.api.uploadImage(file).subscribe({
      next: (result) => {
        this.newOffer.image = result.url;
        this.busy = false;
        this.notice = this.copy.admin.offerImageUploaded;
      },
      error: (error: HttpErrorResponse) => {
        this.busy = false;
        this.requestError =
          error.error?.error || this.copy.admin.uploadImageError;
      },
    });
  }

  createOffer(): void {
    if (!this.newOffer.displayDate) {
      this.requestError = this.copy.admin.offerDateRequired;
      return;
    }
    this.busy = true;
    this.requestError = '';
    this.api.createOffer(this.newOffer).subscribe({
      next: (result) => {
        this.offers = result.offers;
        this.newOffer = { title: '', message: '', image: '', displayDate: '' };
        this.busy = false;
        this.notice = result.message;
      },
      error: (error: HttpErrorResponse) => {
        this.busy = false;
        this.requestError =
          error.error?.error || this.copy.admin.offerSaveError;
      },
    });
  }

  toggleOffer(offer: ClinicOffer): void {
    if (this.isOfferExpired(offer)) return;
    const previousValue = offer.enabled;
    offer.enabled = !offer.enabled;
    this.busy = true;
    this.api.setOfferEnabled(offer.id, offer.enabled).subscribe({
      next: (result) => {
        Object.assign(offer, result.offer);
        this.busy = false;
        this.notice = result.message;
      },
      error: (error: HttpErrorResponse) => {
        offer.enabled = previousValue;
        this.busy = false;
        this.requestError =
          error.error?.error || this.copy.admin.offerToggleError;
      },
    });
  }

  removeDoctor(index: number): void {
    if (this.busy || !this.doctors[index]) return;
    this.persistDoctors(
      this.doctors.filter((_, doctorIndex) => doctorIndex !== index),
    );
  }

  saveDoctors(): void {
    if (this.busy) return;
    const hasNewDoctor =
      !!this.newDoctor.name.trim() ||
      !!this.newDoctor.qualification.trim() ||
      !!this.newDoctor.description.trim() ||
      !!this.newDoctor.expertise.trim() ||
      !!this.newDoctorImageFile;

    if (
      hasNewDoctor &&
      (!this.newDoctor.name.trim() ||
        !this.newDoctor.description.trim() ||
        !this.newDoctor.expertise.trim())
    ) {
      this.requestError = this.copy.admin.doctorRequiredFields;
      return;
    }

    this.requestError = '';
    const persist = (newDoctor?: Doctor): void => {
      const doctors = newDoctor ? [...this.doctors, newDoctor] : this.doctors;
      this.persistDoctors(doctors, () => {
        if (!newDoctor) return;
        this.newDoctor = {
          name: '',
          qualification: '',
          description: '',
          expertise: '',
          image: '',
        };
        this.newDoctorImageFile = null;
      });
    };

    if (!hasNewDoctor) {
      persist();
      return;
    }

    const doctor: Doctor = {
      id: crypto.randomUUID(),
      ...this.newDoctor,
    };
    if (!this.newDoctorImageFile) {
      persist(doctor);
      return;
    }

    this.busy = true;
    this.api.uploadImage(this.newDoctorImageFile).subscribe({
      next: (result) => {
        doctor.image = result.url;
        persist(doctor);
      },
      error: (error: HttpErrorResponse) => {
        this.busy = false;
        this.requestError =
          error.error?.error || this.copy.admin.uploadImageError;
      },
    });
  }

  private persistDoctors(
    doctors: Doctor[],
    onSaved?: () => void,
    successMessage?: string,
  ): void {
    this.busy = true;
    this.requestError = '';
    this.api.saveDoctors(doctors).subscribe({
      next: (result) => {
        this.doctors = result.doctors;
        this.busy = false;
        this.notice = successMessage || result.message;
        onSaved?.();
      },
      error: (error: HttpErrorResponse) => {
        this.busy = false;
        this.requestError =
          error.error?.error || this.copy.admin.doctorsSaveError;
      },
    });
  }

  selectNewDoctorImage(file: File | null): void {
    this.newDoctorImageFile = file;
    this.requestError = '';
  }

  uploadDoctorImage(file: File | null, index: number): void {
    if (!file || !this.doctors[index] || this.busy) return;
    this.busy = true;
    this.api.uploadImage(file).subscribe({
      next: (result) => {
        this.doctors[index].image = result.url;
        this.persistDoctors(
          this.doctors,
          undefined,
          this.copy.admin.doctorImageUploaded,
        );
      },
      error: (error: HttpErrorResponse) => {
        this.busy = false;
        this.requestError =
          error.error?.error || this.copy.admin.uploadImageError;
      },
    });
  }

  imageUrl(url: string): string {
    return this.api.assetUrl(url);
  }

  formatDate(value: string | null): string {
    if (!value) return '';
    return new Intl.DateTimeFormat('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value));
  }

  formatOfferDate(value: string): string {
    const date = new Date(`${value}T12:00:00`);
    return new Intl.DateTimeFormat('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'Asia/Kolkata',
    }).format(date);
  }

  private clinicDate(): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const values = Object.fromEntries(
      parts.map((part) => [part.type, part.value]),
    );
    return `${values['year']}-${values['month']}-${values['day']}`;
  }

  exportCsv(): void {
    const headings = this.copy.admin.csvHeadings;
    const rows = this.appointments.map((item) => [
      item.name,
      item.age,
      item.gender,
      `+91 ${item.phone}`,
      item.email,
      item.problem,
      item.status,
      this.formatDate(item.requestedAt),
      item.statusUpdatedAt ? this.formatDate(item.statusUpdatedAt) : '',
    ]);
    const csv = [headings, ...rows]
      .map((row) =>
        row
          .map((value) => {
            const text = String(value);
            const firstMeaningfulCharacter = Array.from(text).find(
              (character) => {
                const codePoint = character.codePointAt(0);
                return (
                  codePoint !== undefined &&
                  codePoint > 0x20 &&
                  codePoint !== 0xfeff
                );
              },
            );
            const safeText =
              firstMeaningfulCharacter &&
              ['=', '+', '-', '@'].includes(firstMeaningfulCharacter)
                ? `'${text}`
                : text;
            return `"${safeText.replace(/"/g, '""')}"`;
          })
          .join(','),
      )
      .join('\r\n');
    const link = document.createElement('a');
    const url = URL.createObjectURL(
      new Blob([csv], { type: 'text/csv;charset=utf-8' }),
    );
    link.href = url;
    link.download = 'mahamaya-appointments.csv';
    link.click();
    URL.revokeObjectURL(url);
  }
}
