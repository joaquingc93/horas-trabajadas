import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import {
  IonApp,
  IonIcon,
  IonLabel,
  IonRouterOutlet,
  IonTabBar,
  IonTabButton,
  IonTabs
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  documentTextOutline,
  moonOutline,
  settingsOutline,
  sunnyOutline,
  timeOutline
} from 'ionicons/icons';

import { PreferencesService } from './services/preferences.service';

@Component({
  selector: 'app-root',
  imports: [
    IonApp,
    IonTabs,
    IonRouterOutlet,
    IonTabBar,
    IonTabButton,
    IonIcon,
    IonLabel,
    RouterLink,
    RouterLinkActive
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class App {
  private readonly preferences = inject(PreferencesService);

  protected readonly darkMode = computed(() => this.preferences.darkMode());
  protected readonly showThemeToggle = signal(true);

  constructor() {
    addIcons({
      'document-text-outline': documentTextOutline,
      'time-outline': timeOutline,
      'settings-outline': settingsOutline,
      'moon-outline': moonOutline,
      'sunny-outline': sunnyOutline
    });

    void this.preferences.ensureLoaded();
  }

  protected async toggleDarkMode(): Promise<void> {
    await this.preferences.setDarkMode(!this.darkMode());
  }

}
