# ADR-003: Separación DEV/PROD

- Estado: aceptado
- Fecha: 2026-08-06

## Decisión

Configurar exclusivamente `enfriamatic-operativa-dev`. PROD deberá usar otro proyecto, variables y
proceso autorizado.

## Consecuencia

El bootstrap no puede crear, inferir ni desplegar infraestructura productiva.
