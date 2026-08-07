# Enfriamatic Gestión Operativa

Fundamentos técnicos de la plataforma interna que organizará la operación de Enfriamatic. Este
repositorio es una implementación limpia: no reutiliza código, configuración, historial ni datos de
versiones anteriores.

## Estado

Bootstrap técnico DEV. Incluye un shell responsive, configuración modular de Firebase, reglas
deny-by-default, emuladores, CI y una única Function de diagnóstico (`healthCheck`). No contiene
módulos ni datos de negocio.

## Requisitos

- Node.js 22
- npm 10 o posterior
- Firebase CLI 15 o posterior
- Java 17 o posterior para los emuladores

## Instalación

```bash
npm ci
npm ci --prefix functions
copy .env.example .env.local
```

Completa `.env.local` exclusivamente con la configuración pública de la app web Firebase. El archivo
está ignorado por Git.

## Scripts

| Comando                  | Propósito                                                |
| ------------------------ | -------------------------------------------------------- |
| `npm run dev`            | Inicia Vite localmente                                   |
| `npm run lint`           | Ejecuta ESLint                                           |
| `npm run format:check`   | Comprueba Prettier                                       |
| `npm run typecheck`      | Valida TypeScript estricto                               |
| `npm test`               | Ejecuta pruebas unitarias del frontend                   |
| `npm run build`          | Genera `dist/` reproducible                              |
| `npm run validate`       | Ejecuta todas las validaciones del frontend              |
| `npm run emulators`      | Inicia Auth, Firestore, Storage, Functions, Hosting y UI |
| `npm run test:emulators` | Ejecuta pruebas de reglas contra emuladores              |

Functions dispone de `lint`, `format:check`, `typecheck`, `test`, `build` y `validate` mediante
`npm --prefix functions run <script>`.

## Firebase DEV

- Project ID: `enfriamatic-operativa-dev`
- Alias: `dev`
- Región de datos y cómputo: `us-central1`
- Runtime de Functions: Node.js 22
- Hosting: sólo canales preview durante este bootstrap

Consulta [FIREBASE_DEV.md](docs/operations/FIREBASE_DEV.md) para operaciones remotas y
[LOCAL_DEVELOPMENT.md](docs/operations/LOCAL_DEVELOPMENT.md) para el flujo local.

## Restricciones

No se permiten datos reales, módulos de negocio, autenticación funcional, Firebase PROD, secretos,
service accounts ni despliegues automáticos. Hosting live requiere autorización humana explícita.

## Próximo bloque

Autenticación, perfiles, roles y protección de rutas, en una misión separada.
