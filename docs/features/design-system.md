# Sistema de diseño Guardian — Consola de campo

Objetivo: identidad visual y estructura de interfaz nuevas para la app web, en dos
densidades (consola de escritorio y shell móvil de campo), sin cambiar flujos ni
contratos. Rama `main`, commits por unidad de trabajo después de verificar. Diseño
aprobado en `docs/superpowers/specs/2026-10-24-design-system-design.md`.
Runners: `pnpm check`, `pnpm test:e2e`, `pnpm test:integration`.

## Specs

- **S1 — Fundaciones.** `apps/web/src/styles.css` define los tokens del spec (color,
  tipografía, espacio, radios, elevación, movimiento) dentro de `@theme`, la app carga
  `Inter Variable` self-hosted sin CDN, y existe `apps/web/src/components/icons.tsx` con
  el set propio que reemplaza los glifos Unicode. La única dependencia nueva es el
  paquete de la fuente.
- **S2 — Consola de escritorio.** A partir de 1024 px la app muestra: rail de 64 px con
  marca, destinos y salir; píldora de contexto arriba a la izquierda; píldora de estado
  arriba a la derecha con selector de asociación, chip de conexión, chip de demostración,
  usuario y salir; tarjeta de parcela flotante que se llena al seleccionar; dock inferior
  colapsable con métricas, línea de tiempo y pestañas Parcelas e Inspecciones; captura y
  revisión como hoja lateral de 480 px. El toggle `Ver ubicaciones` ya no existe.
- **S3 — Shell móvil.** Por debajo de 1024 px la app muestra barra inferior de cuatro
  destinos (Parcelas, Captura, Revisión, Perfil), header compacto con asociación y estado,
  banda de sincronización permanente cuando hay borradores o no hay señal, captura y
  revisión como hojas que suben con acción primaria fija, y el mapa como control
  segmentado Lista · Mapa dentro de Parcelas.
- **S4 — Cartografía local.** El mapa se dibuja sin tiles externos: fondo papel, grilla de
  1 km, parcelas con relleno y borde, parcela seleccionada en lima, etiquetas con halo y
  controles de zoom propios. Ninguna petición de red sale del origen de la app.
- **S5 — Comportamiento intacto.** Rutas por hash, textos visibles, `aria-label` y roles
  que los tests verifican siguen igual; `pnpm test:e2e` pasa en los dos proyectos
  (escritorio y Pixel 7) y `pnpm test:integration` no cambia.
- **S6 — Accesibilidad.** Foco visible en todo lo interactivo, targets de 44 px en móvil,
  hojas con `role="dialog"`, `aria-modal`, foco atrapado y cierre con Esc, estados
  comunicados con texto además de color, `prefers-reduced-motion` respetado y contraste
  medido de los pares reales por encima de 4,5:1.
- **S7 — Registro.** `docs/verification.md` y `README.md` describen lo observado, sin
  capturas inventadas ni afirmaciones de validación con usuarios reales.

## Tasks

- T1 — S1, inline — hecho (`ea30cd5`) — fundaciones: tokens, fuente, iconos y primitivas.
- T2 — S2, inline — consola de escritorio: rail, píldoras, tarjeta, dock y hojas laterales.
- T3 — S3, inline — shell móvil: barra inferior, header, banda de sincronización y hojas.
- T4 — S4, inline — cartografía local y controles propios.
- T5 — S6, inline — pasada de accesibilidad y contraste medido.
- T6 — S5, S7, inline — verificación completa y registro en docs.

## Log

- L1 — Pedido del usuario, textual: «para el system desing , inspirate en esta interfaz
  de usuario [imagen del dashboard agritech] , ademas inspirate en el ui & Ux de
  vanguardia que tienen aplicaciones modernas de esta mes , semana en la web , que han
  ganado premios , creatividad , en chat gpt mobile , claude mobile , y mas».
- L2 — Alcance elegido: «Toda la app (Recomendado)»; un solo sistema con dos densidades.
- L3 — Estructura de escritorio elegida: «Sí, consola con mapa al centro (Recomendado)».
- L4 — Estructura móvil elegida: «Shell de app con barra inferior (Recomendado)».
- L5 — Enfoque visual elegido: «A · Consola de campo (Recomendado)».
- L6 — Hallazgo que condiciona el diseño: `ParcelMap.tsx` declara `sources: {}`, o sea que
  hoy no hay basemapa. Una ortofoto real exigiría proveedor, internet y licencia, y la LAN
  del piloto no tiene internet; se elige cartografía local estilizada y se declara como
  decisión, no como carencia.
- L7 — También observado: la tipografía `Inter` del CSS no se carga (cae al system font) y
  no hay librería de iconos. Las dos cosas se resuelven en S1.
- L8 — T1 hecho. `@fontsource-variable/inter` 5.3.0 instalado con `pnpm add -w` (el paquete
  se publicó el 2026-07-19, fuera de la ventana de 72 h). `apps/web/src/fonts.css` declara
  una sola cara, subset latino; el build emite
  `assets/inter-latin-wght-normal-Dx4kXJAl.woff2` de 48.256 bytes y el `sw.js` generado la
  incluye en `PRECACHE`, así que la fuente también funciona sin red. Los tokens de S1 viven
  en `:root` de `styles.css` y `components/icons.tsx` aporta el set propio de 20 iconos, sin
  dependencia nueva de iconos. Evidencia: `pnpm check` sale 0 (tipos, eslint + depcruise,
  prettier, unitarios y build).
