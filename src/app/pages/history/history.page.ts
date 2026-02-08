import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
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

import { WorkSession } from '../../models/work-session';
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
  private readonly sessionsStore = inject(SessionsStoreService);

  protected readonly filterFrom = signal('');
  protected readonly filterTo = signal('');
  protected readonly deletingId = signal<string | null>(null);
  protected readonly actionMessage = signal<string | null>(null);
  protected readonly exportingPdf = signal(false);
  protected readonly exportingExcel = signal(false);
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
  protected readonly filteredSessions = computed(() =>
    this.filterSessionsByRange(this.sessions(), this.filterFrom(), this.filterTo())
  );
  protected readonly hasSessions = computed(() => this.filteredSessions().length > 0);
  protected readonly totalHours = computed(() =>
    this.round2(this.filteredSessions().reduce((sum, session) => sum + session.durationHours, 0))
  );
  protected readonly totalIncome = computed(() =>
    this.round2(this.filteredSessions().reduce((sum, session) => sum + session.totalIncome, 0))
  );

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

    void this.sessionsStore.ensureLoaded();
  }

  protected onFilterDateChange(type: 'from' | 'to', value: string | number | null | undefined): void {
    const normalized = typeof value === 'string' ? value : '';
    if (type === 'from') {
      this.filterFrom.set(normalized);
      return;
    }
    this.filterTo.set(normalized);
  }

  protected onFilterInput(type: 'from' | 'to', event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }
    this.onFilterDateChange(type, target.value);
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

  protected async deleteSession(id: string): Promise<void> {
    this.deletingId.set(id);
    this.actionMessage.set(null);
    try {
      await this.sessionsStore.remove(id);
      this.actionMessage.set('Sesion eliminada.');
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
      this.actionMessage.set('No se pudo guardar. Revisa los datos de la sesion.');
      return;
    }

    this.savingEdit.set(true);
    this.actionMessage.set(null);

    try {
      await this.sessionsStore.update(id, startIso, endIso, hourlyRate);
      this.actionMessage.set('Sesion actualizada correctamente.');
      this.closeEditModal();
    } catch (error) {
      const fallback = error instanceof Error ? error.message : 'No se pudo actualizar la sesion.';
      this.actionMessage.set(fallback);
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
    this.actionMessage.set(null);

    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
      const fromLabel = this.filterFrom() || 'Inicio';
      const toLabel = this.filterTo() || 'Actual';

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
      this.actionMessage.set('PDF exportado correctamente.');
    } catch (error) {
      console.error('No se pudo exportar el PDF', error);
      this.actionMessage.set('No se pudo exportar el PDF.');
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
    this.actionMessage.set(null);

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
      this.actionMessage.set('Excel exportado correctamente.');
    } catch (error) {
      console.error('No se pudo exportar el Excel', error);
      this.actionMessage.set('No se pudo exportar el Excel.');
    } finally {
      this.exportingExcel.set(false);
    }
  }

  private filterSessionsByRange(sessions: WorkSession[], fromValue: string, toValue: string): WorkSession[] {
    const fromTime = this.startOfDay(fromValue);
    const toTime = this.endOfDay(toValue);

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

  private startOfDay(value: string): number | null {
    if (!value) {
      return null;
    }

    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) {
      return null;
    }

    date.setHours(0, 0, 0, 0);
    return date.getTime();
  }

  private endOfDay(value: string): number | null {
    if (!value) {
      return null;
    }

    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) {
      return null;
    }

    date.setHours(23, 59, 59, 999);
    return date.getTime();
  }

  private buildExportFilename(extension: 'pdf' | 'xlsx'): string {
    const today = new Date().toISOString().slice(0, 10);
    return `reporte-jornadas-${today}.${extension}`;
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

  private capitalize(value: string): string {
    if (!value.length) {
      return value;
    }
    return value.charAt(0).toUpperCase() + value.slice(1);
  }
}
