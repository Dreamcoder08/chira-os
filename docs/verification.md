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

## Pipeline de CI y dependencias (24 de octubre)

- El primer run de CI en `main` (`40115531595`, commit `8438846`) falló en `pnpm diagrams:setup`.
  Causa reproducida sin red: un clon `git clone --no-checkout` deja el índice vacío y
  `git status --porcelain` informa cada archivo como borrado. El script confundía eso con un
  checkout sucio.
- Corrección (commit `e1b682c`): la comprobación de limpieza solo aplica a checkouts ya
  poblados y se repite después de fijar la revisión revisada; la lógica vive en
  `scripts/lib/git-checkout.ts` con dos pruebas unitarias. `pnpm diagrams:setup` sobre un clon
  borrado sale 0 en `25cf3708…` y `pnpm diagrams:build` pasa las cuatro compuertas.
- Actualizaciones aplicadas a mano, dentro de la espera de 72 h de ADR 006: `vite` 8.3.5,
  `dexie` 4.4.7, `@aws-sdk/client-s3` 3.1154.0. No se adoptó `pnpm/action-setup` v5.0.0 porque
  es un salto mayor de acción y la política exige revisar el SHA.
- Los runs disparados por Dependabot no arrancan en esta cuenta: la anotación dice «The job was
  not started because recent account payments have failed or your spending limit needs to be
  increased». Queda como limitación de facturación, no como fallo del código.
- Verificación posterior: `pnpm check` sale 0 (18 pruebas), `pnpm security:deps` sale 0
  («No known vulnerabilities found»), `pnpm security:scan` sale 0 sin vulnerabilidades ni
  secretos, `pnpm test:integration` 9/9, `pnpm test:e2e` 4/4 (26,0 s).
- Base distroless nueva analizada por separado
  (`gcr.io/distroless/nodejs24-debian13:nonroot@sha256:cb606325…`) con el escáner y las banderas
  de `scripts/security-scan.sh`: 0 hallazgos HIGH/CRITICAL. Cubre el componente que cambió, no
  la imagen de aplicación completa.
- La imagen de aplicación no se pudo reconstruir en local: el Dockerfile usa
  `--mount=type=secret` y este Docker no tiene el componente buildx. `pnpm security:image` sobre
  la imagen completa queda a cargo de CI y no se declara verificado aquí.

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

## Sistema de diseño e interfaz de consola (24 de octubre)

- Tokens, tipografía e iconos: `Inter Variable` self-hosted (subset latino,
  48 256 bytes) porque el piloto corre en una LAN sin internet, y 20 iconos SVG
  propios. Sin dependencias nuevas de runtime más allá de la fuente.
- Escritorio reconstruido como consola con el mapa al centro: rail de 64 px,
  píldoras de contexto y estado, tarjeta de parcela translúcida, dock colapsable
  con métricas y pestañas, y hojas laterales de 480 px para los formularios.
- Teléfono con shell de app: barra inferior de tres destinos, banda de
  sincronización permanente, hojas que suben desde abajo con el guardado pegado
  al pulgar y la pestaña Mapa a pantalla completa.
- Cartografía local, sin tiles ni red: grilla de 1 km con líneas mayores cada
  cinco, campo visual por parcela, etiquetas con halo y barra de escala calculada
  en metros por píxel. Nada sale del origen de la aplicación.
- Defecto real encontrado en el camino: MapLibre 6 carga su parser en un worker
  que Vite no emite por sí solo (`Worker failed to load`), así que ninguna fuente
  se parseaba y el mapa quedaba en blanco. Se resolvió fijando la URL del worker.
- Accesibilidad: las hojas atrapan el foco, cierran con Escape y devuelven el
  foco; 36 pares de contraste medidos en navegador a 1440×900 y 390×844, todos
  ≥ 4,5:1 (peor caso 5,08:1; el chip «Demostración» pasó de 4,49:1 a `ink-700`).
  La medición se hizo sobre píxeles reales porque el texto vive sobre el mapa, sobre
  paneles con `backdrop-filter` y sobre el degradado del login, donde
  `getComputedStyle` no es el fondo pintado y axe reporta `incomplete`.
