import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
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
import { documentTextOutline, settingsOutline, timeOutline } from 'ionicons/icons';

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

  constructor() {
    addIcons({
      'document-text-outline': documentTextOutline,
      'time-outline': timeOutline,
      'settings-outline': settingsOutline
    });

    void this.preferences.ensureLoaded();
  }
}
