# Firebase DEV

## Destino único autorizado

- Nombre visible: Enfriamatic Operativa DEV
- Project ID: `enfriamatic-operativa-dev`
- Alias local: `dev`
- Firestore, Storage y Functions: `us-central1`
- Functions Gen 2: Node.js 22

Antes de cualquier escritura remota, comprueba siempre:

```bash
firebase use
firebase projects:list
```

El Project ID efectivo debe ser exactamente `enfriamatic-operativa-dev`. Los scripts de seed también
rechazan emuladores activos, otro Project ID y credenciales ausentes.

## Puertas previas obligatorias

```bash
npm run validate
npm --prefix functions run validate
npm run test:emulators
npm run test:e2e:emulators
git diff --check
```

No continúes si alguna puerta falla.

## Despliegue V3 DEV

Despliega backend y políticas antes del frontend:

```bash
firebase deploy --project enfriamatic-operativa-dev --only auth,firestore:rules,firestore:indexes,storage,functions
npm run seed:dev -- --project enfriamatic-operativa-dev
firebase hosting:channel:deploy full-v3 --project enfriamatic-operativa-dev --expires 7d
firebase deploy --project enfriamatic-operativa-dev --only hosting
```

El seed es idempotente y sólo genera datos ficticios DEV. Las credenciales iniciales se escriben en
`.credentials/`, directorio ignorado por Git; deben entregarse por un canal seguro y cambiarse antes
de cualquier uso no controlado.

CI no contiene pasos de despliegue. Nunca ejecutar estos comandos contra otro proyecto, ni crear
PROD/V2, ni alterar la facturación desde CLI.

## Verificación y rollback

Tras desplegar, valida el health check, autenticación por rol, lectura restringida, creación de una
solicitud ficticia, PDF, archivo privado y las URLs Preview/live. Para rollback de Hosting usa la
versión anterior desde Firebase Console; para código y reglas revierte mediante un commit y vuelve a
desplegar explícitamente. Consulta [`ROLLBACK.md`](ROLLBACK.md).
