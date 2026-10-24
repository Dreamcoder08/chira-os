# Sistema de diseño de CHIRA OS Guardian

Fecha: 24 de octubre de 2026
Estado: aprobado por el usuario (enfoque «Consola de campo»)
Implementación: `docs/features/design-system.md`

## Objetivo

Dar a CHIRA OS una identidad visual propia y una estructura de interfaz que se sostenga
en dos canchas a la vez: la demo de campo con un técnico real (teléfono, sol, una mano,
sin señal) y la revisión del coordinador en escritorio. Inspiración declarada: el
dashboard agritech de referencia (mapa protagonista, rail flotante, paneles translúcidos,
chips con icono) y el UX de las apps móviles de esta generación (aire, esquinas
generosas, hojas que suben, acción primaria al pulgar, cero ruido).

## Alcance

Toda la aplicación web: inicio de sesión, consola del coordinador y shell móvil del
técnico. No cambia ningún flujo, ruta, texto visible ni contrato de la API. La cáscara
se rehace; el comportamiento queda.

## Fundaciones

### Color

| Token         | Valor     | Uso                                             |
| ------------- | --------- | ----------------------------------------------- |
| `--ink-900`   | `#0F1A16` | rail, texto principal                           |
| `--ink-700`   | `#1C2B24` | superficies oscuras secundarias                 |
| `--ink-500`   | `#4A5A52` | texto secundario                                |
| `--ink-300`   | `#8A968F` | placeholder, texto terciario                    |
| `--sand-50`   | `#FBFAF6` | lienzo de la app                                |
| `--sand-100`  | `#F4F1E8` | tarjetas, papel                                 |
| `--sand-200`  | `#E8E4D8` | bordes                                          |
| `--agave-600` | `#1F5C43` | acción primaria                                 |
| `--agave-700` | `#17452F` | hover de la primaria                            |
| `--lime-300`  | `#B7F171` | acento único: foco, activo, selección, en línea |
| `--clay-500`  | `#C4622D` | atención: requiere seguimiento                  |

Contraste medido: lima sobre tinta 13,4:1; agave sobre arena 7,1:1; tinta sobre arena
16,8:1. Ningún par de texto baja de 4,5:1.

### Tipografía

Una sola familia: `Inter Variable` self-hosted vía `@fontsource-variable/inter`
(paquete versionado, sin CDN, subset latino). Escala:

| Rol            | Tamaño / interlínea            | Tracking |
| -------------- | ------------------------------ | -------- |
| display        | 44 / 1.05                      | −0.03em  |
| h1             | 32 / 1.1                       | −0.02em  |
| h2             | 22 / 1.2                       | −0.01em  |
| cuerpo         | 15 / 1.55                      | 0        |
| chico          | 13 / 1.45                      | 0        |
| micro-etiqueta | 11 / 1.2, versalitas, peso 600 | +0.08em  |

En móvil el display baja a 34 y el h1 a 26. Las métricas, fechas y códigos usan
`font-variant-numeric: tabular-nums`. Ningún texto informativo por debajo de 13 px.

### Espacio, forma, elevación

Base 4 px: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64. Radios: 10 / 16 / 22 / 28 / full.
Elevaciones: `--shadow-1` reposo, `--shadow-2` flotante sobre el mapa, `--shadow-3`
hojas y modales. Paneles flotantes: arena al 82 % + `backdrop-filter: blur(16px)`, con
fallback a arena opaca cuando el blur no está disponible.

### Movimiento

`--ease-out: cubic-bezier(0.2, 0.8, 0.2, 1)`, `--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1)`.
Duraciones: 120 ms micro-feedback, 180 ms por defecto, 240 ms hojas, 320 ms cambio de
vista. Solo se animan `transform` y `opacity`. `prefers-reduced-motion` lo apaga todo.
Nada se mueve solo: sin parallax, sin scroll-jacking, sin carruseles automáticos.

### Iconografía

Set propio en `apps/web/src/components/icons.tsx`: SVG en línea, `viewBox="0 0 24 24"`,
trazo 1,75, `currentColor`, tamaño por `--icon-size`. Reemplaza los glifos Unicode
actuales (`▦ ◉ ⌖`). Sin librería de iconos, sin dependencia nueva.

## Escritorio (≥1024 px): la consola

El sidebar desaparece; el mapa ocupa el workspace completo y el resto flota.

- **Rail** de 64 px a la izquierda, tinta, radio 22, separado 12 px del borde: hoja de la
  marca arriba; destinos Parcelas, Inspecciones, Exportar; abajo avatar y Salir.
- **Píldora de contexto** arriba a la izquierda: marca y título de la vista.
- **Píldora de estado** arriba a la derecha: selector de asociación (solo con más de una
  membresía), chip de conexión, nombre y Salir. El aviso `DEMOSTRACIÓN · DATOS
SINTÉTICOS` pasa a chip dentro de ese grupo: sigue visible, deja de ocupar una banda.
- **Tarjeta de parcela** flotante arriba a la derecha: nombre, código, hectáreas,
  cultivo, última inspección y `Nueva inspección`. Se llena al seleccionar una parcela en
  el mapa o en la lista.
