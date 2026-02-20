import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'entry',
    pathMatch: 'full'
  },
  {
    path: 'entry',
    loadComponent: () => import('./pages/entry/entry.page').then((m) => m.EntryPage)
  },
  {
    path: 'history',
    loadComponent: () => import('./pages/history/history.page').then((m) => m.HistoryPage)
  },
  {
    path: 'settings',
    loadComponent: () => import('./pages/usuario/usuario.page').then((m) => m.UsuarioPage)
  },
  {
    path: 'usuario',
    redirectTo: 'settings',
    pathMatch: 'full'
  },
  {
    path: '**',
    redirectTo: 'entry'
  }
];
