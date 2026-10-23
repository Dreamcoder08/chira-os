# Revisión independiente de implementación

Revisión de código independiente, seguida por reproducciones y correcciones del implementador.
No equivale a pentest, certificación ni auditoría exhaustiva. El revisor no accedió a secretos.

| Hallazgo                                                        | Corrección                                                                                   | Regresión                                                          |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Caché previa podía abrirse tras un cambio de cuenta             | Boot bloquea el desacuerdo, sincronización comprueba identidad y API exige autor esperado    | Prueba de navegador de cambio de cuenta                            |
| Dos creaciones sobre una fila ausente podían sobrescribirse     | Compare-and-swap SQL además de bloqueos y versiones del dominio                              | Dos transacciones con lectura ausente; segunda escritura rechazada |
| Un archivo huérfano podía confirmar bytes distintos o parciales | Escritura temporal, fsync y publicación atómica sin reemplazo; verificación en retry         | Reintento idéntico, distinto y huérfano truncado                   |
| Logout offline podía perderse al cerrar pestaña                 | Tombstone persistente, procesamiento al reconectar y al arrancar, propagación entre pestañas | Salir offline, cerrar pestaña y reabrir online                     |
| Trabajo aceptaba un evento inventado o sustituido               | Vínculo con tupla completa del outbox confiable                                              | Evento inexistente, tupla equivocada y replay exacto               |

Cada regresión se observó fallar antes de su corrección. También se añadió integridad SHA-256
de las copias y decodificación de fotografías restauradas para detectar corrupción no vacía.

Riesgos residuales: navegador o dispositivo comprometido, borrado/evicción de almacenamiento
local por el sistema, herramientas de desarrollo con acceso de su usuario, operador de base
privilegiado y fallos desconocidos de dependencias. La cola puede reentregar y dejar trabajos
fallidos que requieren revisión del operador. Las escrituras interrumpidas pueden dejar
archivos huérfanos; no se ejecuta limpieza automática que pueda borrar evidencia necesaria.
