import { inject, Injectable } from '@angular/core';
import { Storage } from '@ionic/storage-angular';

import { WORK_SESSIONS_STORAGE_KEY, WorkSession } from '../models/work-session';

@Injectable({ providedIn: 'root' })
export class SessionStorageService {
  private readonly storage = inject(Storage);
  private readonly initPromise = this.storage.create();

  async readAll(): Promise<WorkSession[]> {
    await this.initPromise;
    const stored = await this.storage.get(WORK_SESSIONS_STORAGE_KEY);
    if (!stored || !Array.isArray(stored)) {
      return [];
    }
    return stored
      .map((session) => this.normalizeSession(session))
      .filter((session): session is WorkSession => session !== null);
  }

  async saveAll(sessions: WorkSession[]): Promise<void> {
    await this.initPromise;
    await this.storage.set(WORK_SESSIONS_STORAGE_KEY, sessions);
  }

  async clear(): Promise<void> {
    await this.initPromise;
    await this.storage.remove(WORK_SESSIONS_STORAGE_KEY);
  }

  private normalizeSession(value: unknown): WorkSession | null {
    if (!this.isRecord(value)) {
      return null;
    }

    const id = this.getString(value, 'id');
    const startIso = this.getString(value, 'startIso');
    const endIso = this.getString(value, 'endIso');
    const createdAtIso = this.getString(value, 'createdAtIso');
    const durationHours = this.getNumber(value, 'durationHours');

    if (!id || !startIso || !endIso || !createdAtIso || durationHours === null) {
      return null;
    }

    const hourlyRateRaw = this.getNumber(value, 'hourlyRate');
    const hourlyRate = hourlyRateRaw !== null ? this.normalizeAmount(hourlyRateRaw) : 0;
    const totalIncomeRaw = this.getNumber(value, 'totalIncome');
    const totalIncome =
      totalIncomeRaw !== null
        ? this.normalizeAmount(totalIncomeRaw)
        : this.normalizeAmount(durationHours * hourlyRate);

    return {
      id,
      startIso,
      endIso,
      durationHours: this.normalizeAmount(durationHours),
      hourlyRate,
      totalIncome,
      createdAtIso
    };
  }

  private getString(source: Record<string, unknown>, key: string): string | null {
    const value = source[key];
    return typeof value === 'string' && value.length > 0 ? value : null;
  }

  private getNumber(source: Record<string, unknown>, key: string): number | null {
    const value = source[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    return null;
  }

  private normalizeAmount(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }
}
