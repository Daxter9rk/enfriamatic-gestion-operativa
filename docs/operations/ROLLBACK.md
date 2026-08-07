# Rollback

## Código local

Antes del primer commit, conserva el árbol y revisa cambios con `git diff`. Después del bootstrap,
prefiere una reversión explícita mediante un nuevo commit; no uses `git reset --hard`.

## Function

Si `healthCheck` falla tras el despliegue, conserva logs sin datos sensibles y corrige en una misión
autorizada. Su eliminación remota requiere aprobación humana.

## Reglas

Las reglas base niegan todo. Ante una regresión futura, volver a esta versión conservadora reduce
exposición; validar primero en emuladores.

## Hosting Preview

Los canales preview expiran. Pueden eliminarse desde Firebase Console si se autoriza; Hosting live no
forma parte de este procedimiento.
