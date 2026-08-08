# Desarrollo local

1. Instala dependencias con `npm ci` y `npm ci --prefix functions`.
2. Copia `.env.example` a `.env.local` y completa sólo la configuración pública de Firebase DEV.
3. Usa `npm run dev` para desarrollo de UI o `npm run emulators` para la suite Firebase local.
4. Ejecuta `node scripts/seed-emulators.mjs` únicamente dentro de Emulator Suite; el script rechaza
   conexiones remotas.
5. Antes de entregar, ejecuta las cuatro puertas documentadas en `FIREBASE_DEV.md`.

`npm run test:emulators` y `npm run test:e2e:emulators` levantan y apagan sus propios emuladores. El
seed local se ejecuta dos veces para demostrar idempotencia. Los E2E cubren escritorio y móvil con
administrador principal, administrador promovido, supervisor y operador.

No uses datos reales. Las credenciales generadas viven en `.credentials/`, están ignoradas por Git y
no deben copiarse a logs, tickets ni documentación.
