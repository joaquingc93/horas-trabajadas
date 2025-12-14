import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonAlert,
  IonBadge,
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonList,
  IonNote,
  IonRefresher,
  IonRefresherContent,
  IonTitle,
  IonToolbar
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  downloadOutline,
  refreshOutline,
  timeOutline,
  trashOutline,
  warningOutline
} from 'ionicons/icons';
import { RefresherCustomEvent } from '@ionic/angular';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { IonInput } from '@ionic/angular/standalone';

import { SessionsStoreService } from '../../services/sessions-store.service';
import { WorkSession } from '../../models/work-session';

@Component({
  selector: 'app-history-page',
  imports: [
    CommonModule,
    IonAlert,
    IonBadge,
    IonButton,
    IonContent,
    IonHeader,
    IonIcon,
    IonItem,
    IonList,
    IonInput,
    IonNote,
    IonRefresher,
    IonRefresherContent,
    IonTitle,
    IonToolbar
  ],
  templateUrl: './history.page.html',
  styleUrl: './history.page.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HistoryPage {
  private readonly sessionsStore = inject(SessionsStoreService);

  protected readonly deletingId = signal<string | null>(null);
  protected readonly confirmClearOpen = signal(false);
  protected readonly exporting = signal(false);
  protected readonly exportFrom = signal('');
  protected readonly exportTo = signal('');
  protected readonly exportMessage = signal<string | null>(null);
  protected readonly alertButtons = [
    { text: 'Cancelar', role: 'cancel' as const },
    { text: 'Borrar todo', role: 'confirm' as const, handler: () => this.clearAll() }
  ];

  protected readonly sessions = computed(() => this.sessionsStore.sessions());
  protected readonly hasSessions = computed(() => this.sessionsStore.hasSessions());
  protected readonly totalHours = computed(() =>
    this.sessions().reduce((sum, session) => sum + session.durationHours, 0)
  );

  private readonly dateFormatter = new Intl.DateTimeFormat('es', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });

  constructor() {
    addIcons({
      'trash-outline': trashOutline,
      'refresh-outline': refreshOutline,
      'warning-outline': warningOutline,
      'time-outline': timeOutline,
      'download-outline': downloadOutline
    });
    void this.sessionsStore.ensureLoaded();
  }

  protected formatDateTime(value: string): string {
    return this.dateFormatter.format(new Date(value));
  }

  protected async deleteSession(id: string): Promise<void> {
    this.deletingId.set(id);
    try {
      await this.sessionsStore.remove(id);
    } finally {
      this.deletingId.set(null);
    }
  }

  protected async clearAll(): Promise<void> {
    this.confirmClearOpen.set(false);
    await this.sessionsStore.clear();
  }

  protected async reload(): Promise<void> {
    await this.sessionsStore.ensureLoaded();
  }

  protected async exportSummary(): Promise<void> {
    const sessions = this.sessions();
    if (!sessions.length || this.exporting()) {
      return;
    }

    this.exporting.set(true);
    this.exportMessage.set(null);
    try {
      const filtered = this.filterSessionsByRange(sessions);
      if (!filtered.length) {
        this.exportMessage.set('No hay registros en el rango seleccionado.');
        return;
      }

      const summaryText = this.buildSummaryText(filtered);
      const filename = `horas-trabajadas-${new Date().toISOString().slice(0, 10)}.txt`;
      const platform = Capacitor.getPlatform();

      if (platform !== 'web') {
        const path = `exports/${filename}`;
        const { uri } = await Filesystem.writeFile({
          path,
          data: summaryText,
          directory: Directory.Cache,
          encoding: Encoding.UTF8,
          recursive: true
        });

        const canShare = await Share.canShare();
        if (canShare.value) {
          await Share.share({
            title: 'Resumen de horas',
            text: 'Archivo generado con tus horas trabajadas.',
            files: [uri]
          });
          this.exportMessage.set(`Resumen exportado (${filtered.length} registros).`);
        } else {
          this.exportMessage.set('No se pudo compartir el archivo en este dispositivo.');
        }
        return;
      }

      this.downloadInBrowser(summaryText, filename);
      this.exportMessage.set(`Resumen descargado (${filtered.length} registros).`);
    } catch (error) {
      console.error('No se pudo exportar el resumen', error);
      this.exportMessage.set('No se pudo exportar el resumen en este dispositivo.');
    } finally {
      this.exporting.set(false);
    }
  }

  protected trackById(_: number, session: WorkSession): string {
    return session.id;
  }

  protected async refreshSessions(event: RefresherCustomEvent): Promise<void> {
    await this.sessionsStore.ensureLoaded();
    event.detail.complete();
  }

  protected onExportDateChange(type: 'from' | 'to', value: string | null): void {
    const normalized = value ?? '';
    if (type === 'from') {
      this.exportFrom.set(normalized);
    } else {
      this.exportTo.set(normalized);
    }
  }

  private filterSessionsByRange(sessions: WorkSession[]): WorkSession[] {
    const fromValue = this.exportFrom();
    const toValue = this.exportTo();

    const fromTime = this.startOfDay(fromValue);
    const toTime = this.endOfDay(toValue);

    return sessions.filter((session) => {
      const start = new Date(session.startIso).getTime();
      const end = new Date(session.endIso).getTime();
      if (Number.isNaN(start) || Number.isNaN(end)) {
        return false;
      }
      const afterFrom = fromTime === null || start >= fromTime;
      const beforeTo = toTime === null || end <= toTime;
      return afterFrom && beforeTo;
    });
  }

  private startOfDay(value: string | null): number | null {
    if (!value) {
      return null;
    }
    const ms = new Date(value).getTime();
    if (!Number.isFinite(ms)) {
      return null;
    }
    const date = new Date(ms);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
  }

  private endOfDay(value: string | null): number | null {
    if (!value) {
      return null;
    }
    const ms = new Date(value).getTime();
    if (!Number.isFinite(ms)) {
      return null;
    }
    const date = new Date(ms);
    date.setHours(23, 59, 59, 999);
    return date.getTime();
  }

  private buildSummaryText(sessions: WorkSession[]): string {
    const totalHours = sessions.reduce((sum, session) => sum + session.durationHours, 0).toFixed(2);
    const lines = [
      'Resumen de horas trabajadas',
      `Generado: ${new Date().toLocaleString()}`,
      `Total registros: ${sessions.length}`,
      `Total horas: ${totalHours} h`,
      '',
      'Detalle:',
      ...sessions.map((s, idx) => {
        const start = this.formatDateTime(s.startIso);
        const end = this.formatDateTime(s.endIso);
        return `${idx + 1}. Inicio: ${start} | Fin: ${end} | Horas: ${s.durationHours.toFixed(2)}`;
      })
    ];
    return lines.join('\n');
  }

  private downloadInBrowser(text: string, filename: string): void {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
}
