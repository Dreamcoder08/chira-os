# CHIRA OS · Guardian

Inteligencia para cuidar el valle del Chira. Base funcional para registrar parcelas,
capturar inspecciones sin conexión y coordinar su revisión agronómica.

**Estado: desarrollo local con datos sintéticos.** No está desplegado ni aprobado para
producción. Una fotografía no confirma Fusarium R4T ni otra enfermedad.

## Arranque local

Requisitos: Git, Node **24.19+ de la rama 24**, pnpm **11.25.0**, Docker con Compose.
Linux/macOS para los scripts de copias y análisis con Bash y tar. No se contratan servicios.

```bash
git clone https://github.com/Dreamcoder08/chira-os.git
cd chira-os
pnpm install --frozen-lockfile
pnpm setup:local
docker compose up -d --wait db
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Abre **http://localhost:5173**. Usa `localhost`, no una IP de red: el origen forma parte
del control de sesiones. El backend de desarrollo escucha solo en `127.0.0.1:3001`.

`docker compose up` construye la base de datos desde `Dockerfile.db`: una PostGIS 17/3.6 alpine
fijada por digest, sin `gosu` y con los paquetes del sistema al día. La primera vez tarda un poco
más porque compila la imagen. La base se inicializa con colación ICU `es-PE`; si vienes de un
volumen creado por la imagen Debian anterior, no lo reutilices: respáldalo con
`pnpm backup .local/backups/antes-de-alpine` y recrea el volumen con
`docker compose down db && docker volume rm chira-os_postgres && docker compose up -d --wait db`.

El seed crea `tecnico@chira.test`, `coordinador@chira.test` y un usuario de otra asociación.
La contraseña aleatoria se guarda únicamente en **`.local/demo-credentials.json`**, con
permisos restringidos. Ábrelo localmente; no lo pegues en incidencias, capturas ni commits.
El seed es idempotente y está bloqueado fuera de bases locales de desarrollo.

En otra terminal, ejecuta `pnpm worker` para procesar seguimientos internos. El worker
no manda correo ni mensajes externos. No necesita las credenciales de autenticación.

## Fotografías

Una foto se reduce en el teléfono antes de guardarse: lado mayor de 2048 px, WebP de calidad 0.92,
sin ampliar nunca una imagen más chica. La cámara de un teléfono de 48 MP escribe archivos de unos
15 MB que la API rechazaría por límite de píxeles; el envío queda en unos cientos de kilobytes y el
servidor sigue guardando WebP de 2048 px. El detalle y las mediciones están en
`docs/verification.md`.

## Interfaz

Parcelas y revisión priorizan las listas, con desplazamiento continuo y navegación
etiquetada. Un encabezado compacto identifica la tarea y conserva la fecha y el aviso
de datos sintéticos en escritorio y móvil. Busca localmente por parcela, productor, cultivo u observación; en
inspecciones también puedes filtrar por estado y limpiar los filtros. Los contadores
separan los envíos en este dispositivo, los registros por revisar y los revisados.
**Con conexión no significa sincronizado**: los pendientes locales siguen visibles.
Las estadísticas secundarias se consultan en **Resumen del equipo**, desplegable con
teclado; el estado de pendientes y las acciones de sincronización permanecen fuera
del desplegable.

El mapa se carga solo al abrir **Mapa** o **Ver parcela en el mapa**. La cartografía
es local —grilla de un kilómetro, parcelas y escala—, sin tiles ni pedidos a terceros.
La aclaración de cartografía local permanece visible en escritorio y móvil, sin tapar
la escala. Los controles del mapa tienen un área de 44 × 44 px en el teléfono y el
encuadre reserva espacio para que no tapen las etiquetas. El estado accesible de carga
termina al completar la carga y el encuadre inicial. El panel de trabajo se oculta en
el mapa y vuelve al regresar a las listas.
En el teléfono se conserva la barra inferior y los formularios en hojas con foco
contenido y cierre mediante Escape. Las acciones de registro, revisión y exportación
mantienen sus permisos y flujos existentes.

## Piloto de campo en teléfonos

Para probar el flujo offline en un teléfono real hay un perfil `pilot` que sirve el sitio
compilado por HTTPS en la red local, con una autoridad certificadora propia, y deja la API
escuchando solo en `127.0.0.1:3001`:

```bash
pnpm build
APP_ORIGIN=https://<IP-LOCAL>:8443 pnpm start
PILOT_HOST=<IP-LOCAL> docker compose --profile pilot up -d proxy
PILOT_HOST=<IP-LOCAL> pnpm pilot:check
```

Las cuentas del piloto se crean desde la terminal con `pnpm user:create`; no hay autorregistro, y
`pnpm user:password` reemplaza la contraseña de una cuenta existente cuando alguien la olvida.
El teléfono necesita el certificado de la autoridad local instalado, porque sin él el navegador
no registra el service worker y no existe captura sin conexión. El procedimiento completo, el
guion de la demostración y lo que el piloto **no** cubre están en
[`docs/pilot/field-demo.md`](docs/pilot/field-demo.md); el protocolo para convertir la sesión en
evidencia medible está en [`docs/pilot/protocol.md`](docs/pilot/protocol.md).

## Probar el flujo

1. Entra como técnico y pulsa **Preparar trabajo offline** para descargar tus parcelas.
2. Desconecta la red, crea una inspección, completa bioseguridad y añade una fotografía.
3. Guarda en el dispositivo y vuelve a abrir la aplicación. El borrador seguirá visible.
4. Recupera conexión y sincroniza. Los envíos se reintentan sin duplicar registros.
5. Sal y entra como coordinador para revisar, señalar seguimiento y exportar datos.

Los conflictos conservan la copia local y requieren una decisión explícita. Cerrar sesión
elimina la información local; si hay pendientes, pide confirmar su descarte. Si sales offline,
una marca persistente impide reutilizar la sesión y solicita su revocación al reconectar.
La revocación remota no puede borrar un teléfono que permanece desconectado.

## Arquitectura

Monolito modular hexagonal: dominio y casos de uso independientes de infraestructura,
adaptadores PostgreSQL/archivos/S3 y composición en API/worker. Contratos HTTP compartidos
y cliente generado; la interfaz no importa código de servidor.

| Unidad               | Responsabilidad                                              |
| -------------------- | ------------------------------------------------------------ |
| `apps/web`           | React/Vite PWA, formularios, revisión e IndexedDB            |
| `apps/api`           | Fastify, sesión, autorización, validación y HTTP             |
| `apps/worker`        | Outbox y pg-boss con rol SQL propio                          |
| `packages/domain`    | Reglas agrícolas, casos de uso y puertos                     |
| `packages/data`      | SQL/RLS, Drizzle de identidad, persistencia y almacenamiento |
| `packages/contracts` | Esquemas de entrada/salida y tipos OpenAPI generados         |

React Query administra las lecturas; las consultas a IndexedDB usan `networkMode: always`.
MapLibre se carga al solicitar el mapa. La vista muestra puntos, sin cartografía o servicios
externos. Los datos de inspecciones se presentan como texto, no HTML.

Lee [las decisiones de arquitectura](docs/architecture/decisions.md), el [diseño de seguridad](docs/security.md)
y la [revisión independiente y sus correcciones](docs/security-review.md).

## Comprobaciones

```bash
pnpm check
pnpm test:integration
pnpm test:e2e
pnpm contracts
pnpm security:deps
pnpm run sbom
pnpm security:scan
```

Para comprobar solo la interfaz sin base de datos, credenciales ni archivos de entorno:

```bash
pnpm exec playwright test --config playwright.workspace.config.ts
```

Esta suite abre Vite en `127.0.0.1:5187`, intercepta la API con datos sintéticos y usa
almacenamiento efímero por caso. Comprueba listas, filtros, navegación, captura local
y entradas a formularios/revisión en escritorio y móvil; no prueba autorización del
servidor ni sustituye la suite integrada.

Las pruebas de integración y navegador de la configuración predeterminada usan los usuarios sintéticos y revocan sus sesiones.
Ejecuta esas suites **secuencialmente**, sin un usuario trabajando en la demo. No las ejecutes
contra bases con información real. Playwright requiere `pnpm exec playwright install chromium`;
algunas distribuciones también necesitan `pnpm exec playwright install --with-deps chromium`.

`pnpm check` comprueba tipos, lint, límites arquitectónicos, formato, reglas y build. CI añade
PostGIS real, navegador, contratos regenerados, Archify, SBOM, vulnerabilidades, secretos,
imagen y restauración. Las acciones están fijadas por SHA; no hay merge ni despliegue automático.

## Diagramas con Archify

Los diagramas son explicaciones del diseño, no una auditoría ni mediciones de infraestructura.
Sus fuentes editables son [guardian.json](docs/architecture/guardian.json) y [sync.json](docs/architecture/sync.json).
Descarga los HTML para abrirlos localmente: [arquitectura](docs/architecture/generated/guardian.html)
y [sincronización](docs/architecture/generated/sync.html).

```bash
pnpm diagrams:setup
pnpm exec playwright install chromium
export ARCHIFY_CHROME="$(node --input-type=module -e "import { chromium } from '@playwright/test'; process.stdout.write(chromium.executablePath())")"
pnpm diagrams:build
```

La preparación obtiene una revisión fija de [Archify](https://github.com/tt-a1i/archify), sin
instalador global ni actualizaciones automáticas. `finalize` valida, renderiza y verifica
en navegador. Los recibos de nuevas ejecuciones quedan en `.local/diagram-evidence/`.

## Aplicación empaquetada

Después de migrar y sembrar, detén `pnpm dev` para liberar el puerto:

```bash
docker compose -f compose.yaml -f compose.app.yaml up -d --build
docker compose -f compose.yaml -f compose.app.yaml ps
```

La API y el worker usan un runtime **distroless no root**, filesystem de solo lectura y
capacidades eliminadas. El Compose adicional sirve una demo HTTP local; no es un despliegue
de producción. En entornos con CA corporativa, proporciona `CODEX_PROXY_CERT` a Compose o
usa `docker build --secret id=proxy_ca,src=/ruta/ca.pem -t chira-os:local .`. Nunca desactives TLS.

La API empaquetada guarda fotos en el volumen `chira-os_photos`; el modo `pnpm dev` usa
`.local/photos`. **No alternes esos modos con evidencia que quieras conservar sin migrar
también sus archivos**: comparten la base local, pero no el directorio de fotografías.

```bash
pnpm security:image
pnpm security:database
```

El análisis de imagen también incluye bibliotecas del sistema y paquetes presentes en ella;
no equivale a `pnpm audit`.

**Estado del análisis de base de datos:** ninguna imagen oficial de PostGIS llegaba a cero
hallazgos HIGH/CRITICAL, así que el proyecto construye la suya desde `Dockerfile.db` y
`pnpm security:database` la analiza sin exclusiones. Resultado observado: 0 hallazgos. Las
pruebas de integración, E2E y copia/restauración se ejecutaron sobre esa imagen. El pendiente
real hoy es la validación operativa con usuarios: el repositorio ya es público y `main` exige el
check `guardian`.

## Copias y recuperación

En una ventana de mantenimiento, detén API y worker para que base y archivos no cambien.
Mantén PostgreSQL encendido. Copias y credenciales son confidenciales.

```bash
# Modo pnpm dev: después de detener sus procesos
pnpm backup .local/backups/piloto-01
pnpm restore:check .local/backups/piloto-01