- Comprobado: `pnpm check` sale 0 (24 tests unitarios), `pnpm test:e2e` sale 0 con
  8/8 en los proyectos `desktop` y `mobile` (41,3 s), `pnpm test:integration` sale 0
  con 17 tests. Capturas revisadas en 1440×900, 834×1112 y 390×844; los únicos
  errores de consola son tres 401 de la sonda de sesión previa al login.

## Fotografías de campo (24 de octubre)

- Defecto encontrado en el camino de la evidencia, no en el del tamaño del bundle: el formulario
  validaba tamaño (8 MB) y MIME, pero no píxeles. Un teléfono de 48 MP escribe un JPEG de
  8064×6048; la API construye `sharp` con `limitInputPixels: 20_000_000`, así que ese archivo se
  rechaza como `INVALID_IMAGE` y el borrador pasa a `blocked`. Reproducido sin navegador:
  `sharp(8064×6048, { limitInputPixels: 20_000_000 }).metadata()` responde
  `Input image exceeds pixel limit`.
- Segundo defecto, encontrado al medir el primero: una foto real de 48 MP pesa **15,19 MB**, así
  que el chequeo de 8 MB del cliente rechazaba el archivo antes de que existiera la oportunidad de
  reducirlo. El límite de 8 MB es del envío, no de la cámara.
- Corrección: `preparePhoto` decodifica con orientación EXIF aplicada, reduce por `fitWithin` a un
  lado mayor de 2048 px sin ampliar nunca, y codifica WebP q0.92 con respaldo JPEG. Una imagen que
  ya cabe se guarda intacta. La guarda de entrada es de 40 MB y solo evita decodificaciones
  absurdas.
- Efecto medido sobre imágenes sintéticas con ruido realista: 15,19 MB → 193 KB en el dispositivo
  y 44 KB tras el reencode del servidor; 10,18 MB → 2 MB, que es el peor caso de ruido puro. La
  evidencia servida sigue siendo WebP de 2048 px: el cliente agrega una generación de compresión
  (q0.92) antes de la del servidor (q82), que no se oculta.
- Comprobado: `pnpm check` sale 0 (34 tests unitarios), `pnpm test:e2e` sale 0 con 10/10 en
  `desktop` y `mobile` (57,0 s), `pnpm test:integration` sale 0 con 17 tests. La prueba E2E sube
  48 MP de píxeles y 12 MP de ruido de más de 8 MB en el mismo borrador, lee los blobs desde
  IndexedDB y afirma 2048 px, WebP y por debajo del límite; con `preparePhoto` devolviendo el
  archivo intacto falla en los dos proyectos.
- Sin verificación independiente: el agente `gentle-ai-verify` falla con
  `Upstream request failed: Go requires a credential` y `general` devuelve
  `Permission denied: subagent`. No se le atribuye un PASS que no ocurrió.

## Pantalla de acceso (24 de octubre)

- El epígrafe «NACIDO EN EL VALLE DEL CHIRA» se apoyaba en el punto más claro
  del degradado del panel con `ink-500`: **1,99:1 medido** (1,08:1 calculado
  contra ese extremo). Pasó a `sand-50` al 76 % y mide **6,00:1**. Es un hueco
  de la medición anterior: el arnés solo revisaba los elementos de su lista y
  el epígrafe nunca estuvo en ella.
- El formulario respondía a cualquier fallo con la misma frase. Un límite de
  intentos (`429`, 20 por minuto y por dirección) le decía al técnico que
  revisara una contraseña que era correcta. Ahora `429` pide esperar un minuto,
  `401` nombra las credenciales, `5xx` culpa al servidor y solo lo inclasificable
  conserva el aviso de sesión previa. Cubierto por `tests/unit/login-message.test.ts`.
- Defecto previo en la prueba E2E, no en el producto: la evidencia de borrador se
  dibuja con `loading="lazy"` y la base local acumula inspecciones entre corridas,
  así que el borrador nuevo quedaba bajo el pliegue y la imagen nunca se decodificaba
  (`naturalWidth` en 0 durante 10 s). Se reprodujo sobre el árbol sin mis cambios
  (`git stash`, 3 de 3 corridas en escritorio) y se corrigió desplazando la tarjeta
  a la vista antes de afirmar nada. No se relajó ninguna aserción.
- Comprobado: `pnpm check` 0 (39 tests unitarios), `pnpm test:e2e` 0 con 10/10 en
  `desktop` y `mobile` (49,6 s), `pnpm test:integration` 0 con 17 tests.

