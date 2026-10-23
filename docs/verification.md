# Evidencia de verificación — 23 de octubre de 2026

## Ejecutado localmente

- `pnpm check`: tipos, lint, límites de dependencia, formato, 16 pruebas unitarias y build.
- `pnpm test:integration`: 9 pruebas con PostgreSQL/PostGIS real, incluida escritura concurrente
  y reintentos simultáneos con una misma clave.
- `pnpm test:e2e`: 4 escenarios Chromium, incluidos captura/reapertura offline, revisión,
  cambio de cuenta con borrador pendiente y logout offline entre pestañas.
- `pnpm peers check` y reinstalación offline con lockfile congelado: correctos.
- Contrato OpenAPI y tipos regenerados. Archify: los dos diagramas completaron sus cuatro
  gates (validate, deliver, check, browser-check) con Chromium seleccionado explícitamente.
- Inspección visual de escritorio y móvil; sin overflow horizontal a 390 px.
- Copia y restauración en base temporal: registros y fotos verificados. Prueba de corrupción
  del archivo rechazada antes de restaurar.
- `pnpm audit`: sin vulnerabilidades conocidas reportadas en el momento de consulta.
- Trivy de fuente/lockfile: sin hallazgos altos/críticos ni secretos detectados; no garantiza
  ausencia de código malicioso o fallos desconocidos.
- Imagen de aplicación construida y analizada: sin hallazgos altos/críticos tras sustituir
  la base inicial por distroless Node 24 Debian 13. API/worker empaquetados arrancaron localmente.

## Pendiente, sin atribuirle un resultado verde

- PostGIS inicial 17/3.5: el análisis encontró componentes vulnerables de Debian 11.
  Se cambió el pin a 17/3.6 con digest obtenido del registro, pero HTTP 503 impidió terminar
  la descarga, verificar la actualización y ejecutar su análisis. Las pruebas anteriores
  se ejecutaron sobre la imagen inicial; deben repetirse sobre la sustituta antes del piloto.
- GitHub: publicación y ejecución remota de Actions pendientes por fallo HTTP 503 del acceso
  saliente. La autenticación inicial era Dreamcoder08; el conector conserva lectura, pero no
  ofrece creación de repositorios. No se atribuye un enlace remoto a un repo no creado.
- Protección efectiva de main depende de los permisos/plan de GitHub y debe configurarse
  y comprobarse cuando se publique; CODEOWNERS y el workflow por sí solos no la imponen.
- S3 implementado como adaptador opcional, sin pruebas contra un proveedor real ni despliegue.
- Chunk opcional de MapLibre: 1.07 MB sin comprimir; optimización pendiente antes de expansión.

Para publicar cuando se recupere la red: `pnpm publish:repo`. El script verifica cuenta,
repositorio privado, origen esperado y árbol limpio; no fuerza pushes ni contrata servicios.
Después, comprobar Actions y activar requerimiento de CI en main. No se debe habilitar un
piloto con datos reales mientras los gates pendientes no estén cerrados.
