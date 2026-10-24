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

- T1 — S1, inline — hecho (`e262487`) — fundaciones: tokens, fuente, iconos y primitivas.
- T2 — S2, inline — hecho (`8c783e9`) — consola de escritorio: rail, píldoras, tarjeta, dock y hojas laterales.
- T3 — S3, inline — hecho (`pendiente`) — shell móvil: barra inferior, header, banda de sincronización, hojas y acción de guardado al pulgar.
- T4 — S4, inline — hecho (`pendiente`) — cartografía local, worker de MapLibre, escala y controles propios.
- T5 — S6, inline — hecho (`pendiente`) — foco atrapado en las hojas, Escape para cerrar y 36 pares de contraste medidos en navegador.
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
- L9 — T2 hecho. `App.tsx` (~660 líneas) y `styles.css` (~1100 líneas) reescritos. Al
  reescribir aparecieron tres defectos reales que la versión nueva había perdido: (1) el
  aviso solo se renderizaba en la pantalla de login, así que «Parcelas disponibles sin
  conexión» y «Trabajo sincronizado.» no se veían nunca; (2) la banda de sincronización
  completa («Preparar trabajo offline», «Sincronizar ahora») había desaparecido, que es el
  corazón del flujo offline; (3) `ParcelMap` seguía devolviendo su propio `section.panel`
  con un `h2`, que impedía que el mapa ocupara el escenario. Los tres se corrigieron antes
  de verificar.
- L10 — Desvíos respecto del spec, todos por evidencia: (a) el anillo de foco es agave y no
  lima, porque lima sobre arena mide ~1,5:1 y el spec exige contraste medido; lima queda
  solo sobre el rail de tinta; (b) la barra inferior móvil tiene 3 destinos (Parcelas ·
  Mapa · Revisión) y no 4: un destino Perfil duplicaría la identidad del header y un segundo
  botón «Salir» rompe el modo estricto de Playwright; (c) no hay franja de línea de tiempo
  en el dock: un chip con el nombre de la parcela rompería `toHaveCount(1)` de «La Ribera ·
  Demo»; (d) las acciones de sincronización viven dentro del cuerpo del dock colapsable;
  (e) se agregó el token `--clay-700` porque `--clay-500` no alcanza contraste de texto
  sobre arena.
- L11 — Dos fallos de E2E que la reescritura provocó, con su causa: (1) `[mobile]` ocultaba
  `.ds-user` en el header y el test exige ver «Técnico de demostración» tras entrar; se
  resolvió ocultando en su lugar el wordmark, la etiqueta de página y el chip de
  demostración (la divulgación sigue en el encabezado), dejando el nombre con elipsis a
  96 px; (2) en ambos proyectos, tras recargar sin conexión el borrador quedaba dentro de
  la sección Revisión, oculta porque el técnico abre en Parcelas; ahora, al reabrir con
  borradores pendientes, la app abre en Revisión una sola vez por sesión (`useRef`), porque
  el trabajo sin enviar es lo primero que hay que ver. Evidencia: `pnpm check` 0,
  `pnpm test:e2e` 8/8 (36,9 s), `pnpm test:integration` 4 archivos / 17 tests.

### L12 — El mapa salía vacío: worker de MapLibre

MapLibre 6 carga su parser de GeoJSON en un worker aparte. Con Vite el archivo
`maplibre-gl-worker.mjs` no se emite por sí solo, así que el worker fallaba con
`Worker failed to load. Check that the worker URL is correct.` y ninguna fuente
se parseaba: quedaba el fondo de papel y las etiquetas, nada más. Se resolvió con
`import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'` y
`maplibregl.setWorkerUrl(workerUrl)` al tope del módulo. El archivo ahora se emite
(`maplibre-gl-worker-BrB25tGK.mjs`) y entra en la precarga del service worker.

### L13 — Encuadre, escala y densidad

Tres defectos vistos en capturas reales, no en el código: la parcela caía debajo
del dock porque `fitBounds` usaba un padding fijo de 96 px; con una sola parcela
no hay caja que encuadrar, así que ahora se centra con `easeTo` en el área libre;
y la grilla de 1 km no cubría el viewport, por lo que su borde se veía como un
rectángulo sin mapa. Se agregó además una barra de escala calculada en metros por
píxel y se separó la grilla en líneas menores y mayores cada cinco.

### L14 — El servidor de preview congela su lista de archivos

`scripts/preview.ts` usa `@fastify/static` con `wildcard: false`: la lista de
archivos se arma al arrancar. Después de cada `pnpm build` hay que reiniciarlo o
sirve HTML para los hashes nuevos y la app queda en blanco. Queda anotado porque
costó dos rondas de capturas en blanco.

### L15 — Pulido del shell móvil

La barra inferior tapaba las etiquetas de métricas y el pie; el botón «Registrar
parcela» se partía en dos líneas junto al título; el aviso «Trabajo sincronizado.»
se quedaba para siempre sobre el botón «Nueva inspección». Se apiló el encabezado
de sección, se achicaron las etiquetas, se sumó relleno al pie, el aviso se
autocierra a los 4 s y ya no intercepta toques (`pointer-events: none`). La
pestaña Mapa en el teléfono ocupa la pantalla entre el header y la barra, con la
nota de honestidad encima del lienzo.

### L16 — Verificación de T3 y T4

`pnpm check` sale 0 (tipos, eslint, depcruise, prettier, tests y build);
`pnpm test:e2e` sale 0 con 8/8 en los proyectos `desktop` y `mobile` (40,7 s);
`pnpm test:integration` sale 0 con 4 archivos y 17 tests. Capturas revisadas en
1440×900, 834×1112 y 390×844; los únicos errores de consola son los tres 401 de
la sonda de sesión previa al login. El candado de los hashes: se corrigen en un
commit de documentación aparte cuando el commit real exista.

### L17 — Contraste medido, no supuesto

El texto de esta interfaz casi nunca está sobre un color plano: el título vive
sobre el mapa, el topbar y el dock son paneles translúcidos con `blur` y el login
va sobre un degradado. Para eso `getComputedStyle` no alcanza y axe no sirve:
reporta `incomplete` sobre degradados y `backdrop-filter`. Se escribió un arnés
desechable (`.local/contrast.ts`, fuera del repo) que oculta el texto, captura la
caja exacta, decodifica los píxeles con `sharp` y compara contra el peor píxel en
la dirección del texto; el color se resuelve por canvas porque `oklab()` con alfa
no se puede leer de la cadena computada.

Resultado: **36 pares medidos en 1440×900 y 390×844, todos ≥ 4,5:1**. El peor era
el chip «Demostración» con 4,49:1 (el texto caía sobre el borde de la píldora) y
pasó a `--ink-700`. El resto se movió entre 5,08:1 (código de parcela sobre el
hatch) y 17,8:1. Las hojas ahora atrapan el foco, cierran con Escape y devuelven
el foco al elemento anterior.
