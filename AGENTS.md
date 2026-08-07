# Instrucciones para agentes

1. `docs/product/DOCUMENTO_MAESTRO_V3.md` es la fuente autoritativa cuando se incorpore el archivo
   aprobado. Los mockups sólo son referencia visual; la especificación escrita prevalece.
2. No ampliar alcance ni convertir elementos decorativos en requisitos.
3. Trabajar por bloques verticales y ejecutar una misión separada por módulo.
4. No reutilizar código, reglas, configuración, datos, assets ni historial de V2/V2.1.
5. No desplegar Hosting live ni recursos adicionales sin autorización humana explícita.
6. No trabajar más de 90 minutos sin checkpoint; ante un bloqueo de 15 minutos, detenerse y reportar.
7. Detenerse antes de cambios destructivos, irreversibles o que afecten facturación.
8. Mantener datos exclusivamente ficticios y nunca versionar secretos o credenciales.
9. Mantener Firestore y Storage deny-by-default hasta que un módulo autorice reglas específicas.
10. Antes de entregar, ejecutar validaciones, revisar secretos y confirmar el alcance del diff.