# Modo Compose empaquetado: detener ambos servicios y respaldar su volumen
docker compose -f compose.yaml -f compose.app.yaml stop api worker
BACKUP_STORAGE_MODE=compose pnpm backup .local/backups/empaquetado-01
pnpm restore:check .local/backups/empaquetado-01
```

La copia contiene dump PostgreSQL, fotografías y manifiesto SHA-256. La verificación rechaza
corrupción, restaura en una base temporal, decodifica las fotografías y elimina los recursos
temporales. Solo admite copias locales de confianza; el manifiesto detecta corrupción, no
autentica a quien entrega un archivo. Define cifrado externo y retención antes de datos reales.

## Desarrollo con ODD

[AGENTS.md](AGENTS.md) adapta **Organic Driven Development** de
[Gentleman AI](https://github.com/Gentleman-Programming/gentle-ai): explorar, conservar el
contexto cuando el trabajo lo necesita, implementar y verificar proporcionalmente. No exige
instalar Gentle AI globalmente ni otorga acceso a secretos a herramientas o agentes.

Fuera de esta entrega: diagnóstico automático, agricultores con cuenta propia, Water,
Trade, satélites, sensores, notificaciones externas y despliegue. La revisión previa al piloto
debe acordar responsable operativo, dispositivos, identidad reforzada, recuperación,
protección de datos personales y proveedor de infraestructura.

Repositorio público. No se concede una licencia de código abierto en esta etapa: el código se
puede leer, pero no reutilizar ni redistribuir sin permiso.
