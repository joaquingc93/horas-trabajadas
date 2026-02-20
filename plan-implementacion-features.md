# Plan de implementacion de mejoras

## Objetivo

Este documento sirve como guia de implementacion para las mejoras solicitadas en la app `horas-trabajadas`, manteniendo consistencia funcional y visual con el design system (light/dark).

## Alcance de esta iteracion

- Validaciones de fecha/hora de entrada y salida en alta y edicion.
- Scroll confiable en historial.
- Filtro de historial por fecha **y** hora.
- Limpieza del formulario al guardar sesion.
- Seccion `Usuario` vuelve a `Ajustes`.
- Nueva funcionalidad en ajustes: **agregar** centros de trabajo y **activar** centro de trabajo.
- Historial, resumen y exportaciones acotados al centro de trabajo activo.
- Nombre de exportaciones incluye usuario + centro activo.

## Decisiones funcionales ya confirmadas

- No hay migracion de datos legacy (datos borrados, storage limpio).
- En centros de trabajo, por ahora solo:
  - agregar centro
  - activar centro
- No incluye en esta iteracion:
  - editar centro
  - eliminar centro
- En historial, solo debe tener scroll la zona de entradas.
- El bloque superior del historial (centro activo, filtros, resumen, acciones y `action-message`) debe quedar fijo.
- El texto de centro activo debe mostrarse centrado (sin elipsis).

## Arquitectura objetivo (resumen)

### Modelos

- `WorkSession` debe incluir `workCenterId`.
- Nuevo modelo `WorkCenter`:
  - `id: string`
  - `name: string`
  - `createdAtIso: string`
- `AppPreferences` debe incluir:
  - `workCenters: WorkCenter[]`
  - `activeWorkCenterId: string | null`

### Servicios

- `PreferencesService`:
  - mantener nombre de usuario y tema
  - agregar gestion de centros (crear y activar)
  - exponer centro activo para consumo en paginas
- `SessionsStoreService`:
  - guardar sesion con centro activo
  - actualizar/filtrar por centro activo
  - validar rango fecha/hora de forma centralizada
- `SessionStorageService`:
  - persistir/normalizar sesiones con `workCenterId`

### UI

- Tab y pagina de `Ajustes` (reemplaza `Usuario`).
- Formulario de ajustes con:
  - nombre de usuario
  - alta de centros
  - selector de centro activo
- Historial y filtros alineados con centro activo.
- Modales y controles nuevos con estilo consistente en light/dark.

## Fases de implementacion

## Fase 1 - Ajustes y centros de trabajo (base de dominio)

1. Renombrar UI/etiquetas/ruta de `Usuario` a `Ajustes`.
2. Crear modelo `WorkCenter`.
3. Extender `AppPreferences` con centros y centro activo.
4. Extender `PreferencesService` con metodos:
   - `addWorkCenter(name: string)`
   - `setActiveWorkCenter(id: string)`
5. Reglas de validacion para alta de centros:
   - nombre requerido
   - trim
   - max length razonable
   - sin duplicados case-insensitive
6. Actualizar vista de ajustes para agregar y activar centros.

**Resultado esperado:** ajustes permite mantener usuario + centros, y existe centro activo unico.

## Fase 2 - Sesiones vinculadas al centro activo

1. Extender `WorkSession` con `workCenterId`.
2. Actualizar `SessionsStoreService.add(...)` para asignar centro activo.
3. Garantizar que historial trabaje sobre sesiones del centro activo.
4. Ajustar resumenes y totales para usar sesiones filtradas por centro activo.

**Resultado esperado:** cada centro tiene su propio contexto de jornadas.

## Fase 3 - Validacion fecha/hora entrada/salida

1. Regla unica de negocio: `end > start` (estrictamente posterior).
2. Aplicar regla en:
   - alta de sesion (Entry)
   - edicion de sesion (History)
   - servicio de dominio (fuente de verdad)
3. Mensajeria de error clara para usuario.

**Resultado esperado:** no se persiste ninguna sesion con salida igual o anterior a entrada.

## Fase 4 - Limpieza de formulario al guardar

1. Al guardar sesion correctamente en Entry:
   - limpiar fecha/hora entrada
   - limpiar fecha/hora salida
   - limpiar estado de validacion
   - conservar feedback de exito
2. Mantener consistencia de drafts de pickers para siguiente captura.

**Resultado esperado:** formulario listo para nueva carga sin datos residuales.

## Fase 5 - Filtro por fecha y hora en Historial

1. Usar filtros `Desde` y `Hasta` con precision de fecha y hora.
2. Unificar experiencia con `ion-modal` + `ion-datetime` (sin mezclar pickers nativos inconsistentes).
3. Comparar por timestamp completo al filtrar.

**Resultado esperado:** filtrado preciso por rango temporal, estable en mobile.

## Fase 6 - Scroll de historial

1. Separar layout del historial en dos zonas:
   - zona fija superior (centro activo, filtros, resumen, acciones y `action-message`)
   - zona scrolleable inferior (lista de sesiones / empty state)
