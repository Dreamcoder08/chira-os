# Modelo de seguridad de la base Guardian

## Activos, actores y límites

Protegemos identidad de productores, ubicación de parcelas, evidencia, membresías y
credenciales. Consideramos clientes manipulados, usuarios de otra asociación, sesiones
revocadas, archivos hostiles, dispositivos perdidos y dependencias comprometidas.

Los límites principales son navegador/servidor, una asociación/otra, identidad/dominio,
API/worker y aplicación/almacenamiento. Un teléfono desbloqueado, un servidor comprometido
o una dependencia ejecutada durante desarrollo conservan autoridad que la arquitectura
hexagonal no elimina.

## Invariantes comprobables

- Cada petición requiere sesión vigente y asociación autorizada. Un selector en cabecera
  o query de descarga solo selecciona contexto; no concede permisos.
- El rol proviene de membresías de servidor. El autor esperado del borrador debe coincidir
  con la sesión; un cambio de cuenta no reasigna silenciosamente evidencia.
- Contexto SQL usa set_config local a transacción y se revierte incluso tras errores.
- Las tablas agrícolas fuerzan RLS y los roles de aplicación no son dueños ni pueden omitirla.
- Identidad tiene conexión independiente; API/worker no leen tokens ni hashes de contraseña.
- Repetir una clave con otro cuerpo falla. Una escritura concurrente obsoleta no cambia la
  evidencia ganadora. Las revisiones exigen coordinador e inspección enviada.
- Fotos privadas: límites de entrada/píxeles, formatos permitidos, recodificación, EXIF fuera,
  publicación atómica, comprobación de bytes en retry y descarga autorizada sin caché.
- Trabajos ligados al evento outbox completo; volver a ejecutarlo produce un solo efecto.
- Cerrar sesión elimina IndexedDB. Una marca no secreta en localStorage bloquea el acceso
  hasta completar una revocación pendiente, incluso tras cerrar una pestaña.

## Controles web y desarrollo

Cookies HttpOnly, SameSite y Secure con HTTPS; comprobación de Origin en mutaciones,
origen único, CSP, sin HTML de usuarios ni proveedores de scripts. No se habilitan OAuth,
SSO, magic links, signup público o plugins no necesarios.

Fastify limita solicitudes; Better Auth conserva sus límites de acceso. Son límites en memoria
para esta instancia local. Un despliegue con múltiples réplicas requiere un control compartido
y configuración explícita del proxy confiable; trustProxy está desactivado.

Logs HTTP registran ruta sin parámetros, resultado, duración e identificador de petición.
Errores públicos no revelan SQL ni trazas. Se desactiva el logger interno de autenticación para
evitar que errores de adaptador expongan tokens; los fallos quedan reflejados en resultados HTTP.
Auditoría de negocio es append-only para roles de aplicación. El administrador de base puede
alterarla; no se afirma que sea un registro inviolable o apto para peritaje.

## Avisos revisados el 23 de octubre de 2026

| Evidencia                                                                                                                                                  | Aplicación de la decisión                                                                          |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| [Fastify GHSA-389g-gv7q-r4x8](https://github.com/fastify/fastify/security/advisories/GHSA-389g-gv7q-r4x8), corrección 5.12.6                               | Fijado 5.12.7; no delegar autorización en validación HTTP                                          |
| [Better Auth GHSA-965c-763c-88jm](https://github.com/better-auth/better-auth/security/advisories/GHSA-965c-763c-88jm), actualizado el 22, corrección 1.7.7 | Fijado 1.7.12, sin funcionalidades OAuth; el aviso no demuestra afectación al login por contraseña |
| [Vitest GHSA-p458-7748-mcp3](https://github.com/vitest-dev/vitest/security/advisories/GHSA-p458-7748-mcp3), publicado el 21                                | Fijado 5.0.5; CI usa ejecución sin UI/API de pruebas                                               |
| [Next.js GHSA-673q-mjm6-r5xr](https://github.com/vercel/next.js/security/advisories/GHSA-673q-mjm6-r5xr), publicado el 22                                  | Next.js no está en este stack; el aviso no implica que React/Vite esté libre de fallos             |
| [Repositorio MinIO](https://github.com/minio/minio) archivado                                                                                              | Retirado como dependencia nueva; adaptador local y puerto S3                                       |

Las fechas distinguen publicación del proyecto, indexación y actualización. No se ha hecho
una investigación exhaustiva de todos los incidentes de la semana. Consulta de CISA directa
rechazada por el sitio; se pudo consultar su espejo oficial. No se deduce explotación de un
aviso solo por existir o por tener severidad crítica.

## Antes del piloto real

Verificar consentimiento, minimización y tratamiento conforme a Ley 29733; establecer
responsable operativo y agrónomo, retención, cifrado de copias, identidad reforzada para
coordinadores, soporte de dispositivos, HTTPS, proveedor de almacenamiento y alertas.
El adaptador S3 necesita pruebas contra el proveedor elegido y políticas privadas verificadas.
No hay despliegue, notificación de incidentes automatizada ni certificación de cumplimiento.

La política de respuesta y excepciones está en SECURITY.md. No hay excepciones permanentes
de vulnerabilidades conocidas introducidas para superar los controles de esta base.
