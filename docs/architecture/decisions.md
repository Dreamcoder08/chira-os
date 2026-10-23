# Decisiones de arquitectura

## ADR 001 — Monolito modular hexagonal

Un piloto de una asociación necesita consistencia, conectividad intermitente y una operación
entendible. API y worker comparten dominios y base; son procesos separados, no microservicios.
Los módulos actuales son identidad/asociaciones, parcelas e inspecciones. Los puertos viven
en dominio; los adaptadores manejan los efectos externos. CI prohíbe imports invertidos.

Elegimos pnpm sin otro orquestador de monorepo: siete unidades pequeñas no justifican una
capa de caché remota o generación adicional. Las dependencias se gestionan centralmente.
Separamos interfaces donde existe una dependencia externa; no añadimos interfaces por clase.

## ADR 002 — Fuente de verdad y concurrencia

PostgreSQL conserva la evidencia recibida. Cada operación usa transacción, contexto de
asociación local a esa transacción, membresía verificada, RLS y autorización del caso de uso.
La versión se comprueba también al persistir, porque un SELECT FOR UPDATE no bloquea una
fila inexistente. La deduplicación liga usuario, asociación, operación y cuerpo de petición.

Las inspecciones enviadas no se editan. La revisión es un registro adicional. El checklist
representa una declaración del técnico; no demuestra por sí solo cumplimiento en campo.

## ADR 003 — Offline explícito

IndexedDB conserva parcelas asignadas y borradores con adjuntos; no guarda tokens ni
contraseñas. El service worker guarda el shell, nunca respuestas API o fotografías privadas.
La cola local retiene las mismas claves durante reintentos y no asume entrega exactamente una vez.
Al confirmar el envío, se elimina el borrador. Un conflicto requiere resolución humana.

Los dispositivos son individuales. El cifrado del sistema y el bloqueo del teléfono son
requisitos operativos. El navegador puede desalojar almacenamiento; persistencia solicitada
no garantiza conservación permanente. El usuario debe sincronizar en cuanto sea posible.

## ADR 004 — Fotografías y almacenamiento intercambiable

MinIO se descartó por el archivo de su repositorio oficial. Desarrollo usa almacenamiento
privado local; S3 está implementado detrás del mismo puerto, pero no se ha provisionado ni
verificado contra un proveedor real. No se afirma compatibilidad con todos los S3 compatibles.

Los archivos se recodifican a WebP, sin EXIF, y se publican atómicamente sin sobrescribir.
Un retry sobre una ruta existente solo confirma bytes idénticos. Una caída puede dejar un
temporal o archivo huérfano; se conserva la seguridad de la evidencia, pero se necesitará
una política de limpieza antes de operar a mayor escala.

## ADR 005 — Outbox y cola PostgreSQL

La revisión y el evento outbox se escriben en la misma transacción. El worker obtiene
identificadores mediante una función SQL estrecha, entrega a pg-boss y confirma el despacho.
La ejecución verifica el evento completo, su membresía vigente y el recurso. El efecto se
deduplica por evento; puede haber reentregas después de una caída, sin duplicar auditoría.

Solo se registra preparación de seguimiento dentro de CHIRA OS. No hay proveedores externos
ni garantía de que un técnico haya realizado una visita. Los fallos de cola deben ser revisados
por el operador; no hay autoscaling ni un servicio de guardia en esta entrega.

## ADR 006 — Runtime mínimo y cadena de suministro

El primer escaneo de la imagen Node Debian 12 detectó vulnerabilidades de severidad alta/crítica
en paquetes del sistema y herramientas incluidas. Cambiamos el runtime a distroless Node 24
Debian 13 no root, fijado por digest; build conserva herramientas fuera del runtime final.
No se excluyeron CVE para obtener un resultado verde. Cada cambio de imagen exige reanalizarla.

El escaneo de la imagen inicial de PostGIS 17/3.5 también detectó componentes antiguos de
Debian 11. Se sustituyó el pin por PostGIS 17/3.6 usando el digest verificado en Docker Hub.
Una caída de conectividad HTTP 503 impidió terminar su descarga y análisis en esta sesión;
queda explícitamente pendiente y se exige como gate de CI antes del piloto. No se puede
inferir un resultado limpio solo porque la etiqueta sea más reciente.

Las versiones npm se fijan en lockfile y se aplica espera de 72 horas a nuevas publicaciones,
con excepciones explícitas para parches de seguridad revisados. Esto reduce exposición a
publicaciones recientes, pero no detecta por sí mismo un paquete malicioso.
