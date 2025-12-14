import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators
} from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonNote,
  IonInput,
  IonIcon,
  IonText,
  IonTitle,
  IonToast,
  IonToolbar
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { calendarOutline, timeOutline } from 'ionicons/icons';

import { WorkSession } from '../../models/work-session';
import { SessionsStoreService } from '../../services/sessions-store.service';

type SessionFormGroup = FormGroup<{
  start: FormControl<string>;
  end: FormControl<string>;
}>;

@Component({
  selector: 'app-entry-page',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonButton,
    IonContent,
    IonHeader,
    IonItem,
    IonLabel,
    IonInput,
    IonIcon,
    IonNote,
    IonText,
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

  protected readonly saving = signal(false);
  protected readonly lastSaved = signal<WorkSession | null>(null);
  protected readonly toastOpen = signal(false);
  protected readonly toastMessage = signal('');
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly form: SessionFormGroup = this.fb.group({
    start: this.fb.control('', { validators: [Validators.required] }),
    end: this.fb.control('', { validators: [Validators.required] })
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
    const diffHours = (endTime - startTime) / (1000 * 60 * 60);
    const rounded = Math.round(diffHours * 100) / 100;
    return Number.isFinite(rounded) ? rounded : null;
  });

  constructor() {
    addIcons({ 'calendar-outline': calendarOutline, 'time-outline': timeOutline });
    void this.sessionsStore.ensureLoaded();
    this.form.addValidators(this.validateDateRange.bind(this));
    this.form.updateValueAndValidity({ emitEvent: false });
  }

  protected async saveSession(): Promise<void> {
    this.errorMessage.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errorMessage.set('Revisa las fechas: el fin debe ser mayor o igual al inicio.');
      return;
    }

    const { start, end } = this.form.getRawValue();
    if (!start || !end) {
      this.errorMessage.set('Debes completar ambos campos de fecha y hora.');
      return;
    }

    this.saving.set(true);
    try {
      const created = await this.sessionsStore.add(start, end);
      this.lastSaved.set(created);
      this.toastMessage.set('Sesion guardada y horas calculadas.');
      this.toastOpen.set(true);
    } catch (error) {
      const fallbackMessage = error instanceof Error ? error.message : 'No se pudo guardar la sesion.';
      this.errorMessage.set(fallbackMessage);
    } finally {
      this.saving.set(false);
    }
  }

  protected isControlInvalid(control: 'start' | 'end'): boolean {
    const controlRef = this.form.controls[control];
    return controlRef.invalid && (controlRef.touched || controlRef.dirty);
  }

  protected formattedHours(value: number | null): string {
    if (value === null) {
      return '--';
    }
    return value.toFixed(2);
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
}
