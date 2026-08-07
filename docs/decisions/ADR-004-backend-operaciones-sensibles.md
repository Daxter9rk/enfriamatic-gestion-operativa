# ADR-004: Backend para operaciones sensibles

- Estado: aceptado
- Fecha: 2026-08-06

## Decisión

Toda operación sensible futura deberá ejecutarse en Functions Gen 2 y validar identidad, autorización,
entrada y efectos. El cliente no almacenará privilegios ni secretos.

## Consecuencia

`healthCheck` es la única Function actual y expone sólo estado técnico seguro.
