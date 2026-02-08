import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import {
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonNote,
  IonTitle,
  IonToggle,
  IonToolbar
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { moonOutline, personOutline, sunnyOutline } from 'ionicons/icons';

import { PreferencesService } from '../../services/preferences.service';

@Component({
  selector: 'app-settings-page',
  imports: [
    CommonModule,
    IonContent,
    IonHeader,
    IonIcon,
    IonInput,
    IonItem,
    IonLabel,
    IonNote,
    IonTitle,
    IonToggle,
    IonToolbar
  ],
  templateUrl: './settings.page.html',
  styleUrl: './settings.page.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SettingsPage {
  private readonly preferences = inject(PreferencesService);

  protected readonly userNameInput = signal('');
  protected readonly defaultRateInput = signal('20.00');
  protected readonly message = signal<string | null>(null);
  protected readonly darkMode = computed(() => this.preferences.darkMode());

  constructor() {
    addIcons({
      'person-outline': personOutline,
      'moon-outline': moonOutline,
      'sunny-outline': sunnyOutline
    });

    void this.initialize();
  }

  protected onUserNameInput(value: string | number | null | undefined): void {
    this.userNameInput.set(typeof value === 'string' ? value : '');
  }

  protected onDefaultRateInput(value: string | number | null | undefined): void {
    if (typeof value === 'number') {
      this.defaultRateInput.set(value.toFixed(2));
      return;
    }

    this.defaultRateInput.set(typeof value === 'string' ? value : '');
  }

  protected async savePreferences(): Promise<void> {
    const parsedRate = Number(this.defaultRateInput());
    if (!Number.isFinite(parsedRate) || parsedRate < 0) {
      this.message.set('La tarifa por hora debe ser un numero valido.');
      return;
    }

    await this.preferences.update({
      userName: this.userNameInput().trim(),
      defaultHourlyRate: Math.round(parsedRate * 100) / 100
    });

    this.defaultRateInput.set((Math.round(parsedRate * 100) / 100).toFixed(2));
    this.message.set('Preferencias actualizadas.');
  }

  protected async onDarkModeChange(checked: boolean): Promise<void> {
    await this.preferences.setDarkMode(checked);
    this.message.set(checked ? 'Modo oscuro activado.' : 'Modo oscuro desactivado.');
  }

  private async initialize(): Promise<void> {
    await this.preferences.ensureLoaded();
    this.userNameInput.set(this.preferences.userName());
    this.defaultRateInput.set(this.preferences.defaultHourlyRate().toFixed(2));
  }
}
