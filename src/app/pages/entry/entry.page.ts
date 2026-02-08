import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators
} from '@angular/forms';
import { startWith } from 'rxjs';

import {
  IonContent,
  IonHeader,
  IonIcon,
  IonTitle,
  IonToast,
  IonToolbar
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { addCircleOutline, calendarOutline } from 'ionicons/icons';

import { PreferencesService } from '../../services/preferences.service';
import { SessionsStoreService } from '../../services/sessions-store.service';

type SessionFormGroup = FormGroup<{
  start: FormControl<string>;
  end: FormControl<string>;
  hourlyRate: FormControl<string>;
}>;

@Component({
  selector: 'app-entry-page',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonContent,
    IonHeader,
    IonIcon,
    IonTitle,
    IonToast,
    IonToolbar
  ],
  templateUrl: './entry.page.html',
  styleUrl: './entry.page.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EntryPage {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly sessionsStore = inject(SessionsStoreService);
  private readonly preferences = inject(PreferencesService);

  protected readonly saving = signal(false);
  protected readonly toastOpen = signal(false);
  protected readonly toastMessage = signal('');
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly lastSessionHours = signal<number | null>(null);
  protected readonly lastSessionIncome = signal<number | null>(null);

  protected readonly form: SessionFormGroup = this.fb.group({
    start: this.fb.control('', { validators: [Validators.required] }),
    end: this.fb.control('', { validators: [Validators.required] }),
    hourlyRate: this.fb.control('20.00', {
      validators: [Validators.required, Validators.pattern(/^\d+(\.\d{1,2})?$/)]
    })
  });

  private readonly formValueSignal = toSignal(
    this.form.valueChanges.pipe(startWith(this.form.getRawValue())),
    { initialValue: this.form.getRawValue() }
  );

  protected readonly durationPreview = computed<number | null>(() => {
    const { start, end } = this.formValueSignal();
    if (!start || !end) {
      return null;
    }

    const startTime = new Date(start).getTime();
    const endTime = new Date(end).getTime();
    if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime < startTime) {
      return null;
    }

    return this.roundTo2((endTime - startTime) / (1000 * 60 * 60));
  });

  protected readonly estimatedIncome = computed<number | null>(() => {
    const hours = this.durationPreview();
    const rate = this.parseHourlyRate(this.formValueSignal().hourlyRate ?? '');
    if (hours === null || rate === null) {
      return null;
    }
    return this.roundTo2(hours * rate);
  });

  constructor() {
    addIcons({
      'add-circle-outline': addCircleOutline,
      'calendar-outline': calendarOutline
    });

    this.form.addValidators(this.validateDateRange.bind(this));
    this.form.updateValueAndValidity({ emitEvent: false });
    void this.initializePage();
  }

  protected async saveSession(): Promise<void> {
    this.errorMessage.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errorMessage.set('Revisa los campos antes de guardar la sesion.');
      return;
    }

    const formValue = this.form.getRawValue();
    const hourlyRate = this.parseHourlyRate(formValue.hourlyRate);
    if (hourlyRate === null) {
      this.errorMessage.set('La tarifa por hora debe ser un numero valido.');
      return;
    }

    const startIso = this.dateTimeLocalToIso(formValue.start);
    const endIso = this.dateTimeLocalToIso(formValue.end);
    if (!startIso || !endIso) {
      this.errorMessage.set('Ingresa fechas y horas validas para registrar la sesion.');
      return;
    }

    this.saving.set(true);

    try {
      const created = await this.sessionsStore.add(startIso, endIso, hourlyRate);
      this.lastSessionHours.set(created.durationHours);
      this.lastSessionIncome.set(created.totalIncome);
      this.toastMessage.set('Sesion guardada correctamente.');
      this.toastOpen.set(true);
    } catch (error) {
      const fallbackMessage = error instanceof Error ? error.message : 'No se pudo guardar la sesion.';
      this.errorMessage.set(fallbackMessage);
    } finally {
      this.saving.set(false);
    }
  }

  protected startNewSession(): void {
    const defaultRate = this.preferences.defaultHourlyRate();
    this.form.reset(
      {
        start: this.toDateTimeLocalInput(new Date()),
        end: this.toDateTimeLocalInput(this.addHours(new Date(), 2)),
        hourlyRate: defaultRate.toFixed(2)
      },
      { emitEvent: true }
    );
    this.form.markAsPristine();
    this.form.markAsUntouched();
    this.errorMessage.set(null);
  }

  protected isControlInvalid(control: 'start' | 'end' | 'hourlyRate'): boolean {
    const controlRef = this.form.controls[control];
    return controlRef.invalid && (controlRef.touched || controlRef.dirty);
  }

  protected formatHours(value: number | null): string {
    return value === null ? '--' : `${value.toFixed(2)} h`;
  }

  protected formatCurrency(value: number | null): string {
    if (value === null) {
      return '$0.00';
    }
    return `$${value.toFixed(2)}`;
  }

  private async initializePage(): Promise<void> {
    await Promise.all([this.sessionsStore.ensureLoaded(), this.preferences.ensureLoaded()]);
    const defaultRate = this.preferences.defaultHourlyRate();

    this.form.patchValue(
      {
        start: this.toDateTimeLocalInput(new Date()),
        end: this.toDateTimeLocalInput(this.addHours(new Date(), 2)),
        hourlyRate: defaultRate.toFixed(2)
      },
      { emitEvent: true }
    );
  }

  private validateDateRange(control: AbstractControl): ValidationErrors | null {
    const { start, end } = (control as SessionFormGroup).getRawValue();
    if (!start || !end) {
      return null;
    }

    const startTime = new Date(start).getTime();
    const endTime = new Date(end).getTime();
    if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) {
      return { invalidDate: true };
    }

    if (endTime < startTime) {
      return { range: true };
    }

    return null;
  }

  private parseHourlyRate(value: string): number | null {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return null;
    }
    return this.roundTo2(parsed);
  }

  private roundTo2(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private dateTimeLocalToIso(value: string): string | null {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) {
      return null;
    }
    return date.toISOString();
  }

  private toDateTimeLocalInput(value: Date): string {
    const adjusted = new Date(value.getTime() - value.getTimezoneOffset() * 60000);
    return adjusted.toISOString().slice(0, 16);
  }

  private addHours(value: Date, hours: number): Date {
    return new Date(value.getTime() + hours * 60 * 60 * 1000);
  }
}
