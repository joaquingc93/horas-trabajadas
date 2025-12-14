# Horas Trabajadas (Ionic + Angular)

Registro móvil de jornadas laborales con Ionic, Angular 21, Tailwind CSS 4 y almacenamiento local persistente.

## Requisitos
- Node.js 20+ y npm 10+ (el proyecto usa `npm@11.7.0` vía `packageManager`).
- Ionic/Angular ya instalados mediante dependencias del proyecto.

## Instalación
```bash
npm install
```

## Ejecución de desarrollo
```bash
npm start
# Navega a http://localhost:4200
```

## Build de producción
```bash
npm run build
```
Artefactos en `dist/horas-trabajadas/`.

## Pruebas unitarias
```bash
npm test
```

## Características
- Formularios reactivos con Ionic UI para capturar inicio y fin de jornada.
- Validación de rango (fin ≥ inicio) y cálculo inmediato de horas (decimal, 2 decimales).
- Persistencia local con `@ionic/storage-angular` (IndexedDB/localForage según plataforma).
- Historial con resumen total, eliminación individual y borrado masivo con confirmación.
- Navegación por pestañas (Registrar / Historial) y feedback con Toast/Alert.
- Standalone components, señales (`signal`, `computed`), `provideIonicAngular`, Tailwind 4.

## Estructura relevante
- `src/app/app.ts` y `app.html`: shell con Ionic Tabs.
- `src/app/pages/entry/*`: formulario y cálculo de horas.
- `src/app/pages/history/*`: listado, totales y acciones.
- `src/app/services/sessions-store.service.ts`: estado en señales + reglas de negocio.
- `src/app/services/session-storage.service.ts`: persistencia en Ionic Storage.
- `src/styles.css`: Tailwind + estilos globales Ionic.

## Configuración extra
- Las dependencias clave (Ionic 8, Ionic Storage 4, Tailwind 4) están instaladas.
- `provideIonicAngular` y `IonicRouteStrategy` ya se declaran en `app.config.ts`.
- No se usan NgModules; toda la app es standalone y con ChangeDetection OnPush.
