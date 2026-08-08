# Documento Maestro — Enfriamatic Gestión Operativa V3

**Versión documental:** 0.2-approved-for-bootstrap
**Fecha:** 6 de agosto de 2026
**Estado:** Aprobado para preparar el bootstrap
**Producto visible:** Enfriamatic Gestión Operativa
**Versión técnica prevista:** 3.0.0
**Carpeta local autoritativa:** `C:\Users\Daxter_9rk\Desktop\enfriamatic-gestion-operativa`

---

## 1. Propósito

Este documento define la base funcional, visual y técnica de **Enfriamatic Gestión Operativa V3** antes de crear el nuevo repositorio, el nuevo proyecto Firebase DEV y el código de la aplicación.

Su función es evitar que Codex tenga que inferir reglas desde mockups, mezclar decisiones históricas de V2 o improvisar arquitectura durante la implementación.

### 1.1 Orden de autoridad

Ante cualquier contradicción, se usará este orden:

1. Documento Maestro V3 y especificaciones escritas aprobadas.
2. Decisiones posteriores documentadas y aprobadas.
3. Mockups individuales como referencia visual.
4. Tableros generales como referencia conceptual.
5. Documentos V2 como antecedentes históricos, no como fuente autoritativa para V3.

Los datos, nombres, cifras, fechas, gráficas y fotografías de los mockups son ejemplos ficticios. No deben convertirse automáticamente en requisitos.

---

## 2. Visión del producto

**Enfriamatic Gestión Operativa** será una plataforma web interna para centralizar y controlar el ciclo operativo de Enfriamatic:

```text
Cliente
→ Instalación / Planta / Rancho
→ Equipo industrial
→ Solicitud
→ Trabajo operativo
→ Cotización opcional
→ PDF y emisión
→ Seguimiento
→ Cierre
```

El sistema ya no se define como un cotizador. La cotización será uno de sus módulos.

### 2.1 Objetivos

- Centralizar clientes, instalaciones, equipos y expedientes técnicos.
- Organizar solicitudes y asignaciones.
- Permitir supervisión de equipos de operadores.
- Elaborar cotizaciones trazables y seguras.
- Mantener cotizaciones emitidas inmutables.
- Proteger archivos y documentos privados.
- Registrar actividad y auditoría.
- Facilitar el trabajo en computadora, tableta y teléfono.
- Separar claramente DEV y PROD.
- Evitar dependencias ocultas entre frontend, Rules y Functions.

### 2.2 Principios

- Mobile First.
- Seguridad por defecto.
- Menor privilegio.
- Operaciones sensibles en backend confiable.
- Trazabilidad completa.
- Inmutabilidad documental.
- Separación de responsabilidades.
- Entrega incremental por bloques verticales.
- Pruebas antes de promoción.
- No mezclar reparación, implementación, despliegue y documentación en misiones ilimitadas.

---

## 3. Alcance funcional inicial

### 3.1 Incluido

- Autenticación por correo y contraseña.
- Perfiles y estados de usuario.
- Administrador principal.
- Administradores promovidos.
- Operadores con o sin subordinados.
- Jerarquía operativa por supervisor directo.
- Clientes.
- Instalaciones, plantas o ranchos.
- Equipos industriales y expediente técnico.
- Solicitudes y asignaciones.
- Cotizaciones.
- Catálogo comercial.
- Imágenes privadas del catálogo.
- Evidencias y documentos.
- PDF de cotización.
- Notificaciones internas.
- Actividad.
- Auditoría.
- Configuración operativa.
- Centro de ayuda.
- Manuales y guías rápidas.
- CI, emuladores y ambientes DEV/PROD separados.

### 3.2 Fuera del alcance inicial

- Proveedores.
- Inventario.
- Compras.
- Facturación CFDI.
- Cobranza y pagos.
- Contabilidad.
- Portal de clientes.
- Chat interno.
- Aplicación móvil nativa.
- Reportes avanzados como módulo independiente.
- Telemetría automática de equipos.
- Importación libre de datos desde la interfaz.
- Editor de manuales dentro de la aplicación.
- Galerías múltiples por artículo del catálogo.
- ERP completo.

---

## 4. Roles y perfiles operativos

### 4.1 Roles técnicos

```ts
type UserRole = 'admin' | 'operator';
```

### 4.2 Perfiles operativos

- Administrador principal.
- Administrador promovido.
- Operador supervisor.
- Operador sin subordinados.