2. Configurar `ion-content` del historial sin scroll principal y mover el scroll al contenedor de entradas.
3. Ajustar estilos/containers en `history.page.css` para evitar doble scroll o bloqueos tactiles.
4. Verificar con lista larga de sesiones.

**Resultado esperado:** solo las entradas hacen scroll, el bloque superior queda fijo, y el scroll es fluido en Android/iOS/web.

## Fase 6.1 - Scroll de Ajustes

1. Configurar scroll explicito en la pantalla de ajustes.
2. Verificar que formularios/listas largos no bloqueen el desplazamiento en mobile.

**Resultado esperado:** ajustes con scroll confiable en Android/iOS/web.

## Fase 7 - Exportaciones con usuario + centro

1. Ajustar generacion de nombre de archivo PDF/Excel para incluir:
   - nombre de usuario normalizado
   - centro activo normalizado
   - fecha actual
2. Exportar solo sesiones del centro activo.

**Formato objetivo:**

- `reporte-jornadas-{usuario}-{centro}-{fecha}.pdf`
- `reporte-jornadas-{usuario}-{centro}-{fecha}.xlsx`

## Fase 8 - Alineacion visual design system

1. Revisar nuevos bloques en `Ajustes`, `Historial` y modales.
2. Mantener tokens globales (`--app-*`) y consistencia de estados.
3. Verificar contraste, focus, disabled, tipografia y espaciados en light/dark.
4. Asegurar que el bloque de centro activo en historial este visualmente centrado.

## Archivos candidatos a cambios

- `src/app/models/work-session.ts`
- `src/app/models/app-preferences.ts`
- `src/app/models/work-center.ts` (nuevo)
- `src/app/services/preferences.service.ts`
- `src/app/services/session-storage.service.ts`
- `src/app/services/sessions-store.service.ts`
- `src/app/pages/entry/entry.page.ts`
- `src/app/pages/entry/entry.page.html`
- `src/app/pages/history/history.page.ts`
- `src/app/pages/history/history.page.html`
- `src/app/pages/history/history.page.css`
- `src/app/pages/usuario/*` (renombrar semanticamente a ajustes si aplica)
- `src/app/app.html`
- `src/app/app.ts`
- `src/app/app.routes.ts`
- `src/app/app.spec.ts`
- `src/styles.css`

## Criterios de aceptacion

1. Alta/edicion bloquean cualquier caso con `fin <= inicio`.
2. Historial: solo la lista de entradas hace scroll con muchos registros.
3. Historial: bloque superior (incluido `action-message`) permanece fijo.
4. Centro activo se muestra centrado en historial.
5. Filtro por fecha+hora funciona y actualiza resultados en tiempo real al aplicar.
6. Guardar sesion limpia formulario de entrada/salida.
7. Ajustes permite agregar centros y activar uno.
8. Ajustes hace scroll correctamente.
9. Historial y resumen muestran solo sesiones del centro activo.
10. PDF/Excel incluyen usuario y centro activo en nombre de archivo.
11. UI consistente en modo claro y oscuro.

## Plan de pruebas

## Pruebas funcionales manuales

- Crear centro A y centro B.
- Activar centro A y crear sesiones.
- Activar centro B y crear sesiones.
- Verificar que historial cambia segun centro activo.
- Validar error al intentar guardar/editar con `fin <= inicio`.
- Verificar limpieza de formulario tras guardado.
- Probar filtros por fecha+hora (casos limite exactos).
- Verificar en historial que solo la zona de entradas scrollea y el resto queda fijo.
- Verificar que `action-message` permanezca fijo en el bloque superior.
- Verificar centro activo centrado visualmente.
- Verificar scroll de ajustes con contenido largo.
- Exportar PDF/Excel y validar nombre y contenido.

## Pruebas tecnicas recomendadas

- `npx ng test --watch=false --include src/app/pages/entry`
- `npx ng test --watch=false --include src/app/pages/history`
- `npx ng test --watch=false --include src/app/services`
- `npm run build`

## Riesgos y mitigacion

- Riesgo: regresiones en tactil/pickers Android.
  - Mitigacion: unificar pickers con modales `ion-datetime`.
- Riesgo: doble scroll en historial (scroll del `ion-content` + scroll interno).
  - Mitigacion: desactivar scroll principal y usar un unico contenedor scrolleable para entradas.
- Riesgo: incoherencia entre validacion UI y dominio.
  - Mitigacion: regla central en `SessionsStoreService` + feedback UI.
- Riesgo: mezcla de datos entre centros.
  - Mitigacion: filtrar por centro activo en un unico punto del flujo.

## Checklist de entrega

- [ ] Reglas de fecha/hora implementadas en alta/edicion/servicio
- [ ] Scroll historial validado
- [ ] Filtro por fecha+hora implementado
- [ ] Formulario se limpia al guardar
- [ ] Ajustes con alta/activacion de centros
- [ ] Historial acotado por centro activo
- [ ] Nombre exportaciones con usuario + centro
- [ ] Light/dark alineado con design system
- [ ] Build y pruebas basicas ejecutadas
