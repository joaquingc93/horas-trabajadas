import { DOCUMENT } from '@angular/common';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Storage } from '@ionic/storage-angular';

import {
  APP_PREFERENCES_STORAGE_KEY,
  AppPreferences,
  DEFAULT_APP_PREFERENCES
} from '../models/app-preferences';
import { DEFAULT_WORK_CENTER, WorkCenter } from '../models/work-center';

type PreferencesInput = Partial<Pick<AppPreferences, 'userName' | 'defaultHourlyRate' | 'darkMode'>>;

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
  readonly workCenters = computed(() => this.preferencesSignal().workCenters);
  readonly activeWorkCenterId = computed(() => this.preferencesSignal().activeWorkCenterId);
  readonly activeWorkCenter = computed(() => {
    const current = this.preferencesSignal();
    return (
      current.workCenters.find((center) => center.id === current.activeWorkCenterId) ??
      current.workCenters[0] ??
      null
    );
  });

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
      darkMode: partial.darkMode ?? current.darkMode,
      workCenters: current.workCenters,
      activeWorkCenterId: current.activeWorkCenterId
    };

    this.preferencesSignal.set(next);
    this.applyTheme(next.darkMode);
    await this.storage.set(APP_PREFERENCES_STORAGE_KEY, next);
    return next;
  }

  async addWorkCenter(name: string): Promise<WorkCenter> {
    await this.ensureLoaded();

    const normalizedName = name.trim().replace(/\s+/g, ' ');
    if (!normalizedName) {
      throw new Error('El nombre del centro es obligatorio.');
    }

    if (normalizedName.length > 60) {
      throw new Error('El nombre del centro no puede superar los 60 caracteres.');
    }

    const current = this.preferencesSignal();
    const duplicated = current.workCenters.some(
      (center) => center.name.toLocaleLowerCase('es-ES') === normalizedName.toLocaleLowerCase('es-ES')
    );
    if (duplicated) {
      throw new Error('Ese centro ya existe.');
    }

    const newCenter: WorkCenter = {
      id: this.buildWorkCenterId(normalizedName),
      name: normalizedName,
      createdAtIso: new Date().toISOString()
    };

    const next: AppPreferences = {
      ...current,
      workCenters: [newCenter, ...current.workCenters],
      activeWorkCenterId: current.activeWorkCenterId || newCenter.id
    };

    this.preferencesSignal.set(next);
    await this.storage.set(APP_PREFERENCES_STORAGE_KEY, next);
    return newCenter;
  }

  async setActiveWorkCenter(id: string): Promise<void> {
    await this.ensureLoaded();

    const current = this.preferencesSignal();
    const exists = current.workCenters.some((center) => center.id === id);
    if (!exists) {
      throw new Error('No se encontró el centro de trabajo seleccionado.');
    }

    const next: AppPreferences = {
      ...current,
      activeWorkCenterId: id
    };

    this.preferencesSignal.set(next);
    await this.storage.set(APP_PREFERENCES_STORAGE_KEY, next);
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
    const workCenters = this.sanitizeWorkCenters(value['workCenters']);
    const storedActiveCenterId = typeof value['activeWorkCenterId'] === 'string' ? value['activeWorkCenterId'] : '';
    const activeWorkCenterId = this.resolveActiveWorkCenterId(storedActiveCenterId, workCenters);

    return {
      userName,
      defaultHourlyRate,
      darkMode,
      workCenters,
      activeWorkCenterId
    };
  }

  private sanitizeWorkCenters(value: unknown): WorkCenter[] {
    if (!Array.isArray(value)) {
      return [DEFAULT_WORK_CENTER];
    }

    const byId = new Map<string, WorkCenter>();

    for (const rawCenter of value) {
      const center = this.normalizeWorkCenter(rawCenter);
      if (!center || byId.has(center.id)) {
        continue;
      }

      byId.set(center.id, center);
    }

    return byId.size > 0 ? Array.from(byId.values()) : [DEFAULT_WORK_CENTER];
  }

  private normalizeWorkCenter(value: unknown): WorkCenter | null {
    if (!this.isRecord(value)) {
      return null;
    }

    const id = typeof value['id'] === 'string' ? value['id'].trim() : '';
    const name = typeof value['name'] === 'string' ? value['name'].trim() : '';
    const createdAtIso =
      typeof value['createdAtIso'] === 'string' && Number.isFinite(new Date(value['createdAtIso']).getTime())
        ? value['createdAtIso']
        : new Date().toISOString();

    if (!id || !name) {
      return null;
    }

    return {
      id,
      name,
      createdAtIso
    };
  }

  private resolveActiveWorkCenterId(activeId: string, workCenters: WorkCenter[]): string {
    const exists = workCenters.some((center) => center.id === activeId);
    if (exists) {
      return activeId;
    }

    return workCenters[0]?.id ?? DEFAULT_WORK_CENTER.id;
  }

  private buildWorkCenterId(name: string): string {
    const slug = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const suffix =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID().slice(0, 8)
        : `${Date.now()}`;

    return `${slug || 'centro'}-${suffix}`;
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