El supervisor no es un tercer rol. Es un operador activo con subordinados directos.

### 4.3 Administrador principal

Se identifica mediante:

```ts
isPrimaryAdmin: true;
```

Reglas:

- No puede desactivarse a sí mismo.
- No puede degradarse a operador.
- No puede eliminar su propio perfil.
- No puede quedar el sistema sin administrador activo.
- Puede promover operadores a administrador.
- Está protegido frente a modificaciones destructivas por administradores promovidos.

### 4.4 Administrador promovido

Puede administrar la operación ordinaria, usuarios, recursos, catálogos y configuración autorizada.

No puede:

- modificar destructivamente al administrador principal;
- cambiar su propio rol;
- cambiar su propio estado;
- eliminar protecciones estructurales del sistema.

### 4.5 Operador supervisor

Puede:

- procesar sus solicitudes;
- crear solicitudes para sí mismo;
- crear solicitudes para subordinados directos;
- consultar solicitudes de su equipo;
- asignar o reasignar dentro de su equipo;
- consultar la carga de sus subordinados;
- elaborar cotizaciones autorizadas;
- consultar clientes, instalaciones, equipos y catálogo necesarios para operar.

No puede:

- asignar a operadores de otro supervisor;
- asignar a administradores;
- cambiar la estructura organizacional;
- administrar usuarios;
- acceder a configuración crítica;
- acceder a auditoría general.

### 4.6 Operador sin subordinados

Puede:

- crear solicitudes para sí mismo;
- procesar sus solicitudes;
- elaborar cotizaciones autorizadas;
- consultar recursos operativos autorizados;
- consultar su actividad.

No puede asignar solicitudes a otras personas.

### 4.7 Jerarquía

Modelo inicial:

```ts
interface UserProfile {
  uid: string;
  role: 'admin' | 'operator';
  status: 'active' | 'inactive' | 'pending' | 'suspended';
  supervisorId: string | null;
  teamId: string | null;
  isPrimaryAdmin: boolean;
}
```

La asignación por un operador sólo será válida cuando el destinatario sea un operador activo cuyo `supervisorId` coincida con el UID del asignador.

Sólo se consideran subordinados directos. No se implementará inicialmente una jerarquía recursiva.

---

## 5. Navegación por perfil

### 5.1 Administrador

```text
Panel de control
Solicitudes
Cotizaciones
Clientes
Instalaciones
Equipos
Catálogo comercial
Actividad
Usuarios y estructura
Configuración
Centro de ayuda
```

### 5.2 Operador supervisor

```text
Mi operación
Solicitudes
Mi equipo
Cotizaciones
Clientes
Instalaciones
Equipos
Catálogo comercial
Actividad
Centro de ayuda
```

### 5.3 Operador sin subordinados

```text
Mi operación
Mis solicitudes
Cotizaciones
Clientes
Instalaciones
Equipos
Catálogo comercial
Mi actividad
Centro de ayuda
```

No se incluirá inicialmente un módulo independiente de Reportes.

---

## 6. Módulos

## 6.1 Acceso y sesión

Incluye:

- inicio de sesión;
- restauración de sesión;
- cierre de sesión;
- usuario autenticado sin perfil;
- usuario inactivo;
- usuario suspendido;
- rol inválido;
- permiso insuficiente;
- reautenticación para acciones críticas.

## 6.2 Panel de control

### Administrador

- resumen global;
- solicitudes totales;
- solicitudes en proceso;
- solicitudes atrasadas;
- cotizaciones emitidas;
- monto de cotizaciones emitidas;
- carga de trabajo;
- pendientes críticos;
- actividad reciente;
- accesos rápidos.

El monto mostrado no representa ingresos cobrados.

### Supervisor

- solicitudes propias;
- solicitudes del equipo;
- solicitudes sin asignar;
- atrasos;
- carga por integrante;
- actividad del equipo;
- acciones de asignación.

### Operador

- solicitudes propias;
- próximas tareas;
- solicitudes activas;
- cotizaciones propias;
- actividad personal.

## 6.3 Usuarios y estructura operativa

Sólo administradores.

- alta y actualización de usuarios;
- activación y desactivación;
- asignación de rol;
- estructura supervisor-subordinado;
- transferencia de equipo;
- protección del administrador principal;
- auditoría de cambios.

