import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar
} from '@ionic/angular/standalone';

import { PreferencesService } from '../../services/preferences.service';

@Component({
  selector: 'app-usuario-page',
  imports: [
    CommonModule,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar
  ],
  templateUrl: './usuario.page.html',
  styleUrl: './usuario.page.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UsuarioPage {
  private readonly preferences = inject(PreferencesService);

  protected readonly userNameInput = signal('');
  protected readonly workCenterNameInput = signal('');
  protected readonly message = signal<string | null>(null);
  protected readonly savingUser = signal(false);
  protected readonly addingCenter = signal(false);
  protected readonly activatingCenterId = signal<string | null>(null);
  protected readonly workCenters = computed(() => this.preferences.workCenters());
  protected readonly activeWorkCenterId = computed(() => this.preferences.activeWorkCenterId());
  protected readonly activeWorkCenterName = computed(
    () => this.preferences.activeWorkCenter()?.name ?? 'Sin centro activo'
  );

  constructor() {
    void this.initialize();
  }

  protected onUserNameInput(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }
    this.userNameInput.set(target.value);
  }

  protected onWorkCenterNameInput(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    this.workCenterNameInput.set(target.value);
  }

  protected async saveUserName(): Promise<void> {
    this.savingUser.set(true);
    const normalizedName = this.userNameInput().trim();

    try {
      await this.preferences.update({
        userName: normalizedName
      });

      this.userNameInput.set(normalizedName);
      this.message.set('Nombre de usuario actualizado.');
    } finally {
      this.savingUser.set(false);
    }
  }

  protected async addWorkCenter(): Promise<void> {
    const rawName = this.workCenterNameInput().trim();
    if (!rawName) {
      this.message.set('Escribe un nombre para el centro de trabajo.');
      return;
    }

    this.addingCenter.set(true);

    try {
      const center = await this.preferences.addWorkCenter(rawName);
      this.workCenterNameInput.set('');
      this.message.set(`Centro "${center.name}" agregado.`);
    } catch (error) {
      const fallback = error instanceof Error ? error.message : 'No se pudo agregar el centro.';
      this.message.set(fallback);
    } finally {
      this.addingCenter.set(false);
    }
  }

  protected async setActiveWorkCenter(centerId: string): Promise<void> {
    if (this.activeWorkCenterId() === centerId) {
      return;
    }

    this.activatingCenterId.set(centerId);

    try {
      await this.preferences.setActiveWorkCenter(centerId);
      const center = this.preferences.workCenters().find((item) => item.id === centerId);
      this.message.set(center ? `Centro activo: ${center.name}.` : 'Centro activo actualizado.');
    } catch (error) {
      const fallback = error instanceof Error ? error.message : 'No se pudo activar el centro.';
      this.message.set(fallback);
    } finally {
      this.activatingCenterId.set(null);
    }
  }

  protected isCenterActive(centerId: string): boolean {
    return this.activeWorkCenterId() === centerId;
  }

  private async initialize(): Promise<void> {
    await this.preferences.ensureLoaded();
    this.userNameInput.set(this.preferences.userName());
  }
}
