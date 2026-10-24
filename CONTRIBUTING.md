# Contribuir

Lee README.md, AGENTS.md y SECURITY.md. Abre una rama por cambio y conserva las reglas
de dependencia. Explica el problema, el comportamiento resultante y la evidencia ejecutada.

Usa Node 24 y la versión de pnpm declarada. Ejecuta pnpm check; los cambios de backend,
permisos o sincronización requieren pnpm test:integration y pnpm test:e2e con datos sintéticos.
Nunca ejecutes estas pruebas contra datos reales: las pruebas revocan sesiones de usuarios demo.

Las migraciones son aditivas y versionadas. No edites una migración aplicada; agrega otra.
Los cambios de contratos deben regenerar OpenAPI y el cliente: pnpm contracts.
Las actualizaciones de dependencias requieren revisión de avisos y pnpm security:deps.
No mezcles una corrección de seguridad con refactorizaciones ajenas.

Los commits se escriben en inglés con Conventional Commits. Interfaz y documentación
para operadores en español. No hay licencia de código abierto concedida en esta etapa.
