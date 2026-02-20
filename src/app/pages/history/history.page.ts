import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import {
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';

import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import {
  IonContent,
  IonDatetime,
  IonHeader,
  IonIcon,
  IonModal,
  IonTitle,
  IonToolbar
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  calendarOutline,
  cashOutline,
  createOutline,
  documentTextOutline,
  listOutline,
  timeOutline,
  trashOutline
} from 'ionicons/icons';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

import { normalizeFilterDateTimeValue, parseFilterDateTime } from './history-filter-datetime.util';
import { WorkSession } from '../../models/work-session';
import { PreferencesService } from '../../services/preferences.service';
import { SessionsStoreService } from '../../services/sessions-store.service';

type EditFormGroup = FormGroup<{
  start: FormControl<string>;
  end: FormControl<string>;
  hourlyRate: FormControl<string>;
}>;

@Component({
  selector: 'app-history-page',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonContent,
    IonDatetime,
    IonHeader,
    IonIcon,
    IonModal,
    IonTitle,
    IonToolbar
  ],
  templateUrl: './history.page.html',
  styleUrl: './history.page.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HistoryPage {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly preferences = inject(PreferencesService);
  private readonly sessionsStore = inject(SessionsStoreService);
  private actionMessageTimeoutId: ReturnType<typeof setTimeout> | null = null;

  protected readonly filterFrom = signal('');
  protected readonly filterTo = signal('');
  protected readonly filterFromModalOpen = signal(false);
  protected readonly filterToModalOpen = signal(false);
  protected readonly filterFromDraft = signal<string | null>(null);
  protected readonly filterToDraft = signal<string | null>(null);
  protected readonly deletingId = signal<string | null>(null);
  protected readonly actionMessage = signal<string | null>(null);
  protected readonly exportingPdf = signal(false);
  protected readonly exportingExcel = signal(false);
  protected readonly deleteModalOpen = signal(false);
  protected readonly pendingDeleteSession = signal<WorkSession | null>(null);
  protected readonly deleteAcknowledged = signal(false);
  protected readonly editModalOpen = signal(false);
  protected readonly editingSessionId = signal<string | null>(null);
  protected readonly savingEdit = signal(false);

  protected readonly editForm: EditFormGroup = this.fb.group({
    start: this.fb.control('', Validators.required),
    end: this.fb.control('', Validators.required),
    hourlyRate: this.fb.control('0.00', {
      validators: [Validators.required, Validators.pattern(/^\d+(\.\d{1,2})?$/)]
    })
  });

  protected readonly sessions = computed(() => this.sessionsStore.sessions());
  protected readonly activeWorkCenterId = computed(() => this.preferences.activeWorkCenterId());
  protected readonly activeWorkCenterName = computed(
    () => this.preferences.activeWorkCenter()?.name ?? 'Sin centro activo'
  );
  protected readonly sessionsByActiveCenter = computed(() =>
    this.sessions().filter((session) => session.workCenterId === this.activeWorkCenterId())
  );
  protected readonly filteredSessions = computed(() =>
    this.filterSessionsByRange(this.sessionsByActiveCenter(), this.filterFrom(), this.filterTo())
  );
  protected readonly hasSessions = computed(() => this.filteredSessions().length > 0);
  protected readonly totalHours = computed(() =>
    this.round2(this.filteredSessions().reduce((sum, session) => sum + session.durationHours, 0))
  );
  protected readonly totalIncome = computed(() =>
    this.round2(this.filteredSessions().reduce((sum, session) => sum + session.totalIncome, 0))
  );
  protected readonly deletingPendingSession = computed(() => {
    const pendingSession = this.pendingDeleteSession();
    return pendingSession ? this.deletingId() === pendingSession.id : false;
  });
  protected readonly canConfirmDelete = computed(() => {
    const hasPendingSession = !!this.pendingDeleteSession();
    return hasPendingSession && this.deleteAcknowledged() && !this.deletingPendingSession();
  });

  private readonly dateLabelFormatter = new Intl.DateTimeFormat('es', {
    day: '2-digit',
    month: 'short'
  });
  private readonly weekdayFormatter = new Intl.DateTimeFormat('es', { weekday: 'short' });
  private readonly timeFormatter = new Intl.DateTimeFormat('es', {
    hour: '2-digit',
    minute: '2-digit'
  });

  constructor() {
    addIcons({
      'calendar-outline': calendarOutline,
      'time-outline': timeOutline,
      'cash-outline': cashOutline,
      'document-text-outline': documentTextOutline,
      'list-outline': listOutline,
      'create-outline': createOutline,
      'trash-outline': trashOutline
    });

    void Promise.all([this.sessionsStore.ensureLoaded(), this.preferences.ensureLoaded()]);

    this.destroyRef.onDestroy(() => {
      this.clearActionMessageTimer();
    });
  }

  protected openFilterModal(field: 'from' | 'to'): void {
    const currentValue = normalizeFilterDateTimeValue(field === 'from' ? this.filterFrom() : this.filterTo());

    if (field === 'from') {
      this.filterFromDraft.set(currentValue);
      this.filterFromModalOpen.set(true);
      return;
    }

    this.filterToDraft.set(currentValue);
    this.filterToModalOpen.set(true);
  }

  protected closeFilterModal(field: 'from' | 'to'): void {
    if (field === 'from') {
      this.filterFromModalOpen.set(false);
      return;
    }

    this.filterToModalOpen.set(false);
  }

  protected onFilterDateSelection(
    field: 'from' | 'to',
    value: string | string[] | null | undefined
  ): void {
    const selectedValue = normalizeFilterDateTimeValue(value);

    if (field === 'from') {
      this.filterFromDraft.set(selectedValue);
      return;
    }

    this.filterToDraft.set(selectedValue);
  }

  protected applyFilterDate(field: 'from' | 'to'): void {
    if (field === 'from') {
      this.filterFrom.set(normalizeFilterDateTimeValue(this.filterFromDraft()) ?? '');
      this.closeFilterModal('from');
      return;
    }

    this.filterTo.set(normalizeFilterDateTimeValue(this.filterToDraft()) ?? '');
    this.closeFilterModal('to');
  }

  protected clearFilterDate(field: 'from' | 'to'): void {
    if (field === 'from') {
      this.filterFrom.set('');
      this.filterFromDraft.set(null);
      this.closeFilterModal('from');
      return;
    }

    this.filterTo.set('');
    this.filterToDraft.set(null);
    this.closeFilterModal('to');
  }

  protected filterButtonLabel(field: 'from' | 'to'): string {
    const value = field === 'from' ? this.filterFrom() : this.filterTo();
    const timestamp = this.parseDateTime(value);
    if (timestamp === null) {
      return 'Sin límite';
    }

    const date = new Date(timestamp);

    return new Intl.DateTimeFormat('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h12'
    }).format(date);
  }

  protected formatDateLabel(iso: string): string {
    const date = new Date(iso);
    return this.capitalize(this.dateLabelFormatter.format(date));
  }

  protected formatWeekDay(iso: string): string {
    const date = new Date(iso);
    return this.capitalize(this.weekdayFormatter.format(date).replace('.', ''));
  }

  protected formatTimeRange(session: WorkSession): string {
    return `${this.timeFormatter.format(new Date(session.startIso))} - ${this.timeFormatter.format(new Date(session.endIso))}`;
  }

  protected formatHours(value: number): string {
    return `${value.toFixed(2)} h`;
  }

  protected formatCurrency(value: number): string {
    return `$${value.toFixed(2)}`;
  }

  protected trackById(_: number, session: WorkSession): string {
    return session.id;
  }

  protected openDeleteModal(session: WorkSession): void {
    if (this.deletingId()) {
      return;
    }

    this.pendingDeleteSession.set(session);
    this.deleteAcknowledged.set(false);
    this.deleteModalOpen.set(true);
  }

  protected onDeleteAcknowledgedChange(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    this.deleteAcknowledged.set(target.checked);
  }

  protected closeDeleteModal(): void {
    if (this.deletingId()) {
      return;
    }

    this.resetDeleteDialog();
  }

  protected pendingDeleteLabel(): string {
    const session = this.pendingDeleteSession();
    if (!session) {
      return '';
    }

    return `${this.formatDateLabel(session.startIso)} · ${this.formatTimeRange(session)}`;
  }

  protected async confirmDeleteSession(): Promise<void> {
    const session = this.pendingDeleteSession();
    if (!session) {
      return;
    }

    this.deletingId.set(session.id);
    this.setActionMessage(null);

    try {
      await this.sessionsStore.remove(session.id);
      this.setActionMessage('Sesión eliminada.', 3200);
      this.resetDeleteDialog();
    } catch (error) {
      const fallback = error instanceof Error ? error.message : 'No se pudo eliminar la sesión.';
      this.setActionMessage(fallback);
    } finally {
      this.deletingId.set(null);
    }
  }

  protected openEditModal(session: WorkSession): void {
    this.editingSessionId.set(session.id);
    this.editForm.reset({
      start: this.toDateTimeLocalInput(session.startIso),
      end: this.toDateTimeLocalInput(session.endIso),
      hourlyRate: session.hourlyRate.toFixed(2)
    });
    this.editForm.markAsPristine();
    this.editForm.markAsUntouched();
    this.editModalOpen.set(true);
  }

  protected closeEditModal(): void {
    this.editModalOpen.set(false);
    this.editingSessionId.set(null);
    this.editForm.reset({ start: '', end: '', hourlyRate: '0.00' });
  }

  protected async saveEdition(): Promise<void> {
    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }

    const id = this.editingSessionId();
    if (!id) {
      return;
    }

    const formValue = this.editForm.getRawValue();
    const startIso = this.dateTimeLocalToIso(formValue.start);
    const endIso = this.dateTimeLocalToIso(formValue.end);
    const hourlyRate = Number(formValue.hourlyRate);

    if (!startIso || !endIso || !Number.isFinite(hourlyRate) || hourlyRate < 0) {
      this.setActionMessage('No se pudo guardar. Revisa los datos de la sesión.');
      return;
    }

    const startTime = new Date(startIso).getTime();
    const endTime = new Date(endIso).getTime();
    if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime <= startTime) {
      this.setActionMessage('La fecha y hora de salida debe ser posterior a la de entrada.');
      return;
    }

    this.savingEdit.set(true);
    this.setActionMessage(null);

    try {
      await this.sessionsStore.update(id, startIso, endIso, hourlyRate);
      this.setActionMessage('Sesión actualizada correctamente.', 3200);
      this.closeEditModal();
    } catch (error) {
      const fallback = error instanceof Error ? error.message : 'No se pudo actualizar la sesión.';
      this.setActionMessage(fallback);
    } finally {
      this.savingEdit.set(false);
    }
  }

  protected async exportPdf(): Promise<void> {
    const rows = this.filteredSessions();
    if (!rows.length || this.exportingPdf()) {
      return;
    }

    this.exportingPdf.set(true);
    this.setActionMessage(null);

    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
      const fromLabel = this.filterButtonLabel('from');
      const toLabel = this.filterButtonLabel('to');

      doc.setFillColor(20, 96, 125);
      doc.rect(32, 34, 531, 18, 'F');

      doc.setTextColor(15, 23, 42);
      doc.setFontSize(34);
      doc.setFont('helvetica', 'bold');
      doc.text('Reporte de Jornadas Laborales', 32, 96);

      doc.setFontSize(18);
      doc.setFont('helvetica', 'normal');
      doc.text(`Filtrado: ${fromLabel} - ${toLabel}`, 32, 128);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(28);
      doc.text('Resumen', 32, 188);

      this.drawSummaryCard(doc, 32, 210, 'Total Horas', `${this.totalHours().toFixed(2)} hrs`);
      this.drawSummaryCard(doc, 300, 210, 'Ganancias Totales', this.formatCurrency(this.totalIncome()));

      autoTable(doc, {
        startY: 318,
        head: [['Fecha', 'Inicio', 'Fin', 'Tarifa', 'Horas', 'Total']],
        body: rows.map((session) => [
          this.formatDateForPdf(session.startIso),
          this.formatTimeForPdf(session.startIso),
          this.formatTimeForPdf(session.endIso),
          `$${session.hourlyRate.toFixed(2)}/hr`,
          session.durationHours.toFixed(2),
          this.formatCurrency(session.totalIncome)
        ]),
        theme: 'striped',
        styles: {
          fontSize: 12,
          cellPadding: 8,
          textColor: [15, 23, 42]
        },
        headStyles: {
          fillColor: [20, 96, 125],
          textColor: [255, 255, 255],
          fontStyle: 'bold'
        }
      });

      const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 700;
      doc.setFontSize(12);
      doc.setTextColor(107, 114, 128);
      doc.text('Generado por Mi App de Horas', 200, finalY + 36);
      doc.text(`Fecha de generacion: ${this.formatDateForPdf(new Date().toISOString())}`, 200, finalY + 56);

      const filename = this.buildExportFilename('pdf');
      await this.savePdf(doc, filename);
      this.setActionMessage('PDF exportado correctamente.', 3200);
    } catch (error) {
      console.error('No se pudo exportar el PDF', error);
      this.setActionMessage('No se pudo exportar el PDF.');
    } finally {
      this.exportingPdf.set(false);
    }
  }

  protected async exportExcel(): Promise<void> {
    const rows = this.filteredSessions();
    if (!rows.length || this.exportingExcel()) {
      return;
    }

    this.exportingExcel.set(true);
    this.setActionMessage(null);

    try {
      const workbook = XLSX.utils.book_new();
      const worksheetRows = rows.map((session) => ({
        Fecha: this.formatDateForPdf(session.startIso),
        Inicio: this.formatTimeForPdf(session.startIso),
        Fin: this.formatTimeForPdf(session.endIso),
        Tarifa: session.hourlyRate,
        Horas: session.durationHours,
        Total: session.totalIncome
      }));

      const worksheet = XLSX.utils.json_to_sheet(worksheetRows);
      worksheet['!cols'] = [
        { wch: 14 },
        { wch: 10 },
        { wch: 10 },
        { wch: 10 },
        { wch: 10 },
        { wch: 12 }
      ];

      XLSX.utils.book_append_sheet(workbook, worksheet, 'Historial Filtrado');

      const filename = this.buildExportFilename('xlsx');
      await this.saveExcel(workbook, filename);
      this.setActionMessage('Excel exportado correctamente.', 3200);
    } catch (error) {
      console.error('No se pudo exportar el Excel', error);
      this.setActionMessage('No se pudo exportar el Excel.');
    } finally {
      this.exportingExcel.set(false);
    }
  }

  private filterSessionsByRange(sessions: WorkSession[], fromValue: string, toValue: string): WorkSession[] {
    const fromTime = this.parseDateTime(fromValue);
    const toTime = this.parseDateTime(toValue);

    return sessions.filter((session) => {
      const start = new Date(session.startIso).getTime();
      const end = new Date(session.endIso).getTime();

      if (!Number.isFinite(start) || !Number.isFinite(end)) {
        return false;
      }

      const afterFrom = fromTime === null || start >= fromTime;
      const beforeTo = toTime === null || end <= toTime;
      return afterFrom && beforeTo;
    });
  }

  private parseDateTime(value: string): number | null {
    return parseFilterDateTime(value);
  }

  private buildExportFilename(extension: 'pdf' | 'xlsx'): string {
    const today = new Date().toISOString().slice(0, 10);
    const userNameSegment = this.toFileNameSegment(this.preferences.userName());
    const workCenterSegment = this.toFileNameSegment(this.activeWorkCenterName());
    return `reporte-jornadas-${userNameSegment}-${workCenterSegment}-${today}.${extension}`;
  }

  private toFileNameSegment(value: string): string {
    const normalized = value
      .trim()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return normalized || 'usuario';
  }

  private async savePdf(doc: jsPDF, filename: string): Promise<void> {
    const platform = Capacitor.getPlatform();
    if (platform === 'web') {
      doc.save(filename);
      return;
    }

    const bytes = doc.output('arraybuffer');
    const base64Data = this.arrayBufferToBase64(bytes);
    const { uri } = await Filesystem.writeFile({
      path: `exports/${filename}`,
      data: base64Data,
      directory: Directory.Cache,
      recursive: true
    });

    const canShare = await Share.canShare();
    if (canShare.value) {
      await Share.share({
        title: 'Reporte PDF',
        text: 'Te comparto el reporte de jornadas filtradas.',
        files: [uri]
      });
    }
  }

  private async saveExcel(workbook: XLSX.WorkBook, filename: string): Promise<void> {
    const platform = Capacitor.getPlatform();
    if (platform === 'web') {
      XLSX.writeFile(workbook, filename);
      return;
    }

    const base64Data = XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' });
    const { uri } = await Filesystem.writeFile({
      path: `exports/${filename}`,
      data: base64Data,
      directory: Directory.Cache,
      recursive: true
    });

    const canShare = await Share.canShare();
    if (canShare.value) {
      await Share.share({
        title: 'Reporte Excel',
        text: 'Te comparto el reporte de jornadas filtradas.',
        files: [uri]
      });
    }
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return btoa(binary);
  }

  private drawSummaryCard(doc: jsPDF, x: number, y: number, title: string, value: string): void {
    doc.setFillColor(236, 247, 252);
    doc.setDrawColor(20, 96, 125);
    doc.roundedRect(x, y, 262, 86, 12, 12, 'FD');

    doc.setTextColor(17, 24, 39);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(17);
    doc.text(title, x + 18, y + 34);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(23);
    doc.text(value, x + 18, y + 64);
  }

  private formatDateForPdf(iso: string): string {
    const date = new Date(iso);
    const day = `${date.getDate()}`.padStart(2, '0');
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const year = `${date.getFullYear()}`.slice(-2);
    return `${day}/${month}/${year}`;
  }

  private formatTimeForPdf(iso: string): string {
    const date = new Date(iso);
    const hours = `${date.getHours()}`.padStart(2, '0');
    const minutes = `${date.getMinutes()}`.padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  private toDateTimeLocalInput(iso: string): string {
    const date = new Date(iso);
    const adjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return adjusted.toISOString().slice(0, 16);
  }

  private dateTimeLocalToIso(value: string): string | null {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) {
      return null;
    }
    return date.toISOString();
  }

  private round2(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private setActionMessage(message: string | null, autoClearMs = 0): void {
    this.clearActionMessageTimer();
    this.actionMessage.set(message);

    if (!message || autoClearMs <= 0) {
      return;
    }

    this.actionMessageTimeoutId = setTimeout(() => {
      this.actionMessage.set(null);
      this.actionMessageTimeoutId = null;
    }, autoClearMs);
  }

  private clearActionMessageTimer(): void {
    if (this.actionMessageTimeoutId === null) {
      return;
    }

    clearTimeout(this.actionMessageTimeoutId);
    this.actionMessageTimeoutId = null;
  }

  private resetDeleteDialog(): void {
    this.deleteModalOpen.set(false);
    this.pendingDeleteSession.set(null);
    this.deleteAcknowledged.set(false);
  }

  private capitalize(value: string): string {
    if (!value.length) {
      return value;
    }
    return value.charAt(0).toUpperCase() + value.slice(1);
  }
}
