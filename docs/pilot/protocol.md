# Protocolo de validación del piloto

Este documento convierte una demostración en evidencia utilizable. No promete tracción: define qué
se va a medir, con quién y qué cuenta como resultado, para que lo observado se pueda reportar sin
adornos.

## Objetivo

Comprobar si un técnico de campo y un coordinador de una asociación bananera del valle del Chira
pueden capturar una inspección fitosanitaria sin conexión desde un teléfono y revisarla después,
sin soporte técnico durante la sesión.

## Hipótesis

- **H1 — Captura sin conexión.** Un técnico completa una inspección con fotografías en modo avión y
  la sincroniza al recuperar la red, sin perder evidencia ni repetir el trabajo.
- **H2 — Revisión con evidencia.** Un coordinador entiende la inspección sincronizada y registra su
  revisión (aprobada o con seguimiento) sin ayuda del operador.
- **H3 — Aislamiento entre asociaciones.** Una cuenta de otra asociación no ve las parcelas ni las
  inspecciones de la asociación del piloto.

## Participantes

Mínimo para que el resultado diga algo: **3 técnicos y 1 coordinador** de **2 asociaciones**, en
sesiones separadas. Con menos, se registra como prueba de usabilidad, no como validación.

Cada participante firma o acepta por escrito la participación y el uso de lo observado. No se
cargan datos reales de productores: el piloto usa parcelas y datos sintéticos, y lo que se registra
son las acciones y opiniones de las personas, no información productiva.

## Qué se registra por sesión

| Campo                | Detalle                                                          |
| -------------------- | ---------------------------------------------------------------- |
| Fecha y lugar        | Día, distrito, si hubo conectividad y de qué tipo                |
| Participante         | Rol, años de experiencia, si usó teléfono propio o prestado      |
| Recorrido            | Pasos completados del guion de `field-demo.md` y cuáles no       |
| Tiempo               | Desde abrir la aplicación hasta la inspección sincronizada       |
| Errores              | Qué intentó, qué esperaba, qué ocurrió; sin interpretar la causa |
| Fricción             | Todo momento en que pidió ayuda o dudó más de diez segundos      |
| Resultado            | H1, H2 y H3: cumplida, cumplida con ayuda, no cumplida           |
| Frases textuales     | Citas del participante, sin corregirlas                          |
| Incidencias técnicas | Capturas de pantalla, mensajes de error, hora                    |

## Criterios de éxito

El piloto se considera **validado** cuando, en al menos dos de las tres sesiones:

1. H1 se cumple sin ayuda del operador y sin pérdida de evidencia.
2. H2 se cumple en la misma sesión, con el coordinador trabajando solo.
3. H3 se cumple: la cuenta de la otra asociación no ve nada ajeno.

Si algo falla, se registra como fallo con su evidencia y se decide si es un defecto del producto o
una carencia del piloto. Un fallo documentado vale más que un éxito sin registro.

## Plantilla de resultados

```
Sesión: <fecha> — <lugar> — conectividad: <sí/no, tipo>
Participante: <rol>, <años de experiencia>, teléfono: <propio/prestado>
Recorrido: <pasos completados / omitidos>
Tiempo hasta sincronizar: <minutos>
H1 captura sin conexión: <cumplida | con ayuda | no cumplida>
H2 revisión del coordinador: <cumplida | con ayuda | no cumplida>
H3 aislamiento: <cumplida | no cumplida>
Errores observados: <qué hizo, qué esperaba, qué ocurrió>
Fricción: <momentos de duda o de pedir ayuda>
Citas: "<frase textual>"
Incidencias técnicas: <captura o mensaje, hora>
Decisión: <defecto del producto | carencia del piloto | sin acción>
```

## Límites que hay que declarar al reportar

- El piloto corre en una red local con una CA propia: no prueba un despliegue en internet.
- No hay invitaciones por correo ni recuperación de contraseña por el propio usuario; el operador
  crea y reinicia las cuentas.
- Los datos son sintéticos: no hay historial real de parcelas ni de campañas anteriores.
- Un solo servidor local, pocos usuarios concurrentes: no prueba carga ni disponibilidad.
- Que un técnico use el sistema una vez no es adopción; la adopción se mide en semanas de uso.