## Dirección de acceso y origen (25 de octubre)

El login respondía «No se pudo iniciar sesión. Comprueba la conexión» a un usuario
con la contraseña correcta. La causa no era la contraseña: `apps/api/src/app.ts`
comparaba el header `Origin` contra `APP_ORIGIN` byte por byte, así que abrir
`http://127.0.0.1:5173` en lugar de `http://localhost:5173` recibía 403 en menos de
un milisegundo, antes de tocar credenciales. better-auth rechazaba igual por su
`trustedOrigins`.

Ahora `apps/api/src/origin.ts` es el único lugar que decide qué orígenes valen: si
`APP_ORIGIN` es loopback, sus tres formas (`localhost`, `127.0.0.1`, `[::1]`) son el
mismo equipo; cualquier otro host o puerto sigue rechazado.

Medido contra el servidor real, con la misma contraseña válida:

| Origin enviado          | Resultado |
| ----------------------- | --------- |
| `http://localhost:5173` | 200       |
| `http://127.0.0.1:5173` | 200       |
| `http://[::1]:5173`     | 200       |
| `http://localhost:9999` | 403       |
| `https://evil.example`  | 403       |
| sin header `Origin`     | 403       |

El formulario también distingue el 403: «Esta dirección no está autorizada para
iniciar sesión. Abre la aplicación en la dirección que te dieron.» Antes caía en el
texto genérico de sesión previa.

Comprobado: `pnpm check` sale 0 (40 tests unitarios), `pnpm test:e2e` sale 0 con
10/10 (46,3 s), `pnpm test:integration` sale 0 con 19 tests (2 nuevos de origen).

## Consola: composición y jerarquía (25 de octubre)

- El mapa dejó de ser un fondo. La cabecera pasó de `clamp(28px, 2.8vw, 40px)` a
  `clamp(24px, 2.1vw, 33px)` con una columna de 430 px (eran 560) y el dock de
  `min(50vh, 450px)` a `min(44vh, 400px)`. La banda visible del mapa creció unos
  90 px sin quitarle nada a la lectura.
- Los controles de zoom y el botón de ubicación estaban anclados abajo a la
  izquierda con `bottom: calc(min(50vh, 450px) + 34px)`, es decir dentro de la
  columna del título: se superponían con la fecha y con la nota de demostración.
  Ahora viven abajo a la derecha, y la barra de escala queda abajo a la izquierda,
  que es la convención de cualquier mapa.
- Una sola variable `--dock-height` gobierna el dock, los controles y la escala; el
  estado plegado la reescribe a 42 px. Antes tres reglas distintas repetían el mismo
  `calc()` y podían desincronizarse sin que nadie lo notara.
- El breadcrumb decía `Guardian`, el nombre interno del producto. Ahora dice la
  vista actual (`Revisión` o `Parcelas`).
- La identidad del topbar se cortaba en `Coordinadora de demos…` con 160 px de
  ancho; ahora tiene 190 px y el nombre completo queda en el atributo `title`.
- Las tarjetas de inspección: la nota se limita a dos líneas con
  `-webkit-line-clamp` y `overflow-wrap: anywhere`, así una nota larga no empuja la
  tarjeta fuera de su columna. El `white-space: pre-wrap` solo no alcanzaba.
- El punto lima junto a `00` envíos pendientes se eliminó: un punto significa «mirá
  acá» y no había nada que mirar.
- Medido en 1920×1014 después del cambio: cabecera 64,60–494,300; controles
  1866,454–1902,580; escala 82,565–168,580; dock 80,598–1904,998 (400 px de alto).
  Cero superposiciones. La grilla de inspecciones ocupa 99–1885 con cinco columnas
  de 348 px, y la línea de metadatos mide `scrollWidth === clientWidth`.
- Comprobado: `pnpm check` sale 0 (40 tests unitarios), `pnpm test:e2e` sale 0 con
  10/10 en `desktop` y `mobile` (55,5 s), `pnpm test:integration` sale 0 con 19 tests.

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

## Piloto de campo (24 de octubre)

- El perfil `pilot` de `compose.yaml` añade un proxy Caddy fijado por digest
  (`caddy:2.10-alpine@sha256:4c6e91c6…`) que sirve `apps/web/dist` por HTTPS y enruta `/api` y
  `/health` a la API, que sigue escuchando solo en `127.0.0.1:3001`. El stack por defecto no cambia:
  `docker compose config --images` sigue devolviendo solo `chira-os-db:local`.
