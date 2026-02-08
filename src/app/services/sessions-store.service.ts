import { computed, inject, Injectable, signal } from '@angular/core';

import { WorkSession } from '../models/work-session';
import { SessionStorageService } from './session-storage.service';

@Injectable({ providedIn: 'root' })
export class SessionsStoreService {
  private readonly storage = inject(SessionStorageService);
  private readonly sessionsSignal = signal<WorkSession[]>([]);
  private readonly loadingSignal = signal<boolean>(false);
  private ready = false;

  readonly sessions = computed(() => this.sessionsSignal());
  readonly hasSessions = computed(() => this.sessionsSignal().length > 0);
  readonly loading = computed(() => this.loadingSignal());

  async ensureLoaded(): Promise<void> {
    if (this.ready) {
      return;
    }
    this.loadingSignal.set(true);
    try {
      const stored = await this.storage.readAll();
      this.sessionsSignal.set(stored);
      this.ready = true;
    } catch (error) {
      console.error('No se pudo cargar el historial', error);
      this.sessionsSignal.set([]);
      this.ready = true;
    } finally {
      this.loadingSignal.set(false);
    }
  }

  async add(startIso: string, endIso: string, hourlyRate: number): Promise<WorkSession> {
    await this.ensureLoaded();
    this.validateDateRange(startIso, endIso);
    const normalizedRate = this.normalizeAmount(hourlyRate);
    if (normalizedRate < 0) {
      throw new Error('La tarifa por hora no puede ser negativa.');
    }

    const durationHours = this.calculateDuration(startIso, endIso);
    const totalIncome = this.calculateTotalIncome(durationHours, normalizedRate);
    const newSession: WorkSession = {
      id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}`,
      startIso,
      endIso,
      durationHours,
      hourlyRate: normalizedRate,
      totalIncome,
      createdAtIso: new Date().toISOString()
    };
    const updated = [newSession, ...this.sessionsSignal()];
    this.sessionsSignal.set(updated);
    await this.storage.saveAll(updated);
    return newSession;
  }

  async update(id: string, startIso: string, endIso: string, hourlyRate: number): Promise<WorkSession> {
    await this.ensureLoaded();
    this.validateDateRange(startIso, endIso);

    const normalizedRate = this.normalizeAmount(hourlyRate);
    if (normalizedRate < 0) {
      throw new Error('La tarifa por hora no puede ser negativa.');
    }

    const durationHours = this.calculateDuration(startIso, endIso);
    const totalIncome = this.calculateTotalIncome(durationHours, normalizedRate);

    const existing = this.sessionsSignal();
    const index = existing.findIndex((session) => session.id === id);
    if (index < 0) {
      throw new Error('No se encontro la sesion a editar.');
    }

    const current = existing[index];
    const nextSession: WorkSession = {
      ...current,
      startIso,
      endIso,
      durationHours,
      hourlyRate: normalizedRate,
      totalIncome
    };

    const updated = [...existing];
    updated[index] = nextSession;
    this.sessionsSignal.set(updated);
    await this.storage.saveAll(updated);

    return nextSession;
  }

  async remove(id: string): Promise<void> {
    await this.ensureLoaded();
    const updated = this.sessionsSignal().filter((session) => session.id !== id);
    this.sessionsSignal.set(updated);
    await this.storage.saveAll(updated);
  }

  async clear(): Promise<void> {
    await this.ensureLoaded();
    this.sessionsSignal.set([]);
    await this.storage.clear();
  }

  private validateDateRange(startIso: string, endIso: string): void {
    const startTime = new Date(startIso).getTime();
    const endTime = new Date(endIso).getTime();
    if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime < startTime) {
      throw new Error('La hora de termino debe ser posterior o igual a la hora de inicio.');
    }
  }

  private calculateDuration(startIso: string, endIso: string): number {
    const startTime = new Date(startIso).getTime();
    const endTime = new Date(endIso).getTime();
    const diffMs = endTime - startTime;
    const hours = diffMs / (1000 * 60 * 60);
    return this.normalizeAmount(hours);
  }

  private calculateTotalIncome(durationHours: number, hourlyRate: number): number {
    return this.normalizeAmount(durationHours * hourlyRate);
  }

  private normalizeAmount(value: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }
    return Math.round(value * 100) / 100;
  }
}
