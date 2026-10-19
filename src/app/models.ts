export type AppointmentStatus = 'waiting' | 'done' | 'cancelled';

export interface ClinicDetails {
  name: string;
  tagline: string;
  phones: string[];
  email: string;
  address: string;
  hours: string;
  mapUrl: string;
}

export interface GalleryImage {
  title: string;
  image: string;
}

export interface Specialty {
  slug: string;
  name: string;
  image: string;
  description: string;
  descriptionEn?: string;
  descriptionHi?: string;
}

export interface Promotion {
  id?: string;
  enabled: boolean;
  title: string;
  message: string;
  image: string;
  startsAt: string;
  endsAt: string;
}

export interface ClinicOffer {
  id: string;
  title: string;
  message: string;
  image: string;
  displayDate: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ClinicReview {
  author: string;
  rating: number;
  quote: string;
}

export interface SiteContent {
  clinic: ClinicDetails;
  gallery: GalleryImage[];
  specialties: Specialty[];
  reviews: ClinicReview[];
  promotion: Promotion;
}

export interface Appointment {
  id: string;
  name: string;
  age: number;
  gender: string;
  phone: string;
  email: string;
  problem: string;
  status: AppointmentStatus;
  requestedAt: string;
  statusUpdatedAt: string | null;
}

export interface AdminProfile {
  username: string;
  fullName: string;
  phone: string;
  email: string;
  imageUrl: string;
}
