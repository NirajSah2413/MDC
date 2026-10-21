import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AdminProfile, Appointment, AppointmentStatus, ClinicOffer, Doctor, SiteContent } from '../models';
import { environment } from '../../environments/environment';

const TOKEN_KEY = 'mahamaya-admin-token';

@Injectable({ providedIn: 'root' })
export class ClinicApiService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  assetUrl(value: string): string {
    if (value.startsWith('/uploads/') || value.startsWith('/assets/uploads/')) {
      return `${this.apiUrl.replace(/\/api$/, '')}${value}`;
    }
    if (value.startsWith('/assets/')) return value;
    return '/assets/images/dental-care.jpg';
  }

  getPublicSite(): Observable<SiteContent> {
    return this.http.get<SiteContent>(`${this.apiUrl}/public/site`);
  }

  getPublicDoctors(): Observable<Doctor[]> {
    return this.http.get<Doctor[]>(`${this.apiUrl}/public/doctors`);
  }

  requestAppointment(request: {
    name: string;
    age: number;
    gender: string;
    phone: string;
    email: string;
    problem: string;
  }): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/public/appointments`, request);
  }

  login(username: string, password: string): Observable<{ token: string }> {
    return this.http.post<{ token: string }>(`${this.apiUrl}/admin/login`, { username, password });
  }

  getAdminProfile(): Observable<AdminProfile> {
    return this.http.get<AdminProfile>(`${this.apiUrl}/admin/profile`, { headers: this.adminHeaders() });
  }

  getAdminDoctors(): Observable<Doctor[]> {
    return this.http.get<Doctor[]>(`${this.apiUrl}/admin/doctors`, { headers: this.adminHeaders() });
  }

  saveDoctors(doctors: Doctor[]): Observable<{ doctors: Doctor[]; message: string }> {
    return this.http.put<{ doctors: Doctor[]; message: string }>(
      `${this.apiUrl}/admin/doctors`,
      doctors,
      { headers: this.adminHeaders() }
    );
  }

  saveAdminProfile(profile: AdminProfile): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${this.apiUrl}/admin/profile`, profile, { headers: this.adminHeaders() });
  }

  changeAdminPassword(currentPassword: string, newPassword: string): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(
      `${this.apiUrl}/admin/password`,
      { currentPassword, newPassword },
      { headers: this.adminHeaders() }
    );
  }

  getAppointments(): Observable<Appointment[]> {
    return this.http.get<Appointment[]>(`${this.apiUrl}/admin/appointments`, { headers: this.adminHeaders() });
  }

  getAppointmentArchive(year: number, month: number): Observable<{ year: number; month: number; appointments: Appointment[] }> {
    return this.http.get<{ year: number; month: number; appointments: Appointment[] }>(
      `${this.apiUrl}/admin/appointments/archive`,
      { headers: this.adminHeaders(), params: { year, month } }
    );
  }

  updateAppointment(id: string, status: AppointmentStatus): Observable<{ message: string }> {
    return this.http.patch<{ message: string }>(`${this.apiUrl}/admin/appointments/${encodeURIComponent(id)}`, { status }, { headers: this.adminHeaders() });
  }

  uploadImage(file: File): Observable<{ url: string }> {
    const form = new FormData();
    form.append('image', file);
    return this.http.post<{ url: string }>(`${this.apiUrl}/admin/uploads`, form, { headers: this.adminHeaders() });
  }

  getOffers(): Observable<ClinicOffer[]> {
    return this.http.get<ClinicOffer[]>(`${this.apiUrl}/admin/offers`, { headers: this.adminHeaders() });
  }

  createOffer(offer: Pick<ClinicOffer, 'title' | 'message' | 'image' | 'displayDate'>): Observable<{ offers: ClinicOffer[]; message: string }> {
    return this.http.post<{ offers: ClinicOffer[]; message: string }>(`${this.apiUrl}/admin/offers`, offer, { headers: this.adminHeaders() });
  }

  setOfferEnabled(id: string, enabled: boolean): Observable<{ offer: ClinicOffer; message: string }> {
    return this.http.patch<{ offer: ClinicOffer; message: string }>(
      `${this.apiUrl}/admin/offers/${encodeURIComponent(id)}`,
      { enabled },
      { headers: this.adminHeaders() }
    );
  }

  saveToken(token: string): void {
    sessionStorage.setItem(TOKEN_KEY, token);
  }

  clearToken(): void {
    sessionStorage.removeItem(TOKEN_KEY);
  }

  hasToken(): boolean {
    return !!sessionStorage.getItem(TOKEN_KEY);
  }

  private adminHeaders(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${sessionStorage.getItem(TOKEN_KEY) || ''}` });
  }
}