Antes de desactivar a un supervisor, el sistema debe exigir resolver sus subordinados y solicitudes activas.

## 6.4 Clientes

- alta;
- consulta;
- edición;
- baja lógica y reactivación;
- contactos;
- datos fiscales aprobados;
- instalaciones;
- solicitudes;
- cotizaciones;
- historial.

## 6.5 Instalaciones

- cliente relacionado;
- nombre y tipo;
- dirección;
- contacto del sitio;
- Maps;
- referencias de acceso;
- croquis;
- fotografías;
- documentos;
- equipos;
- solicitudes;
- historial.

## 6.6 Equipos

- identificación;
- cliente e instalación;
- categoría;
- marca;
- modelo;
- serie;
- capacidad;
- refrigerante;
- estado operativo;
- especificaciones;
- intervenciones;
- evidencias;
- documentos;
- solicitudes;
- cotizaciones;
- historial.

Los indicadores técnicos sólo aparecerán si existen datos reales que los sustenten.

## 6.7 Solicitudes

Asistente visual por pasos:

1. Cliente.
2. Instalación.
3. Alcance.
4. Servicio.
5. Asignación.
6. Resumen.

Campos principales:

- cliente;
- instalación;
- alcance de instalación general o equipo específico;
- equipo opcional;
- tipo de servicio;
- prioridad;
- fecha solicitada;
- responsable;
- descripción;
- evidencias;
- necesidad de cotización.

### Necesidad de cotización

```text
Sí
No
Por determinar
```

No toda solicitud debe generar cotización.

### Estados generales

```ts
type RequestStatus = 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
```

Etiquetas:

- Nueva.
- Asignada.
- En proceso.
- Completada.
- Cancelada.

### Etapas operativas

```ts
type OperationalStage =
  'reviewing' | 'diagnosing' | 'waiting_information' | 'executing' | 'quoting' | 'follow_up';
```

La etapa no sustituye al estado general.

### Cierre independiente

Una solicitud puede quedar completada aunque la cotización continúe enviada, aceptada, rechazada o vencida.

## 6.8 Catálogo comercial

- productos;
- servicios;
- categoría;
- unidad;
- marca y modelo cuando aplique;
- precio base;
- configuración de IVA;
- estado activo/inactivo;
- imagen opcional;
- búsqueda;
- filtros.

Administradores gestionan. Operadores consultan.

Las imágenes se cargarán, reemplazarán y eliminarán mediante backend protegido. El navegador no escribirá directamente a Storage para este flujo.

## 6.9 Cotizaciones

- solicitud relacionada;
- cliente;
- instalación;
- equipo opcional;
- partidas del catálogo;
- partidas personalizadas;
- cantidades;
- unidades;
- precios;
- descuentos;
- IVA;
- notas;
- condiciones;
- vigencia;
- totales;
- vista previa;
- emisión;
- seguimiento;
- corrección con nuevo folio.

### Estados

```ts
type QuoteStatus = 'draft' | 'issued' | 'sent' | 'accepted' | 'rejected' | 'cancelled' | 'expired';
```

### Descuentos

```ts
type DiscountDisplayMode = 'detailed' | 'summary' | 'incorporated';
```

Internamente siempre se conservarán precio original, precio final, porcentaje, importe descontado, modo, actor y fecha.

### Inmutabilidad

Cuando el PDF se genera correctamente:

- la cotización pasa a `issued`;
- queda bloqueada;
- no se modifican partidas, precios ni condiciones;
- una corrección crea una nueva cotización y un nuevo folio;
- se conserva referencia a la original.

## 6.10 PDF y documentos

### Estado del documento

```ts
type DocumentStatus = 'not_generated' | 'generating' | 'ready' | 'failed';
```

Reglas:

- generación mediante backend confiable;
- almacenamiento privado;
- descarga protegida;
- vista previa autorizada;
- metadata;
- hash cuando aplique;
- reintento seguro;
- idempotencia;
- auditoría;
- un fallo conserva el borrador y el folio.

El PDF no es factura ni CFDI.

## 6.11 Actividad y auditoría

### Actividad

Vista comprensible:

- actor;
- acción;
- recurso;
- fecha;
- navegación al detalle.

### Auditoría

Registro append-only protegido:

- actor;
- rol;
- acción;
- recurso;
- estado anterior;
- estado posterior;
- metadata segura;
- timestamp de servidor.

La auditoría no será modificable desde el cliente.

