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

  async add(startIso: string, endIso: string): Promise<WorkSession> {
    await this.ensureLoaded();
    const startTime = new Date(startIso).getTime();
    const endTime = new Date(endIso).getTime();
    if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime < startTime) {
      throw new Error('La hora de término debe ser posterior o igual a la hora de inicio.');
    }
    const durationHours = this.calculateDuration(startIso, endIso);
    const newSession: WorkSession = {
      id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}`,
      startIso,
      endIso,
      durationHours,
      createdAtIso: new Date().toISOString()
    };
    const updated = [newSession, ...this.sessionsSignal()];
    this.sessionsSignal.set(updated);
    await this.storage.saveAll(updated);
    return newSession;
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

  private calculateDuration(startIso: string, endIso: string): number {
    const startTime = new Date(startIso).getTime();
    const endTime = new Date(endIso).getTime();
    const diffMs = endTime - startTime;
    const hours = diffMs / (1000 * 60 * 60);
    const rounded = Math.round(hours * 100) / 100;
    return Number.isFinite(rounded) ? rounded : 0;
  }
}
