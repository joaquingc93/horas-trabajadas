export interface WorkSession {
  id: string;
  startIso: string;
  endIso: string;
  durationHours: number;
  createdAtIso: string;
}

export const WORK_SESSIONS_STORAGE_KEY = 'work-sessions';
