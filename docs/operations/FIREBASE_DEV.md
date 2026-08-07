# Firebase DEV

## Identidad

- Nombre: Enfriamatic Operativa DEV
- Project ID: `enfriamatic-operativa-dev`
- Alias local: `dev`
- Plan: Blaze, vinculado manualmente a una cuenta de prueba gratuita

## Regiones y runtime

- Firestore Native: `us-central1`
- Cloud Storage: `us-central1`
- Functions Gen 2: `us-central1`
- Runtime: Node.js 22

## Despliegue permitido durante bootstrap

```bash
firebase deploy --project dev --only functions:healthCheck,firestore:rules,storage
firebase hosting:channel:deploy bootstrap --project dev --expires 7d
```

No usar `firebase deploy --only hosting`: ese comando modifica Hosting live. No crear PROD ni alterar
facturación desde CLI.
