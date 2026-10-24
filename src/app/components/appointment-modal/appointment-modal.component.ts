import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  Output,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ClinicDetails } from '../../models';
import { ClinicApiService } from '../../services/clinic-api.service';
import { UI_COPY } from '../../ui-copy';

@Component({
  selector: 'app-appointment-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './appointment-modal.component.html',
})
export class AppointmentModalComponent {
  readonly copy = UI_COPY;
  @Input() open = false;
  @Input({ required: true }) clinic!: ClinicDetails;
  @Output() closed = new EventEmitter<void>();
  private readonly api = inject(ClinicApiService);
  submitting = false;
  error = '';
  success = '';
  form = {
    name: '',
    age: null as number | null,
    gender: '',
    phone: '',
    email: '',
    problem: '',
  };

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open) this.close();
  }

  close(): void {
    this.closed.emit();
    this.error = '';
    this.success = '';
  }

  submit(): void {
    this.error = '';
    this.success = '';
    const phone = this.form.phone.replace(/\D/g, '');
    if (
      !this.form.name.trim() ||
      !this.form.age ||
      this.form.age < 1 ||
      this.form.age > 120 ||
      !this.form.gender ||
      !/^\d{10}$/.test(phone)
    ) {
      this.error = this.copy.appointment.validationError;
      return;
    }
    this.submitting = true;
    this.api
      .requestAppointment({
        ...this.form,
        name: this.form.name.trim(),
        age: this.form.age,
        phone,
        email: this.form.email.trim(),
      })
      .subscribe({
        next: (result) => {
          this.success = result.message;
          this.form = {
            name: '',
            age: null,
            gender: '',
            phone: '',
            email: '',
            problem: '',
          };
          this.submitting = false;
        },
        error: (error: HttpErrorResponse) => {
          this.error = error.error?.error || this.copy.appointment.requestError;
          this.submitting = false;
        },
      });
  }

  phoneHref(phone: string): string {
    return `tel:+91${phone.replace(/\D/g, '').slice(-10)}`;
  }
}