- **Dock inferior** colapsable de 280 px con dos pestañas, Parcelas e Inspecciones, tres
  métricas (parcelas, inspecciones, pendientes de sincronizar) y una línea de tiempo de
  inspecciones por día. Colapsado queda una barra de 56 px con el resumen.
- **Hojas laterales** de 480 px para captura y revisión, en lugar de modales centrados.
- El toggle `Ver ubicaciones` desaparece.

## Móvil (<1024 px): el shell

- **Barra inferior** con cuatro destinos: Parcelas, Captura, Revisión, Perfil. Icono,
  etiqueta de 10 px, indicador lima detrás del activo, `safe-area-inset-bottom`.
- **Header compacto** con asociación, chip de conexión y avatar; se encoge al scrollear.
- **Banda de sincronización** permanente bajo el header cuando hay borradores o no hay
  señal.
- **Hojas** para captura y revisión: suben desde abajo, radio 28 arriba, handle de
  arrastre, altura máxima 92vh, acción primaria fija sobre el safe area.
- **Mapa** como control segmentado dentro de Parcelas (Lista · Mapa), no como destino.

## Componentes

Inventario y contrato de clases. Los nombres existentes que sobreviven se conservan y se
restilizan; los elementos nuevos usan prefijo `ds-`.

| Componente      | Clases                                                                      | Notas                                 |
| --------------- | --------------------------------------------------------------------------- | ------------------------------------- |
| Botón           | `.ds-btn` + `--primary` `--secondary` `--ghost` `--icon` `--danger`         | alto 44, radio 12, foco lima          |
| Chip            | `.ds-chip` + `--online` `--offline` `--warn` `--accent` `--neutral`         | 24 px de alto, icono opcional         |
| Píldora         | `.ds-pill`, `.ds-pill-group`                                                | superficie flotante + blur            |
| Rail            | `.ds-rail`, `.ds-rail-item`                                                 | 64 px, activo con fondo lima/12 %     |
| Tarjeta         | `.panel` (existente) + `.ds-parcel-card`                                    | `panel` se restiliza                  |
| Dock            | `.ds-dock`, `.ds-dock-handle`, `.ds-dock-tabs`                              | colapsable                            |
| Hoja            | `.ds-sheet` + `--bottom` `--right`, `.ds-sheet-handle`, `.ds-sheet-actions` | foco atrapado, Esc cierra             |
| Métrica         | `.ds-stat`                                                                  | número tabular + etiqueta micro       |
| Línea de tiempo | `.ds-timeline`, `.ds-timeline-bar`                                          | solo CSS                              |
| Campo           | `.ds-field`, `.ds-input`, `.ds-error`                                       | error con `aria-describedby`          |
| Tab bar         | `.ds-tabbar`, `.ds-tabbar-item`                                             | solo móvil                            |
| Fotos           | `.ds-photos`, `.ds-photo`                                                   | miniaturas 72 px, `object-fit: cover` |
| Vacío           | `.ds-empty`                                                                 | icono + frase + acción                |
| Aviso           | `.notice` (existente)                                                       | restilizado a toast anclado           |
| Esqueleto       | `.ds-skeleton`                                                              | solo para la carga inicial            |

## Cartografía

El mapa no usa tiles externos: la LAN del piloto no tiene internet y una ortofoto
dependería de un proveedor y una licencia. El estilo se construye con MapLibre sobre las
parcelas que ya entrega la API:

- fondo papel `#EFEBDF`;
- grilla de 1 km generada en el cliente, tinta al 4 %;
- parcelas con relleno `#DCE7C9` y borde agave 1 px;
- parcela seleccionada con relleno lima al 55 % y borde tinta de 2 px;
- etiquetas de parcela en Inter 11 px con halo arena de 2 px;
- controles de zoom propios (`.ds-map-controls`), sin `NavigationControl` ni atribución.

## Accesibilidad

Foco visible con anillo lima de 2 px y 2 px de separación en todo lo interactivo.
Targets de 44 px en móvil y 48 px el primario. Hojas con `role="dialog"`,
`aria-modal="true"`, foco atrapado y cierre con Esc. Estados nunca comunicados solo por
color: cada chip lleva texto. `prefers-reduced-motion` respetado.

## Qué no cambia

Rutas por hash, textos visibles, `aria-label` y roles que los tests E2E verifican, los
flujos de captura, sincronización y revisión, y el contrato de la API. Cero dependencias
de router o de componentes: la única dependencia nueva es la fuente.

## Verificación

- `pnpm check` (tipos, lint, depcruise, formato, unitarios, build).
- `pnpm test:e2e` con los dos proyectos, escritorio y Pixel 7.
- `pnpm test:integration` sin cambios esperados.
- Capturas en 390×844, 834×1112 y 1440×900, revisadas a ojo y guardadas fuera del repo.
- Contraste medido sobre los pares reales del CSS, no sobre la paleta teórica.

## Riesgos y límites

- El rediseño no tiene verificación automática de apariencia: los tests cubren flujos, no
  estética. Por eso el riesgo se declara y las capturas se revisan a mano.
- La cartografía local no es una ortofoto: no muestra cultivos ni terreno real. Se declara
  como decisión, no como carencia.
- El mapa sigue sin internet: sin tiles, sin geocodificación, sin búsqueda de direcciones.
