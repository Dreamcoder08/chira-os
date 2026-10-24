# Evidencia de verificación — 24 de octubre de 2026

## Imagen de base de datos propia (24 de octubre)

Ninguna variante oficial de PostGIS llegaba a cero hallazgos, así que el proyecto construye su
propia imagen desde `Dockerfile.db`, derivada de `postgis/postgis:17-3.6-alpine` fijada por digest
`sha256:cd7b00a457793cabd269af2af292a994754d130ac1e564ae1c053abb22b947cf`.

- Base oficial verificada por `RepoDigests`, no por etiqueta. Dentro del contenedor:
  `postgis_version()` = `3.6 USE_GEOS=1 USE_PROJ=1 USE_STATS=1`, PostgreSQL `17.11`
  (compilado para musl, Alpine 3.24.3).
- La imagen sustituye `gosu` (binario Go con 26 hallazgos HIGH/CRITICAL sin corrección upstream)
  por `su-exec` mediante un entrypoint envoltorio, y aplica `apk upgrade` para cerrar paquetes
  atrasados como `brotli-libs`.
- `docker compose config --images` devuelve `chira-os-db:local`; `compose.yaml` la construye.
- `pnpm security:database`: sale 0 con **0 hallazgos** en la imagen propia. Sin exclusiones de
  CVE ni cambios de severidad.
- `pnpm db:migrate` y `pnpm db:seed` sobre la imagen propia: correctos.
- `pnpm test:integration`: 9/9 pruebas contra PostgreSQL/PostGIS real.
- `pnpm test:e2e`: 4/4 escenarios Chromium (captura y reapertura offline, revisión, cambio de
  cuenta con borrador pendiente, logout offline entre pestañas).
- `pnpm backup .local/backups/postgres-alpine` + `pnpm restore:check`: `restored-and-verified`
  con 2 parcelas, 3 inspecciones y 2 fotos.
- `pnpm check`: tipos, lint, límites de dependencia, formato, 16 pruebas unitarias y build.
- Colación: el volumen se inicializa con proveedor ICU `es-PE`
  (`datlocprovider = 'i'`, `datlocale = 'es-PE'`), porque musl no trae locales glibc y el
  reuso silencioso de un volumen Debian habría dejado índices con colación registrada distinta.
  Comparación observada: `'Ávila' < 'Zamora'` = verdadero. El volumen previo se respaldó en
  `.local/backups/pre-alpine-20261024-1209.sql` antes de re-inicializarlo.

## Ejecutado el 23 de octubre (se conserva)

- `pnpm check`, `pnpm test:integration` (9), `pnpm test:e2e` (4), `pnpm peers check` y
  reinstalación offline con lockfile congelado.
- Contrato OpenAPI y tipos regenerados. Archify: dos diagramas con sus cuatro gates.
- Inspección visual de escritorio y móvil; sin overflow horizontal a 390 px.
- Copia y restauración en base temporal; prueba de corrupción rechazada antes de restaurar.
- `pnpm audit` sin vulnerabilidades reportadas en el momento de consulta.
- Trivy de fuente/lockfile sin hallazgos altos/críticos ni secretos; no garantiza ausencia de
  código malicioso o fallos desconocidos.
- Imagen de aplicación (distroless Node 24 Debian 13) construida y analizada sin hallazgos
  altos/críticos; API y worker empaquetados arrancaron localmente.

## Pendiente, sin atribuirle un resultado verde

- S3 implementado como adaptador opcional, sin pruebas contra un proveedor real ni despliegue.
- Chunk opcional de MapLibre: 1.07 MB sin comprimir (292 KB gzip); optimización pendiente antes
  de expansión.

## Protección de `main` (24 de octubre)

- Repositorio público por decisión del usuario (`visibility: public`, `private: false`), después
  de comprobar que el historial no contiene `.env`, credenciales ni claves y de que
  `pnpm security:scan` sale 0 sin hallazgos ni secretos.
- Protección aplicada y leída por API: check requerido `guardian` con `strict: true`,
  `allow_force_pushes: false`, `allow_deletions: false`, `enforce_admins: false`. Sin revisión
  de PR obligatoria porque el trabajo es individual.

El repositorio `Dreamcoder08/chira-os` está publicado y sincronizado. El análisis de la imagen de
base de datos dejó de ser un pendiente: se cierra con la imagen propia, no con una exclusión. Los
pendientes abiertos son la validación operativa con usuarios reales, el adaptador S3 y el chunk
de MapLibre; no se debe habilitar un piloto con datos reales mientras sigan abiertos.
