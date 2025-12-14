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
    if (!stored) {
      return [];
    }
    return Array.isArray(stored) ? stored : [];
  }

  async saveAll(sessions: WorkSession[]): Promise<void> {
    await this.initPromise;
    await this.storage.set(WORK_SESSIONS_STORAGE_KEY, sessions);
  }

  async clear(): Promise<void> {
    await this.initPromise;
    await this.storage.remove(WORK_SESSIONS_STORAGE_KEY);
  }
}
