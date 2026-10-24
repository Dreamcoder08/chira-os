# Cierre de gates del piloto

Rama: `main`. Entrega: commits por unidad de trabajo sobre `main` tras verificación; sin push
ni PR sin decisión humana. Runner: `pnpm check`, `pnpm test:integration`, `pnpm test:e2e`,
`pnpm security:database`.

## Specs

- **S1** — La base de datos del proyecto es una imagen propia (`chira-os-db:local`) construida
  desde `Dockerfile.db`, derivada de `postgis/postgis:17-3.6-alpine` fijada por digest, y
  `compose.yaml` la construye y la usa. Evidencia observable: `docker image inspect` de la base
  con su `RepoDigests`, `docker compose config --images` devolviendo `chira-os-db:local` y
  `select postgis_version()` dentro del contenedor. No se acepta inferir el resultado desde la
  etiqueta.
- **S2** — La suite de integración existente debe ejecutarse sobre la imagen propia y pasar
  (`pnpm db:migrate`, `pnpm db:seed`, `pnpm test:integration`). Además, E2E y backup/restore
  deben pasar sobre el mismo stack.
- **S3** — `pnpm security:database` debe analizar la imagen propia sin hallazgos HIGH/CRITICAL y
  sin exclusiones de CVE. Un fallo de red o del escáner queda registrado como pendiente, nunca
  como resultado verde.
- **S4** — `main` debe tener protección con los checks de CI requeridos, configurada y comprobada
  por lectura de la API de GitHub, no supuesta por la existencia de workflows.
- **S5** — `docs/verification.md`, `README.md` y `docs/architecture/decisions.md` (ADR 006) deben
  reflejar solo evidencia observada en esta sesión; se elimina toda afirmación de pendiente que
  ya esté cerrada y se conserva la que siga abierta.
- **S6** — Cambiar la base de la imagen no puede reutilizar en silencio un volumen inicializado
  con otra libc: la base se inicializa con proveedor ICU (`es-PE`) para que el orden de textos
  sea determinista, y un volumen previo se re-inicializa o se migra con dump/restore. Evidencia:
  `pg_database.datlocprovider = 'i'`, `datlocale = 'es-PE'` y comparación `'Ávila' < 'Zamora'`
  verdadera.

## Tasks

- **T1** (S1) inline — hecho (commit `075790f`). Imagen propia construida; base alpine verificada por digest
  `sha256:cd7b00a4…`, `postgis_version()` = `3.6 USE_GEOS=1 USE_PROJ=1 USE_STATS=1`,
  PostgreSQL `17.11` (musl), `docker compose config --images` = `chira-os-db:local`.
- **T2** (S2) inline — hecho. `pnpm db:migrate` y `pnpm db:seed` sobre la imagen propia;
  `pnpm test:integration` 9/9; `pnpm test:e2e` 4/4; `pnpm backup` +
  `pnpm restore:check` = `restored-and-verified` (2 parcelas, 3 inspecciones, 2 fotos).
- **T3** (S3) inline — hecho. `pnpm security:database` sale 0 con 0 hallazgos en la imagen
  propia. Sin exclusiones ni cambios de severidad.
- **T4** (S4) inline — bloqueado por plan: GitHub Free no permite protección de rama ni rulesets
  en repositorios privados (HTTP 403, "Upgrade to GitHub Pro or make this repository public").
  Requiere decisión humana; ver L6.
- **T5** (S5) inline — hecho. `README.md`, `docs/verification.md`, ADR 006 y
  `docs/implementation-log.md` actualizados con la evidencia observada.
- **T6** (S6) inline — hecho. `POSTGRES_INITDB_ARGS` con ICU `es-PE`; volumen previo respaldado
  en `.local/backups/pre-alpine-20261024-1209.sql` y re-inicializado; sin advertencia de
  colación.

## Log

- **L1** — Pedido del usuario, textual: «crea odd y continua con el desarrollo del proyecto ,
  te autorizo todo , antes preguntame todo lo necesario».
- **L2** — Decisión del usuario sobre el arranque: «Cerrar gates del piloto (Recomendado)»:
  descargar y escanear PostGIS 17/3.6, re-ejecutar integración/E2E sobre esa imagen y configurar
  protección de `main` con CI requerido.
- **L3** — Estado real verificado antes de escribir: el repositorio privado ya existe en GitHub
  (`main` sincronizado con local, 5 ramas de Dependabot abiertas) y la red responde (API de GitHub
  con cuota disponible). El contenedor `chira-os-db-1` ya ejecuta el digest fijado.
- **L4** — Decisión del usuario ante el fallo del gate, textual: «Imagen propia endurecida
  (Recomendado)». Alcance: `Dockerfile.db` derivado de `17-3.6-alpine`, reconstruir gosu con Go
  actualizado o sustituirlo por `su-exec`, `apk upgrade` para brotli, fijado por digest, objetivo
  0 HIGH/CRITICAL sin exclusiones, y revalidar migraciones, RLS, integración y backup sobre la
  imagen construida.
- **L5** — Evidencia que motivó L4: ninguna variante oficial llega a cero. Debian
  `17-3.6@sha256:5cf98659…` → 107 HIGH/CRITICAL (102/5) más 26 en `gosu`; alpine
  `17-3.6@sha256:cd7b00a4…` → 1 HIGH (`brotli-libs` CVE-2026-111497, corregido en `1.2.1-r0`)
  más los mismos 26 de `gosu` (25 HIGH, 1 CRITICAL). Reconstruir `gosu` 1.9 falla: su
  `setup-user.go` importa `github.com/opencontainers/runc/libcontainer`, que no está en el
  módulo. Se optó por eliminarlo y usar `su-exec`.
- **L6** — Protección de `main` (S4): `PUT /branches/main/protection` y
  `POST /repos/…/rulesets` devuelven 403 con "Upgrade to GitHub Pro or make this repository
  public to enable this feature". No es un problema de permisos del token (scopes `repo` y
  `admin:*` presentes) sino del plan. Queda como decisión abierta: plan Pro, repositorio público
  o aceptar CI no bloqueante.
- **L7** — Riesgo detectado y cerrado en T6: el volumen local había sido inicializado por la
  imagen Debian (glibc `en_US.utf8`); al arrancar la imagen alpine, PostgreSQL avisó "database
  chira has no actual collation version, but a version was recorded". Reutilizarlo habría dejado
  índices de texto con una colación distinta a la registrada. Se respaldó con `pg_dump`
  (`.local/backups/pre-alpine-20261024-1209.sql`) y se re-inicializó el volumen con ICU `es-PE`.
- **L8** — `pnpm check` fallaba por `.atl/skill-registry.md` (artefacto local del arnés, sin
  formato Prettier). Se añadió `.atl` a `.prettierignore` y `.atl/` a `.gitignore`; `pnpm check`
  vuelve a salir 0.
