# Piloto de campo: guion de demostración

Este documento describe cómo llevar CHIRA OS a un teléfono real en la misma red
local y qué demuestra exactamente esa demostración. No es un despliegue de
producción: el objetivo es que un técnico agrícola recorra el ciclo completo
(entrar, capturar sin señal, sincronizar) y que un coordinador revise lo
capturado.

## Alcance honesto

Lo que la demostración prueba:

- Un teléfono entra por HTTPS, con su contexto seguro, y el service worker toma
  el control de la página.
- Sin señal, el técnico captura una inspección con fotografías y observaciones,
  y ese borrador sobrevive a cerrar y reabrir el navegador.
- Al volver la señal, el borrador se sincroniza con la API y queda `Enviada`.
- Un coordinador de la misma asociación ve la evidencia, registra su revisión y
  la inspección queda `Revisada`.

Lo que la demostración **no** prueba:

- Despliegue en internet, dominio público ni certificado de una autoridad
  pública.
- Invitaciones por correo ni recuperación de contraseña por el propio usuario: el operador crea
  las cuentas con `pnpm user:create` y las reinicia con `pnpm user:password`.
- Alta de productores: no hay cuentas de productor en esta etapa.
- Datos reales de productores. El piloto usa datos sintéticos con forma real;
  no se deben cargar datos personales sin un acuerdo de tratamiento.
- Un número de usuarios concurrentes. La API escucha en `127.0.0.1` y el piloto
  está pensado para pocas personas a la vez.

Para que la sesión cuente como evidencia y no como anécdota, seguir
[`protocol.md`](protocol.md): fija las hipótesis, la muestra mínima, qué registrar y qué se
considera éxito.

## 1. Preparar la máquina

```bash
pnpm install --frozen-lockfile
pnpm setup:local
docker compose up -d --wait db
pnpm db:migrate
pnpm db:seed
pnpm build
```

`pnpm db:seed` imprime la ruta `.local/demo-credentials.json` con la contraseña
de las cuentas de demostración. Ese archivo no se versiona.

Averiguar la IP de la máquina en la red local:

```bash
ip -4 route get 1.1.1.1 | awk '{print $7; exit}'
```

Los ejemplos siguientes usan `192.168.1.17`; hay que reemplazarla por la IP real.

## 2. Levantar el piloto

La API sigue escuchando solo en `127.0.0.1:3001`, pero debe conocer el origen
HTTPS con el que el teléfono la va a llamar, porque de eso dependen las cookies
seguras y los orígenes confiables:

```bash
APP_ORIGIN=https://192.168.1.17:8443 pnpm start
```

En otra terminal, el proxy que sirve el sitio ya compilado y enruta `/api`:

```bash
PILOT_HOST=192.168.1.17 docker compose --profile pilot up -d proxy
```

El servicio `proxy` solo existe con el perfil `pilot`: el stack por defecto y
los análisis de imágenes de CI no cambian.

## 3. Instalar la autoridad local en el teléfono

Caddy firma el certificado con una autoridad local propia. Sin instalarla, el
navegador del teléfono no registra el service worker: la comprobación real con
Chromium devuelve `An SSL certificate error occurred when fetching the script`
y el trabajo sin conexión no existe. Este paso no es opcional.

Exportar el certificado de la autoridad:

```bash
docker compose --profile pilot exec -T proxy \
  cat /data/caddy/pki/authorities/local/root.crt > .local/pki/root.crt
```

Ese archivo (`root.crt`) es el que hay que pasar al teléfono por correo, cable o
AirDrop. En el teléfono:

- **Android**: Ajustes → Seguridad → Cifrado y credenciales → Instalar un
  certificado → Certificado de CA → elegir `root.crt`. El sistema avisa que un
  tercero puede supervisar el tráfico: es esperado, se trata de una CA local del
  piloto.
- **iOS**: abrir el archivo, permitir la descarga, luego Ajustes → General →
  VPN y gestión de dispositivos → instalar el perfil. Después, Ajustes →
  General → Información → Ajustes de confianza de certificados → activar la
  confianza total para esa CA.

Al terminar, `https://192.168.1.17:8443` debe abrir sin advertencia de
certificado.

## 4. Crear las cuentas del piloto

Las cuentas no se autorregistran: `disableSignUp` está activo a propósito. Se
crean desde la terminal, una por persona:

