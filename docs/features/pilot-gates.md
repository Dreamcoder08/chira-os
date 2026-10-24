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
  por lectura de la API de GitHub, no supuesta por la existencia de workflows. El repositorio
  pasa a público por decisión del usuario (L9), porque GitHub Free no ofrece protección en
  repositorios privados.
- **S5** — `docs/verification.md`, `README.md` y `docs/architecture/decisions.md` (ADR 006) deben
  reflejar solo evidencia observada en esta sesión; se elimina toda afirmación de pendiente que
  ya esté cerrada y se conserva la que siga abierta.
- **S6** — Cambiar la base de la imagen no puede reutilizar en silencio un volumen inicializado
  con otra libc: la base se inicializa con proveedor ICU (`es-PE`) para que el orden de textos
  sea determinista, y un volumen previo se re-inicializa o se migra con dump/restore. Evidencia:
  `pg_database.datlocprovider = 'i'`, `datlocale = 'es-PE'` y comparación `'Ávila' < 'Zamora'`
  verdadera.
- **S7** — El pipeline de CI debe salir verde en `main` con el check `guardian` requerido. Un
  defecto del propio pipeline (setup que falla en un clon nuevo) se corrige con prueba de
  regresión, y las actualizaciones de dependencias pendientes se aplican a mano respetando la
  espera de 72 h de ADR 006 y el fijado de acciones por SHA; un run de CI que no arranca por
  facturación se registra como limitación, nunca como éxito.

## Tasks

- **T1** (S1) inline — hecho (commit `075790f`). Imagen propia construida; base alpine verificada por digest
  `sha256:cd7b00a4…`, `postgis_version()` = `3.6 USE_GEOS=1 USE_PROJ=1 USE_STATS=1`,
  PostgreSQL `17.11` (musl), `docker compose config --images` = `chira-os-db:local`.
- **T2** (S2) inline — hecho. `pnpm db:migrate` y `pnpm db:seed` sobre la imagen propia;
  `pnpm test:integration` 9/9; `pnpm test:e2e` 4/4; `pnpm backup` +
  `pnpm restore:check` = `restored-and-verified` (2 parcelas, 3 inspecciones, 2 fotos).
- **T3** (S3) inline — hecho. `pnpm security:database` sale 0 con 0 hallazgos en la imagen
  propia. Sin exclusiones ni cambios de severidad.
- **T4** (S4) inline — hecho. Repositorio público (`visibility: public`, `private: false`) y
  protección de `main` leída por API: `contexts: ["guardian"]`, `strict: true`,
  `force_push: false`, `deletions: false`, `enforce_admins: false`, sin revisión de PR
  obligatoria (trabajo individual).
- **T5** (S5) inline — hecho. `README.md`, `docs/verification.md`, ADR 006 y
  `docs/implementation-log.md` actualizados con la evidencia observada.
- **T6** (S6) inline — hecho. `POSTGRES_INITDB_ARGS` con ICU `es-PE`; volumen previo respaldado
  en `.local/backups/pre-alpine-20261024-1209.sql` y re-inicializado; sin advertencia de
  colación.
- **T7** (S7) inline — hecho (commit `e1b682c`). `scripts/archify-setup.ts` fallaba en un clon
  nuevo: un clon `--no-checkout` tiene el índice vacío y `git status --porcelain` reporta cada
  archivo como borrado. Se extrajo `scripts/lib/git-checkout.ts`, se comprueba limpieza solo en
  checkouts preexistentes y se verifica después del `checkout`; prueba
  `tests/unit/git-checkout.test.ts` (2 casos) en verde. `pnpm diagrams:setup` sobre un clon
  borrado sale 0 en `25cf3708…` y `pnpm diagrams:build` pasa las cuatro compuertas.
- **T8** (S7) inline — hecho (commit `61ae989`). Actualizaciones aplicadas a mano (ver L12)
  porque los runs de Dependabot no arrancan en esta cuenta (L11). Verificación posterior al
  cambio de versiones: `pnpm check` 0 (18 pruebas), `pnpm security:deps` 0, `pnpm security:scan`
  0, `pnpm test:integration` 9/9 y `pnpm test:e2e` 4/4.

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
  `POST /repos/…/rulesets` devolvieron 403 con "Upgrade to GitHub Pro or make this repository
  public to enable this feature". No era un problema de permisos del token (scopes `repo` y
  `admin:*` presentes) sino del plan. Se elevó la decisión al usuario.
- **L7** — Riesgo detectado y cerrado en T6: el volumen local había sido inicializado por la
  imagen Debian (glibc `en_US.utf8`); al arrancar la imagen alpine, PostgreSQL avisó "database
  chira has no actual collation version, but a version was recorded". Reutilizarlo habría dejado
  índices de texto con una colación distinta a la registrada. Se respaldó con `pg_dump`
  (`.local/backups/pre-alpine-20261024-1209.sql`) y se re-inicializó el volumen con ICU `es-PE`.
