# Scripts operativos

## `seed-emulators.mjs`

Carga fixtures ficticios en Auth, Firestore y Storage locales. Exige las variables host de
emuladores, exige el Project ID DEV autorizado y se puede ejecutar repetidamente sin duplicar folios
ni recursos.

## `seed-dev.mjs`

Carga el dataset ficticio V3 en `enfriamatic-operativa-dev`. Rechaza emuladores, otro proyecto y
credenciales insuficientes. Es idempotente y escribe las credenciales iniciales sólo en
`.credentials/`, nunca en Git.

Los comandos canónicos viven en `package.json`; no invoques estos scripts contra PROD o V2.