```bash
pnpm user:create --email tecnica@chira.test --name "Nombre real" \
  --role technician --association "Asociación Chira · Demo"

pnpm user:create --email coordinacion@chira.test --name "Nombre real" \
  --role coordinator --association "Asociación Chira · Demo"
```

Si la asociación todavía no tiene parcelas, cualquier usuario con sesión puede crearlas desde la
propia interfaz (formulario de parcela); la parcela queda asignada a quien la crea y el alta se
registra en la auditoría como `parcel.created`.

El comando imprime la contraseña generada una sola vez. No la guarda en ningún
archivo: hay que entregarla en el momento y no se puede recuperar después. El
comando solo funciona contra la base local del piloto.

Si alguien olvida la contraseña, el operador la reemplaza sin correo saliente:

```bash
pnpm user:password --email tecnica@chira.test
```

El comando imprime una contraseña nueva, cierra todas las sesiones abiertas de
esa cuenta y conserva el rol y la asociación. La contraseña anterior deja de
servir de inmediato: si el técnico tenía el teléfono con sesión abierta, tendrá
que volver a entrar con la nueva.

## 5. Verificar el stack antes de la visita

Con el piloto levantado:

```bash
PILOT_HOST=192.168.1.17 pnpm pilot:check
```

Comprueba el certificado de la autoridad local, el HTML servido, el manifiesto,
que `/sw.js` no se cachee, que `/api/v1/session` responda 401 sin cookie y que
Chromium obtenga contexto seguro y un service worker que controla la página.
Si algo falla, el comando termina con código 1 y dice cuál comprobación falló.

## 6. Guion de la demostración

Con el teléfono conectado a la misma red:

1. Abrir `https://<IP-de-esta-máquina>:8443` y entrar con la cuenta del técnico.
   La IP no se adivina: `pnpm pilot:check` la imprime en la primera línea. Si el
   router la cambió, hay que recrear el proxy con `PILOT_HOST` y repetir la
   comprobación, porque el certificado está atado a esa dirección.
2. Pulsar **Preparar trabajo offline**. Aparecen las parcelas disponibles y se
   descargan para trabajar sin señal.
3. Activar el modo avión. La aplicación muestra **Sin conexión**.
4. Pulsar **Nueva inspección**, escribir **Observaciones**, marcar **Completé el
   protocolo de bioseguridad** y adjuntar una o dos **Fotografías**.
5. Pulsar **Guardar en este dispositivo**. Queda **Pendiente de sincronizar**.
6. Cerrar el navegador y volver a abrirlo, todavía sin señal: la inspección
   sigue ahí. Ese es el punto que un técnico necesita ver.
7. Desactivar el modo avión y pulsar **Sincronizar ahora**. La inspección pasa a
   **Enviada**.
8. Pulsar **Salir**, entrar con la cuenta del coordinador y abrir la tarjeta de
   la inspección: se ve la fotografía y las observaciones tal como se
   escribieron.
9. Escribir la **Revisión del coordinador**, marcar **Requiere seguimiento** y
   pulsar **Registrar revisión**. La inspección queda **Revisada**.
10. Mostrar **Exportar parcelas** como salida de datos hacia el equipo técnico.

## 7. Problemas comunes

- **El teléfono muestra advertencia de certificado**: la CA no está instalada o
  se instaló sin activar la confianza total (iOS). Sin eso no hay trabajo sin
  conexión.
- **La aplicación dice Sin conexión pero no guarda**: revisar que el paso 2 se
  hizo con señal; el borrador necesita las parcelas descargadas.
- **Cambió la IP de la máquina**: hay que reiniciar la API con el nuevo
  `APP_ORIGIN`, reiniciar el proxy con el nuevo `PILOT_HOST` y volver a instalar
  la CA solo si el certificado anterior no cubría esa IP.
- **`pnpm user:create` rechaza el correo**: ya existe una cuenta con ese correo;
  usar otro, o `pnpm user:password --email <correo>` si lo que hace falta es
  devolver el acceso a la cuenta existente.
- **Un técnico no puede entrar con su contraseña**: reiniciarla con
  `pnpm user:password --email <correo>`; el comando cierra sus sesiones abiertas.

## 8. Cerrar el piloto

```bash
docker compose --profile pilot down
```

Los datos quedan en el volumen de PostgreSQL. Si se quiere conservar una copia
antes de la visita:

```bash
pnpm backup .local/backups/piloto
pnpm restore:check .local/backups/piloto
```
