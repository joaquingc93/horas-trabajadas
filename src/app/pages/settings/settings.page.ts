import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar
} from '@ionic/angular/standalone';

import { PreferencesService } from '../../services/preferences.service';

@Component({
  selector: 'app-settings-page',
  imports: [
    CommonModule,
    IonContent,
    IonHeader,
    IonTitle,
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
    void this.initialize();
  }

  protected onUserNameInput(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }
    this.userNameInput.set(target.value);
  }

  protected onDefaultRateInput(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }
    this.defaultRateInput.set(target.value);
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

  protected async onDarkModeChange(event: Event): Promise<void> {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }
    await this.preferences.setDarkMode(target.checked);
    this.message.set(target.checked ? 'Modo oscuro activado.' : 'Modo oscuro desactivado.');
  }

  private async initialize(): Promise<void> {
    await this.preferences.ensureLoaded();
    this.userNameInput.set(this.preferences.userName());
    this.defaultRateInput.set(this.preferences.defaultHourlyRate().toFixed(2));
  }
}