- `PILOT_HOST=192.168.1.17 pnpm pilot:check` sale 0 con las siete comprobaciones en verde: emisor
  `CN=Caddy Local Authority - ECC Intermediate`, `/` 200 `text/html`, `/manifest.webmanifest` 200 con
  `start_url=/`, `/sw.js` 200 con `cache-control=no-cache`, `/api/v1/session` 401 sin cookie,
  contexto seguro en Chromium y service worker controlando la página.
- La cadena del certificado servido verifica contra la CA exportada a `.local/pki/root.crt`:
  `openssl s_client -CAfile` devuelve `Verification: OK` y `Verify return code: 0 (ok)`; el
  certificado incluye `IP Address:192.168.1.17` en el SAN.
- Hallazgo que condiciona el runbook: sin la CA instalada, Chromium no registra el service worker
  (`SecurityError … An SSL certificate error occurred when fetching the script`), así que la captura
  sin conexión no existe. Instalar la CA es requisito, no comodidad.
- `pnpm user:create` creó una cuenta real y esa cuenta inició sesión por
  `https://192.168.1.17:8443/api/auth/sign-in/email` con 200; la cuenta de verificación se borró
  después. Pruebas: unitarias 4/4, integración 3/3 contra PostgreSQL real (rol y asociación
  correctos, correo duplicado y asociación inexistente rechazados), `pnpm check` 0 con 22 pruebas,
  E2E 4/4.
- `pnpm user:password` devuelve el acceso a una cuenta existente sin correo saliente. Evidencia:
  unitarias 6/6 e integración 3/3 contra PostgreSQL real, donde la sesión anterior queda en 401, la
  contraseña anterior en 401 y la nueva entra en 200 con el mismo rol; un correo inexistente y una
  cuenta sin credencial se rechazan. Prueba de mutación: sin el `DELETE` de sesiones la prueba falla
  con «expected 0 to be greater than or equal to 1» y al restaurarlo vuelve a 3/3. Prueba de humo del
  comando: alta temporal, reinicio con `closed sessions: 0`, correo inexistente con salida 1 y correo
  inválido con salida 2 y el uso; las filas temporales se borraron (`auth_users` = 3, las sembradas).
- El run de CI `40118873452` del commit `d5aa103` termina en `success` con el job `guardian`
  completo, incluidas `pnpm security:image`, `pnpm security:database` y la copia de seguridad con
  `pnpm restore:check`.
- El recorrido crítico del piloto se prueba también a ancho de teléfono: `playwright.config.ts`
  declara los proyectos `desktop` y `mobile` (Pixel 7, entrada táctil) sobre los mismos escenarios.
  `pnpm test:e2e` sale 0 con 8/8 (4 escenarios × 2 proyectos) en 20,3 s.
- Límite de acceso explícito: el valor por defecto de `better-auth` (3 intentos cada 10 s por
  dirección) rechazaba al cuarto técnico que entra a la vez detrás de una misma dirección; el
  sondeo lo reprodujo (`200,200,200,429,429,…`) y la prueba de integración falló con
  «attempt 4: expected 429 to be 401». La regla quedó en 20 por minuto, con la variable
  `AUTH_SIGN_IN_MAX` aplicable solo fuera de producción y usada por el servidor de E2E.
  Evidencia: integración 4 archivos/17 pruebas, con 10 accesos seguidos en 401 y el 429 al superar
  el límite; `pnpm check` 0 con 24 pruebas.
- El borrador offline muestra sus fotografías antes de sincronizar y después de recargar sin
  conexión: la prueba E2E espera `naturalWidth > 0` en la miniatura y falló antes del arreglo
  («Timeout 10000ms exceeded while waiting on the predicate»).

El repositorio `Dreamcoder08/chira-os` está publicado y sincronizado. El análisis de la imagen de
base de datos dejó de ser un pendiente: se cierra con la imagen propia, no con una exclusión. Los
pendientes abiertos son la validación operativa con usuarios reales (el piloto está preparado y
documentado, pero ningún técnico ni asociación lo ha usado todavía), el adaptador S3 y el chunk de
MapLibre. El piloto de campo se hace con datos sintéticos: no se deben cargar datos reales de
productores sin un acuerdo de tratamiento.
