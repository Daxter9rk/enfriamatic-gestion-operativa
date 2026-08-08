# Enfriamatic Gestión Operativa V3

Aplicación interna para administrar la operación de Enfriamatic en un entorno Firebase DEV aislado.
Es una implementación limpia: no reutiliza código, configuración, historial ni datos de versiones
anteriores.

## Estado

V3 funcional en desarrollo. Incluye autenticación, perfiles y jerarquía, dashboards por rol,
directorios de clientes/instalaciones/equipos, solicitudes, catálogo, cotizaciones con PDF,
documentos privados, actividad, notificaciones, configuración y centro de ayuda. Las operaciones
sensibles y los folios viven en Cloud Functions; Firestore y Storage aplican deny-by-default.

El documento de producto vinculante es
[`docs/product/DOCUMENTO_MAESTRO_V3.md`](docs/product/DOCUMENTO_MAESTRO_V3.md).

## Requisitos

- Node.js 22
- npm 10 o posterior
- Firebase CLI 15 o posterior
- Java 17 o posterior para Emulator Suite

## Instalación

```bash
npm ci
npm ci --prefix functions
copy .env.example .env.local
```

Completa `.env.local` sólo con la configuración pública de la aplicación web Firebase DEV. Nunca
guardes credenciales privadas en archivos versionados.

## Comandos canónicos

| Comando                               | Propósito                                                     |
| ------------------------------------- | ------------------------------------------------------------- |
| `npm run dev`                         | Inicia Vite localmente                                        |
| `npm run validate`                    | Formato, lint, tipos, unit tests y build del frontend         |
| `npm --prefix functions run validate` | Validación completa de Functions                              |
| `npm run emulators`                   | Inicia Emulator Suite                                         |
| `npm run test:emulators`              | Rules e integración Auth/Firestore/Functions/Storage          |
| `npm run test:e2e:emulators`          | E2E Chromium de escritorio y móvil con seed local idempotente |
| `npm run seed:dev`                    | Seed remoto idempotente, sólo para el proyecto DEV autorizado |

## Firebase DEV

- Project ID y alias: `enfriamatic-operativa-dev` / `dev`
- Región de datos y Functions: `us-central1`
- Runtime de Functions: Node.js 22
- Datos permitidos: exclusivamente ficticios y marcados DEV
- Canal Preview canónico: `full-v3`, expiración de 7 días
- Hosting live permitido únicamente en este proyecto DEV

Consulta [`docs/operations/FIREBASE_DEV.md`](docs/operations/FIREBASE_DEV.md) para despliegue y
rollback, y [`docs/operations/LOCAL_DEVELOPMENT.md`](docs/operations/LOCAL_DEVELOPMENT.md) para el
flujo local.

## Límites permanentes

No crear ni modificar Firebase PROD o V2. No cargar datos reales. No guardar secretos, contraseñas,
service accounts ni credenciales locales en Git. CI valida el repositorio, pero no despliega ni
ejecuta seed remoto.