## 6.12 Notificaciones

- nuevas asignaciones;
- reasignaciones;
- solicitudes próximas a vencer;
- solicitudes atrasadas;
- cotizaciones emitidas;
- rechazos;
- acciones que requieren atención.

No incluye chat.

## 6.13 Configuración

Sólo administradores.

- datos empresariales;
- IVA;
- vigencia predeterminada;
- condiciones comerciales;
- formato de folio;
- plantillas;
- parámetros operativos autorizados.

No habrá un CRUD técnico genérico de “Catálogos internos”.

## 6.14 Centro de ayuda

### Administrador

- Guía general de uso.
- Manual del operador.
- Manual del administrador.

### Operador

- Guía general de uso.
- Manual del operador.

Cada tarjeta mostrará:

- portada;
- descripción;
- versión;
- fecha;
- páginas;
- vista previa;
- descarga PDF.

El backend debe impedir que el operador acceda al Manual del administrador aunque conozca su identificador.

Guías rápidas:

- flujo operativo;
- estados de solicitudes;
- estados de cotizaciones;
- roles y permisos;
- relación cliente-instalación-equipo;
- solución de problemas.

Los PDFs definitivos se crearán cuando la interfaz real esté estabilizada. Codex integrará los archivos; no redactará su contenido.

---

## 7. Reglas visuales

Los mockups son referencia, no especificación píxel por píxel.

Codex debe respetar:

- identidad Enfriamatic;
- barra lateral azul marino;
- fondos claros;
- tarjetas;
- tablas legibles;
- etiquetas de estado;
- selectores visuales;
- jerarquía clara;
- consistencia entre perfiles;
- accesibilidad;
- diseño responsive.

Puede adaptar:

- espaciados;
- tamaño exacto;
- distribución responsive;
- cantidad de columnas;
- conversión de tablas en tarjetas;
- detalles necesarios por accesibilidad o rendimiento.

### Mobile First

- usable desde 360 px;
- sin desplazamiento horizontal obligatorio;
- tablas convertidas en listas o tarjetas;
- formularios largos por pasos;
- resúmenes laterales debajo del contenido;
- acciones principales visibles;
- menú lateral o navegación compacta.

---

## 8. Arquitectura técnica objetivo

### 8.1 Tecnologías base

- React 19.
- TypeScript estricto.
- Vite.
- React Router o alternativa aprobada.
- CSS con tokens de diseño.
- Firebase Authentication.
- Cloud Firestore.
- Cloud Storage.
- Cloud Functions Gen 2.
- Firebase Admin SDK.
- Firebase Hosting.
- GitHub Actions.
- Vitest y React Testing Library.
- Pruebas de Rules y emuladores.
- E2E para flujos críticos.

### 8.2 Capas

```text
Dominio y reglas de negocio
        ↓
Casos de uso
        ↓
Puertos / interfaces
        ↓
Adaptadores Firebase
        ↓
Cloud Functions / API segura
        ↓
Frontend
```

### 8.3 Autoridad por operación

#### Lecturas normales

Firestore SDK y Storage privado, sujetos a Rules y alcance autorizado.

#### Mutaciones simples de bajo riesgo

Podrán usar Firestore SDK sólo cuando las Rules puedan expresarlas de forma clara y verificable.

#### Operaciones obligatoriamente en backend

- creación y administración sensible de usuarios;
- cambios de rol y estructura;
- folios;
- emisión de cotización;
- PDF;
- imágenes del catálogo;
- archivos sensibles;
- auditoría protegida;
- operaciones multi-recurso;
- idempotencia y compensación;
- cualquier transición que no deba confiar en el navegador.

### 8.4 Archivos

- almacenamiento privado;
- rutas generadas en backend;
- validación real de tipo y tamaño;
- sin URLs públicas permanentes;
- metadata en Firestore;
- compensación entre Storage y Firestore;
- prevención de objetos huérfanos y referencias rotas;
- lectura autorizada por rol y relación con el recurso.

### 8.5 Ambientes

Mínimo:

- V3 DEV nuevo.
- V3 PROD futuro.

Cada entorno tendrá proyecto Firebase, variables, datos, secretos, Rules y despliegues separados.

El Firebase V2 permanecerá intacto como referencia hasta la aprobación de la migración.

---

## 9. Modelo de datos conceptual inicial

