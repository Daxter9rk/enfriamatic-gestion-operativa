# Arquitectura del bootstrap

## Propósito

Establecer una base técnica verificable sin modelar todavía el dominio operativo.

## Capas

- `src/app`: composición, providers, rutas y configuración.
- `src/shared`: shell y servicios técnicos reutilizables.
- `src/styles`: tokens y estilos globales Mobile First.
- `functions/src`: endpoints técnicos Gen 2; por ahora sólo `healthCheck`.
- `tests/rules`: pruebas de seguridad contra emuladores.
- `docs`: arquitectura, decisiones, producto, operaciones y reportes.

## Límites de seguridad

El cliente sólo contiene configuración pública de Firebase. Firestore y Storage niegan todo acceso.
Las futuras operaciones sensibles deben vivir en backend, validar autorización y registrar sólo datos
aprobados por el Documento Maestro.

## Entornos

Este repositorio configura exclusivamente DEV. PROD deberá crearse en una misión independiente, con
proyecto, variables, secretos y procesos de despliegue separados.
