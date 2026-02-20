export interface WorkCenter {
  id: string;
  name: string;
  createdAtIso: string;
}

export const DEFAULT_WORK_CENTER_ID = 'centro-principal';

export const DEFAULT_WORK_CENTER: WorkCenter = {
  id: DEFAULT_WORK_CENTER_ID,
  name: 'Centro principal',
  createdAtIso: '2026-01-01T00:00:00.000Z'
};
