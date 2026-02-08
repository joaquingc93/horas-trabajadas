import { DOCUMENT } from '@angular/common';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Storage } from '@ionic/storage-angular';

import {
  APP_PREFERENCES_STORAGE_KEY,
  AppPreferences,
  DEFAULT_APP_PREFERENCES
} from '../models/app-preferences';

type PreferencesInput = Partial<AppPreferences>;

@Injectable({ providedIn: 'root' })
export class PreferencesService {
  private readonly documentRef = inject(DOCUMENT);
  private readonly storage = inject(Storage);
  private readonly initPromise = this.storage.create();
  private readonly preferencesSignal = signal<AppPreferences>(DEFAULT_APP_PREFERENCES);
  private readonly readySignal = signal(false);

  readonly preferences = computed(() => this.preferencesSignal());
  readonly userName = computed(() => this.preferencesSignal().userName);
  readonly defaultHourlyRate = computed(() => this.preferencesSignal().defaultHourlyRate);
  readonly darkMode = computed(() => this.preferencesSignal().darkMode);

  async ensureLoaded(): Promise<void> {
    if (this.readySignal()) {
      return;
    }

    await this.initPromise;

    try {
      const stored = await this.storage.get(APP_PREFERENCES_STORAGE_KEY);
      const normalized = this.normalizePreferences(stored);
      this.preferencesSignal.set(normalized);
      this.applyTheme(normalized.darkMode);
    } catch (error) {
      console.error('No se pudieron cargar las preferencias', error);
      this.preferencesSignal.set(DEFAULT_APP_PREFERENCES);
      this.applyTheme(DEFAULT_APP_PREFERENCES.darkMode);
    } finally {
      this.readySignal.set(true);
    }
  }

  async update(partial: PreferencesInput): Promise<AppPreferences> {
    await this.ensureLoaded();

    const current = this.preferencesSignal();
    const next: AppPreferences = {
      ...current,
      ...partial,
      userName: partial.userName ?? current.userName,
      defaultHourlyRate:
        partial.defaultHourlyRate !== undefined
          ? this.sanitizeHourlyRate(partial.defaultHourlyRate)
          : current.defaultHourlyRate,
      darkMode: partial.darkMode ?? current.darkMode
    };

    this.preferencesSignal.set(next);
    this.applyTheme(next.darkMode);
    await this.storage.set(APP_PREFERENCES_STORAGE_KEY, next);
    return next;
  }

  async setDarkMode(value: boolean): Promise<void> {
    await this.update({ darkMode: value });
  }

  private applyTheme(isDark: boolean): void {
    const html = this.documentRef.documentElement;
    const body = this.documentRef.body;

    html.classList.toggle('theme-dark', isDark);
    body.classList.toggle('theme-dark', isDark);
  }

  private normalizePreferences(value: unknown): AppPreferences {
    if (!this.isRecord(value)) {
      return DEFAULT_APP_PREFERENCES;
    }

    const userName = typeof value['userName'] === 'string' ? value['userName'].trim() : '';
    const defaultHourlyRate = this.sanitizeHourlyRate(value['defaultHourlyRate']);
    const darkMode = Boolean(value['darkMode']);

    return {
      userName,
      defaultHourlyRate,
      darkMode
    };
  }

  private sanitizeHourlyRate(value: unknown): number {
    const amount = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(amount) || amount < 0) {
      return DEFAULT_APP_PREFERENCES.defaultHourlyRate;
    }
    return Math.round(amount * 100) / 100;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }
}
