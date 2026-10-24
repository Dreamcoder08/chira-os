# Piloto de campo: origen HTTPS local y alta de cuentas reales

Rama: `main`. Entrega: commits por unidad de trabajo tras verificación; push autorizado por el
usuario, sin PR. Runners: `pnpm check`, `pnpm test:integration`, `pnpm test:e2e`, `pnpm pilot:check`
(bajo demanda, con el stack de piloto levantado).

## Specs

- **S1** — El stack de piloto sirve la web compilada por HTTPS con una CA local y enruta `/api`
  al API, de modo que un teléfono en la red local tenga contexto seguro y el service worker se
  registre. La API no queda expuesta directamente a la LAN: escucha en `127.0.0.1:3001` y solo
  el proxy la alcanza. Evidencia: `docker compose --profile pilot ps`, petición HTTPS al origen
  del piloto devolviendo el `index.html`, `/api/v1/session` devolviendo 401 sin cookie, y
  `navigator.serviceWorker.controller` no nulo en Chromium contra ese origen.
- **S2** — El perfil `pilot` no altera el stack por defecto ni los escaneos de CI:
  `docker compose config --images` sigue devolviendo solo `chira-os-db:local`, y
  `pnpm security:database` sigue analizando esa única imagen. La imagen del proxy se fija por
  digest.
- **S3** — `pnpm user:create` crea una cuenta real de forma atómica: usuario de autenticación,
  credencial con contraseña hasheada y membresía con rol y asociación. Valida correo, rol y
  longitud de contraseña; se niega si el correo ya existe; imprime la contraseña generada una
  sola vez. Evidencia: prueba de integración que crea la cuenta y luego inicia sesión por el API
  real, comprobando rol y asociación en la sesión.
- **S4** — El runbook del piloto permite a un técnico entrar desde un teléfono, capturar una
  inspección sin red, sincronizarla y que un coordinador la revise. Documenta la instalación de
  la CA local en Android/iOS y lo que el piloto **no** cubre: invitaciones por correo,
  recuperación de contraseña por el propio usuario (la resuelve el operador con S6), despliegue
  en internet y cuentas de productor.
- **S5** — Nada de lo añadido deja secretos ni material de CA en el repositorio: la CA y el
  material generado viven bajo `.local/`, que está ignorado. La contraseña generada solo se
  imprime en la salida del comando, nunca se escribe en un archivo versionado.
- **S6** — `pnpm user:password` devuelve el acceso a una cuenta existente cuando el técnico
  olvida la contraseña: reemplaza la credencial por una nueva contraseña hasheada, cierra todas
  las sesiones abiertas de esa cuenta, conserva la membresía y la asociación, e imprime la
  nueva contraseña una sola vez. Se niega con un correo inexistente o con una cuenta sin
  credencial de contraseña, y solo funciona contra la base local del piloto. Evidencia: prueba
  de integración que inicia sesión antes del reinicio, reinicia, comprueba que la cookie
  anterior y la contraseña anterior dejan de servir y que la nueva entra con el mismo rol; y una
  prueba de humo del comando con sus códigos de salida.

- **S7** — El piloto tiene un protocolo de validación que convierte la demostración en evidencia:
  hipótesis, muestra mínima, qué se registra por sesión, criterios de éxito, plantilla de
  resultados y los límites que hay que declarar al reportar. Evidencia: `docs/pilot/protocol.md`
  existe, el runbook y el README lo enlazan, y no afirma tracción alguna.

## Tasks

- **T1** (S1, S2) inline — hecho. Servicio `proxy` en el perfil `pilot` de `compose.yaml`, con
  Caddyfile versionado, imagen fijada por digest y CA exportada a `.local/pki/root.crt`.
- **T2** (S1) inline — hecho. `pnpm pilot:check`: comprobación automatizada del origen del piloto
  (HTTPS, manifiesto, `sw.js`, 401 en `/api/v1/session`, service worker controlando la página).
- **T3** (S3) inline — hecho. `pnpm user:create` + validación pura con pruebas unitarias.
- **T4** (S3) inline — hecho. Prueba de integración: cuenta creada, inicio de sesión real, rol y
  asociación correctos.
- **T5** (S4, S5) inline — hecho. `docs/pilot/field-demo.md` con el runbook y el alcance explícito.
- **T6** (S6) inline — hecho. `pnpm user:password`, `resetUserPassword` y las pruebas unitaria y de
  integración.
- **T7** (S7) inline — hecho. `docs/pilot/protocol.md` con el protocolo y la plantilla.

## Log

- **L1** — Pedido del usuario, textual: «crea odd y continua con el desarrollo del proyecto , te
  autorizo todo , antes preguntame todo lo necesario».
- **L2** — Decisión del usuario sobre el siguiente incremento: «Preparar el piloto de campo
  (Recomendado)»: HTTPS en red local para que la PWA offline funcione en teléfonos, alta de
  usuarios y parcelas, y runbook de demo. Cero costo externo y cero cuentas nuevas.
- **L3** — Estado real que motiva el trabajo: la aplicación solo se usa en `localhost` con datos
  sintéticos. Un teléfono por IP de LAN en `http://` no tiene contexto seguro, así que el service
  worker no se registra y la captura offline no existe. `better-auth` tiene `disableSignUp: true`,
  de modo que las cuentas solo salen del seed. Ningún técnico, productor ni asociación ha usado
  el sistema todavía: eso es lo que el piloto debe cambiar, y no se puede afirmar lo contrario.
