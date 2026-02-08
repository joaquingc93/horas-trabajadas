export interface AppPreferences {
  userName: string;
  defaultHourlyRate: number;
  darkMode: boolean;
}

export const APP_PREFERENCES_STORAGE_KEY = 'app-preferences';

export const DEFAULT_APP_PREFERENCES: AppPreferences = {
  userName: '',
  defaultHourlyRate: 20,
  darkMode: false
};
