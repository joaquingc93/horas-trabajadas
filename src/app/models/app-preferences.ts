import { DEFAULT_WORK_CENTER, DEFAULT_WORK_CENTER_ID, WorkCenter } from './work-center';

export interface AppPreferences {
  userName: string;
  defaultHourlyRate: number;
  darkMode: boolean;
  workCenters: WorkCenter[];
  activeWorkCenterId: string;
}

export const APP_PREFERENCES_STORAGE_KEY = 'app-preferences';

export const DEFAULT_APP_PREFERENCES: AppPreferences = {
  userName: '',
  defaultHourlyRate: 20,
  darkMode: false,
  workCenters: [DEFAULT_WORK_CENTER],
  activeWorkCenterId: DEFAULT_WORK_CENTER_ID
};