- **L4** — T1 verificado con evidencia real: `docker compose --profile pilot up -d proxy` levantó
  `chira-os-proxy-1` con `caddy:2.10-alpine@sha256:4c6e91c6…`; `docker compose config --images`
  sigue devolviendo solo `chira-os-db:local`, así que S2 se cumple sin tocar CI. La CA se exportó a
  `.local/pki/root.crt` (`CN=Caddy Local Authority - 2026 ECC Root`, válida hasta 2036) y la cadena
  del certificado servido verifica contra ella: `openssl s_client -CAfile .local/pki/root.crt`
  devuelve `Verification: OK` y `Verify return code: 0 (ok)`. El certificado incluye
  `IP Address:192.168.1.17` en el SAN, así que el teléfono no necesita DNS.
- **L5** — T2 encontró un defecto real antes de dar nada por bueno: la primera ejecución de
  `pnpm pilot:check` falló en «service worker controls the page» con `no controller`. La sonda
  directa mostró la causa: `SecurityError: Failed to register a ServiceWorker … An SSL certificate
error occurred when fetching the script`. Chromium no registra un service worker en un origen con
  certificado no confiable, ni siquiera con `ignoreHTTPSErrors`. Con `--ignore-certificate-errors`
  el registro funciona (`active: true`, `controller: true`). Consecuencia para el piloto: instalar la
  CA en el teléfono no es una comodidad, es requisito para el trabajo sin conexión; el runbook lo
  trata como paso obligatorio y lo explica con esa evidencia. La bandera quedó solo en el proceso de
  comprobación, documentada, no en la aplicación.
- **L6** — T3: `pnpm user:create --email verificacion@chira.test --name "Cuenta de verificación"
--role technician --association "Asociación Chira · Demo"` creó la cuenta e imprimió la contraseña
  una vez (exit 0); con datos inválidos sale con código 2 y muestra el uso. Pruebas unitarias de
  `scripts/lib/user-input.ts`: 4/4. Prueba real de extremo a extremo contra el origen del piloto:
  `POST https://192.168.1.17:8443/api/auth/sign-in/email` con esa cuenta devolvió 200 y un token,
  así que la cuenta creada por CLI entra por HTTPS. La cuenta de verificación se borró después y la
  base volvió a sus 3 usuarios sembrados.
- **L7** — T4: `tests/integration/user-create.test.ts` 3/3 contra PostgreSQL real: la cuenta creada
  inicia sesión por la API y `/api/v1/session` devuelve el rol `technician` y la asociación
  esperada; un correo repetido se rechaza sin crear una segunda fila; una asociación inexistente se
  rechaza. La prueba limpia sus propias filas.
- **L8** — T5: `docs/pilot/field-demo.md` recorre preparación, arranque, instalación de la CA en
  Android e iOS, alta de cuentas, `pnpm pilot:check`, el guion de diez pasos con las etiquetas
  reales de la interfaz, los problemas comunes y el cierre. Declara explícitamente lo que la
  demostración no prueba.
- **L9** — «Alta de usuarios y parcelas» del pedido: las parcelas ya se crean desde la interfaz
  (`ParcelForm` → `POST /api/v1/parcels`, con auditoría `parcel.created` y asignación a quien la
  crea), así que no hizo falta código nuevo; el runbook lo menciona como paso previo si la
  asociación no tiene parcelas. Lo único que faltaba era el alta de cuentas, que es T3.
- **L10** — T6, decidido dentro del alcance autorizado del piloto: al leer el código quedaba un
  callejón sin salida operativo. `pnpm user:create` se niega si el correo ya existe y no había
  ninguna otra vía, así que un técnico que olvidara la contraseña a mitad del piloto no podía
  volver a entrar. `pnpm user:password` lo resuelve sin correo saliente: transacción con
  `UPDATE auth_accounts`, `DELETE FROM auth_sessions` y la membresía intacta. Evidencia:
  `tests/unit/user-input.test.ts` 6/6; `tests/integration/user-password.test.ts` 3/3 contra
  PostgreSQL real (sesión anterior 401, contraseña anterior 401, contraseña nueva 200 con el
  mismo rol; correo inexistente y cuenta sin credencial rechazados); prueba de mutación: al
  quitar el `DELETE` de sesiones la prueba falla con «expected 0 to be greater than or equal to
  1», y al restaurarlo vuelve a 3/3. Prueba de humo del comando: alta de una cuenta temporal,
  reinicio (`closed sessions: 0`), correo inexistente → salida 1, correo inválido → salida 2 con
  el uso; la cuenta temporal y sus filas se borraron después (`SELECT count(*) FROM auth_users`
  = 3, las sembradas).
- **L11** — T7: el protocolo de `docs/pilot/protocol.md` fija tres hipótesis (captura sin conexión,
  revisión con evidencia, aislamiento entre asociaciones), una muestra mínima de tres técnicos y un
  coordinador de dos asociaciones, lo que se registra por sesión, los criterios de éxito y una
  plantilla de resultados, además de los límites a declarar (red local, sin correo saliente, datos
  sintéticos, un servidor, una sola sesión no es adopción). Es documentación: se verifica por lectura
  estructural, no por ejecución.
