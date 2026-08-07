# Informe de bootstrap

## Estado

**BOOTSTRAP COMPLETADO — LISTO PARA REVISIÓN HUMANA**

Fecha: 2026-08-06 (`America/Mexico_City`).

## Preflight y Git inicial

- Ruta efectiva: `C:\Users\Daxter_9rk\Desktop\enfriamatic-gestion-operativa`.
- La raíz autoritativa no es junction, symlink ni reparse point.
- La variante `enfriamatic-gestion operativa` no existe.
- Rama: `main`.
- Remoto: `https://github.com/Daxter9rk/enfriamatic-gestion-operativa.git`.
- HEAD inicial: inexistente; el repositorio todavía no tenía commits.

## Firebase DEV

- Proyecto: `enfriamatic-operativa-dev`
- Nombre visible: Enfriamatic Operativa DEV
- Plan: Blaze confirmado por intervención humana
- App web: `gestion-operativa-web-dev`
- Firestore: base `(default)`, Standard, Native, `us-central1`
- Storage: `enfriamatic-operativa-dev.firebasestorage.app`, `US-CENTRAL1`
- Functions: `healthCheck`, Gen 2, Node.js 22, `us-central1`
- Alias local: `dev`
- Política de artefactos: elimina imágenes de Functions mayores de 7 días
- Datos: no se crearon colecciones, documentos, objetos ni usuarios remotos

## Bloqueo anterior

Vitest de Functions no podía cargar su configuración porque esbuild intentaba enumerar un directorio
ancestro y el sandbox respondía `Access is denied`. Desde la ruta autoritativa, la ejecución con
permiso de lectura fuera del sandbox aprobó 1/1 prueba sin cambios de código. La causa fue de ejecución,
no de implementación.

## Implementación

- React 19, TypeScript estricto, Vite y React Router
- Firebase Web SDK modular
- Shell Mobile First con sidebar, navegación móvil, indicador DEV y 404
- Reglas Firestore y Storage deny-by-default
- Emuladores Auth, Firestore, Functions, Storage, Hosting y UI configurados
- CI para instalación limpia, formato, lint, tipos, pruebas, builds y Functions
- Sin deploy automático ni secretos de GitHub

## Validación local

### Raíz

- `npm run format:check`: aprobado
- `npm run lint`: aprobado
- `npm run typecheck`: aprobado
- `npm test`: 7/7 pruebas aprobadas en 2 archivos
- `npm run build`: aprobado; 47 módulos transformados
- `npm run validate`: aprobado

### Functions

- `npm --prefix functions run format:check`: aprobado
- `npm --prefix functions run lint`: aprobado
- `npm --prefix functions run typecheck`: aprobado
- `npm --prefix functions test`: 1/1 prueba aprobada
- `npm --prefix functions run build`: aprobado
- `npm --prefix functions run validate`: aprobado

### Emuladores

- Reglas Firestore/Storage: 2/2 pruebas aprobadas
- Hosting Emulator: HTTP 200 y marca presente
- Authentication Emulator: HTTP 200
- Functions Emulator: `healthCheck` correcto
- Firestore, Storage, Functions, Hosting y Auth iniciaron juntos y cerraron limpiamente

## Auditoría de dependencias

- Raíz: 2 vulnerabilidades altas en `react-router-dom`/`react-router` 7.18.2 por un advisory del
  modo RSC. La aplicación es una SPA declarativa y no usa RSC ni acciones de servidor.
- Se evaluó 7.11.0, pero reintroducía múltiples advisories anteriores; se restauró 7.18.2.
- Functions: 8 moderadas transitivas desde `firebase-admin` 13.10.0. npm sólo ofrece
  `firebase-admin` 14.2.0 como corrección mayor.
- No se ejecutó `npm audit fix`, `npm audit fix --force` ni una actualización mayor.

## Despliegues

- Firestore Rules: compiladas y desplegadas
- Storage Rules: compiladas y desplegadas
- Function desplegada: `healthCheck`
- URL: `https://us-central1-enfriamatic-operativa-dev.cloudfunctions.net/healthCheck`
- Respuesta: `{"status":"ok","environment":"dev","service":"enfriamatic-gestion-operativa"}`
- Preview Channel único: `bootstrap`
- Preview URL:
  `https://enfriamatic-operativa-dev--bootstrap-hqon8pt5.web.app`
- Expiración: 2026-08-13 23:46:49
- Preview verificado: HTTP 200 y marca visible
- Hosting live no fue desplegado ni modificado. Su liberación previa conservó la hora
  2026-08-06 23:07:17.
- No existe Firebase PROD.

## CI

GitHub Actions ejecuta instalación limpia, formato, lint, typecheck, pruebas, build y validación de
Functions en push y pull requests hacia `main`. No contiene despliegues ni credenciales.

## Documentación

El Documento Maestro V3, los mockups y los logotipos no estuvieron presentes en el conjunto de
adjuntos accesible. Se dejaron marcadores explícitos; no se fabricó contenido funcional, no se
copiaron assets y no se reutilizó V2.

## Riesgos pendientes

- Incorporar los archivos aprobados de Documento Maestro, mockups y marca cuando se proporcionen.
- Reevaluar los advisories npm cuando existan actualizaciones compatibles y validadas.
- Las alertas de presupuesto notifican; no bloquean gasto.

## Próximo bloque

Autenticación, perfiles, roles y protección de rutas, únicamente después de revisión humana.
