# Desarrollo local

1. Instala dependencias con `npm ci` y `npm ci --prefix functions`.
2. Copia `.env.example` a `.env.local` y completa sólo valores públicos.
3. Ejecuta `npm run dev` para trabajar en el shell.
4. Ejecuta `npm run emulators` para iniciar la suite Firebase local.
5. Ejecuta `npm run test:emulators` para verificar reglas conservadoras.
6. Antes de entregar, ejecuta `npm run validate` y `npm --prefix functions run validate`.

Los emuladores usan un proyecto demo controlado por la configuración local; nunca deben recibir datos
reales.