```text
users
teams
clients
sites
equipment
requests
quotes
quotes/{quoteId}/items
documents
catalogItems
notifications
auditLogs
settings
manuals
```

La estructura física final se aprobará antes de construir módulos de negocio.

### 9.1 Relaciones principales

```text
Client 1 → N Sites
Site 1 → N Equipment
Request N → 1 Client
Request N → 1 Site
Request N → 0..1 Equipment
Request 1 → 0..N Quotes
Quote 1 → N QuoteItems
Quote 1 → 0..N Documents
User 1 → 0..N direct reports
```

---

## 10. Seguridad

- La interfaz no constituye autorización.
- Todas las Functions revalidan identidad, perfil, estado y permisos.
- El frontend no envía roles como autoridad.
- Ningún usuario cambia su propio rol o estado.
- No se permite escalamiento de privilegios.
- No se permite edición de cotizaciones emitidas.
- No se permite escritura directa del navegador en operaciones backend-only.
- Bajas lógicas en lugar de borrado físico rutinario.
- Auditoría append-only.
- Archivos privados.
- Pruebas negativas obligatorias.
- Secretos fuera del repositorio.

---

## 11. Pruebas y Definition of Done

Cada bloque debe incluir:

- contratos tipados;
- validación de entradas;
- permisos;
- estados de carga, vacío, error y permiso denegado;
- pruebas unitarias;
- pruebas de componentes;
- pruebas de Rules;
- pruebas de Functions;
- E2E de flujos críticos;
- validación móvil y escritorio;
- lint;
- typecheck;
- test;
- build;
- documentación;
- commit limpio;
- revisión humana;
- rollback conocido.

No se considera terminado un bloque si sólo funciona mediante mocks cuando requiere integración real con Firebase.

---

## 12. Estrategia de construcción

### Fase 0 — Bootstrap

- carpeta nueva;
- repositorio nuevo;
- Firebase DEV nuevo;
- React, TypeScript y Vite;
- Functions;
- emuladores;
- CI;
- shell visual;
- documentación base.

Sin módulos de negocio.

### Bloque 1 — Acceso y sesión

- Auth;
- perfiles;
- estados;
- rutas;
- pantallas bloqueadas;
- pruebas.

### Bloque 2 — Usuarios y estructura

- administrador principal;
- administradores promovidos;
- operadores;
- supervisión;
- asignación de subordinados;
- protecciones.

### Bloque 3 — Clientes, instalaciones y equipos

- relaciones;
- CRUD lógico;
- expediente técnico inicial;
- archivos autorizados.

### Bloque 4 — Solicitudes

- asistente visual;
- asignación;
- jerarquía;
- estados;
- etapas;
- evidencias;
- actividad.

### Bloque 5 — Catálogo comercial

- productos y servicios;
- lectura por operadores;
- gestión por administradores;
- imágenes mediante backend.

### Bloque 6 — Cotizaciones

- borradores;
- partidas;
- cálculos;
- descuentos;
- impuestos;
- folios;
- vista previa.

### Bloque 7 — PDF e inmutabilidad

- generación;
- Storage privado;
- emisión;
- bloqueo;
- reintentos;
- descarga;
- correcciones.

### Bloque 8 — Actividad, configuración y ayuda

- auditoría;
- notificaciones;
- configuración;
- centro de ayuda;
- integración de manuales.

### Bloque 9 — Preparación PROD

- App Check;
- alertas;
- presupuesto;
- respaldos;
- migración;
- hardening;
- aceptación;
- manuales definitivos.

---

## 13. Reglas para Codex

- No construir todo en una misión ilimitada.
- Una misión por bloque o subbloque.
- No continuar indefinidamente corrigiendo pruebas.
- Límite de tiempo y condición de parada en cada orden.
- No desplegar live sin autorización explícita.
- No crear Firebase PROD al inicio.
- No copiar el código de V2 como base.
- Puede consultar V2 únicamente como referencia funcional.
- No inferir requisitos desde detalles decorativos de mockups.
- No crear funciones fuera del alcance.
- No convertir “Catálogos internos” en Proveedores.
- No crear chat interno.
- No crear Reportes avanzados.
- No modificar documentos autoritativos sin reportarlo.

---

## 14. Manuales

Se prepararán tres manuales funcionales:

1. Guía general de uso.
2. Manual del operador.
3. Manual del administrador.

Durante la construcción se conservarán índices y borradores funcionales. Los PDFs finales se producirán después de estabilizar las pantallas y tomar capturas reales.

