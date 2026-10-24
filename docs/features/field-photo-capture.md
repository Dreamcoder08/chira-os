# Captura de fotografías de campo

Objetivo: que una foto tomada con un teléfono moderno llegue al servidor como evidencia, en vez de
quedar bloqueada por el límite de píxeles de la API. Rama `main`, entrega por work units, runner
`vitest` + Playwright.

## Specs

- **S1** — Toda fotografía elegida en el formulario se reduce **en el dispositivo** antes de
  guardarse en el borrador, de modo que su lado mayor quede en **2048 px o menos** y nunca se
  amplíe una imagen más chica. Motivo medido: la API crea `sharp` con `limitInputPixels: 20_000_000`
  y un JPEG de 8064×6048 (48 MP) se rechaza con `Input image exceeds pixel limit`, que el cliente
  traduce en `INVALID_IMAGE` y el borrador pasa a `blocked`.
- **S2** — La orientación EXIF se aplica antes de reducir: una foto vertical no se guarda acostada.
- **S3** — Si el navegador no puede decodificar el archivo, el formulario muestra un mensaje claro y
  no guarda nada. No se guarda una foto que la API va a rechazar.
- **S4** — El borrador conserva su forma `{ id, blob }`: sin migración de esquema y sin cambios en
  `synchronize`, que sigue enviando el blob tal cual.
- **S5** — La evidencia servida sigue siendo WebP de 2048 px, como ya hace la API; el doble encode
  (cliente q0.92 → servidor q82) se registra en `docs/verification.md` en vez de declararlo
  invisible.
- **S6** — Los límites visibles para el usuario no cambian: hasta 5 imágenes, 8 MB por archivo. La
  verificación de tamaño queda como guarda previa a la decodificación, no como criterio de calidad.

## Tasks

- **T1** (S1) inline — hecho. `fitWithin` puro y `tests/unit/photo.test.ts` (6 casos): RED con
  módulo inexistente, GREEN después. 48 MP → 2048×1536, retrato → 1536×2048, y una imagen que ya
  cabe no se amplía.
- **T2** (S1, S2, S3, S4) inline — hecho. `preparePhoto` decodifica con `imageOrientation:
'from-image'`, reduce con `fitWithin`, codifica WebP q0.92 con respaldo JPEG y cierra el bitmap.
  Si la imagen ya cabe se guarda el archivo original, sin generación perdida. `InspectionForm`
  asigna el id al elegir la foto, muestra «Preparando las imágenes…» y bloquea el guardado mientras
  trabaja; un error de decodificación sale como mensaje, no como borrador bloqueado.
- **T3** (S1, S3) inline — hecho. E2E «a 48 MP phone photo is stored at the size the server
  accepts»: sube un JPEG real de 8064×6048, guarda el borrador y lee el blob desde IndexedDB.
  Afirma 2048×1536, `image/webp`, menos de 20 M de píxeles y menos bytes que el original. RED
  observado con `preparePhoto` devolviendo el archivo intacto: 2 fallos (escritorio y móvil).
- **T4** (S5, S6) inline — verificación y documentación.

## Log

- **L1** — Pedido del usuario, textual: «yes te autorizo todo y avanza de forma autonoma ussa ODD de
  gentleman».
- **L2** — Estado verificado antes de escribir: los tres documentos de trabajo previos están
  cerrados (`design-system`, `pilot-field-stack`, `pilot-gates`) y `docs/verification.md` deja un
  solo pendiente de ingeniería, el chunk de MapLibre, que ya está en carga diferida
  (`lazy(() => import('./components/ParcelMap.tsx'))`), así que no bloquea el primer render.
- **L3** — Defecto encontrado explorando el camino de la evidencia, no el del tamaño del bundle:
  `InspectionForm` valida tamaño (8 MB) y MIME, pero **no** cuenta píxeles; `offline.ts` guarda el
  `File` crudo en IndexedDB; `sync` lo envía a `/photos/:photoId`; la API lo rechaza con 415 y el
  borrador queda `blocked`. Reproducido con evidencia:
  `node -e "sharp(8064×6048 jpeg, {limitInputPixels:20_000_000}).metadata()"` devuelve
  `Input image exceeds pixel limit`. Un teléfono de 48 MP produce exactamente ese archivo, y el
  técnico ve «Guardar en este dispositivo» funcionar para después perder la evidencia.
- **L4** — Alcance descartado a propósito: reescribir el mapa para eliminar MapLibre. Se midió el
  build —1 064 418 B de JS y 518 806 B de worker— pero el chunk ya es diferido y el piloto corre en
  una LAN, así que 415 KB gzip no justifican reescribir el elemento central de la interfaz.