- **L8** — `pnpm check` fallaba por `.atl/skill-registry.md` (artefacto local del arnés, sin
  formato Prettier). Se añadió `.atl` a `.prettierignore` y `.atl/` a `.gitignore`; `pnpm check`
  vuelve a salir 0.
- **L9** — Decisión del usuario, textual: «Hacer público el repositorio». Se cambió la
  visibilidad con `gh repo edit --visibility public --accept-visibility-change-consequences`
  (`private: false`, `visibility: public`) y después se aplicó la protección. Antes del cambio se
  verificó que el historial no contiene `.env`, credenciales ni claves: el único archivo
  coincidente es `.env.example`, y `pnpm security:scan` (fs) salió 0 sin hallazgos ni secretos.
  Se ajustaron README y CONTRIBUTING: el código es legible pero sigue sin licencia de código
  abierto.
- **L10** — Evidencia del primer run de CI en `main` (`40115531595`, commit `8438846`): falla en
  `pnpm diagrams:setup` con «Archify checkout has local changes». Reproducido sin red con un
  clon local `git clone --no-checkout`: `git status --porcelain` devuelve 101 líneas `D`
  (índice vacío). El defecto es del script, no del cambio.
- **L11** — Los runs disparados por Dependabot no arrancan: anotación «The job was not started
  because recent account payments have failed or your spending limit needs to be increased»
  (runs `40113844419` y `40113762816`, sin steps ni runner). Los runs disparados por el dueño sí
  obtienen runner, así que los 5 PR de Dependabot quedan con `guardian` en rojo permanente.
- **L12** — Actualizaciones aplicadas a mano dentro de la política: `vite` 8.3.5 (publicado
  2026-10-21T06:38Z, más de 72 h), `dexie` 4.4.7 (2026-10-19), `@aws-sdk/client-s3` 3.1154.0
  (2026-10-20). No se adopta `pnpm/action-setup` v5.0.0: es un salto mayor de acción y la
  política exige SHA revisado. El digest de distroless `cb606325…` no tiene fecha de publicación
  (imagen reproducible, `Created` = epoch), así que la espera de 72 h no es verificable: se
  registra la limitación y se reanaliza en CI.
- **L13** — La imagen de aplicación no se pudo reconstruir localmente: `docker build` responde
  «BuildKit is enabled but the buildx component is missing or broken» y el
  `--mount=type=secret` del Dockerfile exige BuildKit. `pnpm security:image` queda a cargo del
  run de CI; no se declara verificado en local.
- **L14** — Verificación de T7 y T8 en local: `pnpm check` sale 0 (typecheck, eslint +
  depcruise 50 módulos/92 dependencias, Prettier, 4 archivos con 18 pruebas, build de Vite);
  `pnpm security:deps` sale 0 («No known vulnerabilities found»); `pnpm security:scan` sale 0
  sin vulnerabilidades ni secretos; `pnpm test:integration` 9/9; `pnpm test:e2e` 4/4 (26.0 s).
  La base distroless nueva se analizó por separado
  (`gcr.io/distroless/nodejs24-debian13:nonroot@sha256:cb606325…`) con el mismo escáner y las
  mismas banderas de `scripts/security-scan.sh`: 0 hallazgos HIGH/CRITICAL. Ese análisis cubre
  el componente que cambió, no la imagen de aplicación completa, que sigue dependiendo de CI.
  Queda un aviso de Vite por el chunk opcional de MapLibre (1.074,01 kB, 291,74 kB gzip), ya
  registrado como pendiente en `docs/verification.md`.
- **L15** — Run de CI `40117001725` (commit `61ae989`): la corrección de T7 funciona
  («Archify ready at reviewed revision 25cf3708…») y pasan `pnpm check`, integración 9/9 y E2E
  4/4 (19,1 s). Falla después la compuerta `browser-check` del diagrama: Chrome aborta con
  «No usable sandbox!» porque los runners ubuntu-24.04 de GitHub aplican AppArmor y bloquean los
  namespaces de usuario sin privilegios. El checkout fijado de Archify ya expone la salida
  `ARCHIFY_CHROME_NO_SANDBOX=1` (`archify/bin/visual-check.mjs`, `chromeVisualBrowserArgs`
  antepone `--no-sandbox`); comprobado invocando la función con y sin la variable. Se activa solo
  en ese paso del workflow, con el motivo escrito al lado, porque inspecciona HTML generado por
  este repositorio en un runner efímero. La prueba real es el siguiente run.
- **L16** — S7 se cierra con evidencia: el run de CI `40118873452` (workflow `CI`, commit `d5aa103`)
  termina en `success` con el job `guardian` completo, incluidos `pnpm security:image`,
  `pnpm security:database`, la copia de seguridad con `pnpm restore:check` y la validación de
  diagramas. La compuerta del diagrama ya no necesita nada más, y el análisis de la imagen completa
  de la aplicación, que en local no se puede construir por falta de buildx, pasó donde corresponde:
  en CI. El check requerido `guardian` queda verde en `main`.