Existirá adicionalmente un manual técnico privado fuera de la biblioteca normal de usuarios.

---

## 15. Decisiones confirmadas

### 15.1 Producto e infraestructura

- Nombre visible: **Enfriamatic Gestión Operativa**.
- V3 no se muestra como parte del nombre de la interfaz.
- Carpeta local autoritativa: `C:\Users\Daxter_9rk\Desktop\enfriamatic-gestion-operativa`.
- Repositorio GitHub previsto: `Daxter9rk/enfriamatic-gestion-operativa`.
- Visibilidad del repositorio: **público**.
- Firebase visible: **Enfriamatic Gestión Operativa DEV**.
- Project ID preferido: `enfriamatic-operativa-dev`, sujeto a disponibilidad global al momento del bootstrap.
- Firestore DEV: `us-central1`.
- Cloud Storage DEV: `us-central1`.
- Cloud Functions DEV: `us-central1`.
- Datos iniciales: **100 % ficticios**.
- No crear Firebase PROD durante el bootstrap.
- La cuenta de facturación se vinculará al proyecto DEV cuando corresponda; durante la prueba gratuita se utilizarán los créditos disponibles y no se activará una cuenta pagada completa sin confirmación expresa del propietario.
- Repositorio e infraestructura nuevos.
- Firebase V2 queda congelado como referencia.

### 15.2 Producto y operación

- Roles técnicos `admin` y `operator`.
- Supervisor como operador con subordinados.
- Operadores pueden crear solicitudes para sí mismos o subordinados directos.
- Chat con administrador fuera del sistema.
- Cotización opcional: sí, no o por determinar.
- Solicitud y cotización cierran de forma independiente.
- Cotizaciones emitidas inmutables.
- Correcciones con nueva cotización y nuevo folio.
- Catálogo comercial separado de parámetros internos.
- Proveedores fuera del alcance.
- Imágenes sensibles mediante backend.
- Centro de ayuda único.
- Tres manuales visibles según rol.
- No más mockups antes del bootstrap, salvo una decisión visual bloqueante.

---

## 16. Decisiones abiertas posteriores al bootstrap

Estas decisiones no bloquean la creación de la infraestructura base. Se cerrarán antes del bloque funcional que las necesite:

1. Formato definitivo de folios de solicitud y cotización.
2. Campos fiscales exactos del cliente.
3. Política máxima de descuentos por perfil.
4. Política de cancelación de cotizaciones.
5. Vigencia predeterminada.
6. Plantilla visual definitiva del PDF.
7. Texto legal y condiciones comerciales.
8. Momento de activar App Check.
9. Política de respaldo, retención y restauración.
10. Alcance futuro de exportaciones y reportes.

---

## 17. Condiciones de entrada al bootstrap

Antes de ejecutar la orden de bootstrap:

- La carpeta local debe estar vacía y preferentemente usar el nombre exacto `enfriamatic-gestion-operativa`, sin espacios.
- El Project ID `enfriamatic-operativa-dev` debe comprobarse como disponible.
- La cuenta de Firebase CLI y GitHub CLI debe estar autenticada.
- Debe existir una cuenta de Cloud Billing activa o de prueba gratuita que pueda vincularse al proyecto.
- Cualquier confirmación interactiva de facturación, permisos o términos debe realizarla el propietario.
- No se copiará código desde V2/V2.1.
- Los mockups se usarán como referencia visual, no como especificación literal.

El bootstrap no implementará módulos de negocio ni migrará datos.

---

## 18. Inventario visual disponible

Mockups de referencia ya generados:

- panel de control del administrador;
- mi operación del supervisor;
- solicitudes del operador;
- asistente visual de solicitud;
- detalle de solicitud;
- constructor de cotización;
- expediente técnico del equipo;
- centro de ayuda;
- tableros conceptuales de flujo y módulos.

Estos archivos deberán organizarse y renombrarse antes de entregarlos a Codex.

---

## 19. Próximo paso

1. Revisar este borrador.
2. Corregir contradicciones o funciones faltantes.
3. Cerrar las decisiones de infraestructura.
4. Preparar una orden corta de bootstrap para Codex.
5. Ejecutar el bootstrap sin módulos de negocio.
6. Validar repositorio, Firebase DEV, emuladores, CI y shell visual antes de comenzar el Bloque 1.
