# Concurso ProInnóvate Piura 2026 — postulación como equipo de personas naturales

Rama: `feat/functional-workspace-ux` (sin commits nuevos todavía; el árbol tiene trabajo ajeno sin
confirmar). Entrega: expediente documental + evidencia de campo; no se publica en el repositorio
ningún dato personal. Verificación: cada afirmación del expediente debe apuntar a una evidencia
observada, nunca a una intención.

Objetivo: ganar el Concurso Regional de Emprendimientos Innovadores de Piura, segunda convocatoria,
con CHIRA OS como Producto Mínimo Viable (PMV) en el Área 1.

## Specs

- **S1 — Ruta y monto.** Entidad Solicitante persona natural ⇒ solo concurso _Emprendimientos
  Innovadores_. RNR hasta **S/ 56 000.00** = capital semilla hasta **S/ 49 000.00** + **S/ 7 000.00**
  fijos de acompañamiento de incubadora o aceleradora.
- **S2 — Cierre.** Envío **únicamente** por el Sistema en Línea `https://inngenius.proinnovate.gob.pe/`
  hasta el **jueves 12 de noviembre de 2026, 1:00 p.m.** No hay prórroga publicada.
- **S3 — Empresa nueva.** El Líder Emprendedor se compromete a constituir una persona jurídica como
  socio fundador, domiciliada en Piura, y esa empresa **solo puede constituirse después de la fecha
  máxima de envío o durante el hito 1**. Constituirla antes invalida la postulación.
- **S4 — Equipo.** 2 a 4 personas naturales. Líder con **domicilio en Piura según DNI**; mayoría del
  equipo con domicilio en Piura; al menos 1 miembro al **100 % (40 h/semana)**, el resto **≥ 20 %**;
  declaración jurada de compromiso como socios fundadores o colaboradores.
- **S5 — PMV con tracción (eliminatorio).** PMV = versión funcional de un producto o servicio nuevo;
  tracción = probado **como mínimo con potenciales clientes o usuarios**; mérito innovador al menos
  regional. **No** se acepta idea, concepto, boceto, maqueta no funcional, presentación ni plan de
  negocio; postular en esa etapa se **desaprueba en cualquier etapa del concurso**.
- **S6 — Área priorizada.** Área 1 _Industria Agropecuaria e Hidrobiológica de Alto Valor Agregado_,
  nichos _Agricultura 4.0_, _Agricultura familiar_ y _Procesos sostenibles e inteligentes en la cadena
  de valor de los alimentos_. Área transversal admitida: _Piura Región Emprendedora y del Saber_.
- **S7 — Umbrales de aprobación.** Escala 1–4, dos evaluadores externos: puntaje total **≥ 2.5 por
  cada evaluador**, y **≥ 2.5 en mérito innovador, ≥ 2.5 en escalabilidad y ≥ 2.5 en pertinencia**
  por al menos un evaluador. Los tres cortes se verifican de forma independiente.
- **S8 — Pesos.** Mérito innovador 25 % (ventaja competitiva 15, contenido tecnológico 10); modelo de
  negocio 20 % (tracción 10, impacto/cadena de valor 10); escalabilidad 15 % (expansión 10, plan de
  capital semilla 5); **equipo 30 %** (composición 15, capacidad 15); pertinencia 10 %.
- **S9 — Presupuesto.** Honorarios del equipo ≤ **S/ 19 600** (40 % del capital semilla); difusión y
  transferencia ≤ **S/ 2 450** (5 %); acompañamiento obligatorio S/ 7 000. RNR ≤ 70 % del valor del
  proyecto; contrapartida mínima 10 % monetaria y máximo 20 % no monetaria.
- **S10 — Legal.** Formato I (persona natural) firmado por líder y equipo; IP esencial no puede ser
  de terceros sin licencia o cesión; el equipo y sus empresas no pueden ser proveedores del proyecto;
  sin deudas coactivas, antecedentes ni inhabilitaciones; proyecto no postulado en otro concurso
  regional vigente.

## Tasks

- **T1** (S5) **sprint de evidencia de campo** — pendiente, requiere personas reales en Piura.
  Protocolo: `docs/pilot/protocol.md`. Meta: 3 técnicos + 1 coordinador, 2 asociaciones, antes del 7/11.
- **T2** (S6, S8) narrativa de la propuesta — **cerrada en borrador v2** en `.local/concurso/propuesta.md`
  (fuera del repositorio público: contiene estrategia comercial). Pendiente de poblar con datos reales.
- **T1a** (S5) planilla de registro de sesión — **hecha**: `docs/pilot/session-record.md`, alineada con
  `docs/pilot/protocol.md` y con las capturas que el expediente necesita citar.
- **T3** (S9) plan de capital semilla y contrapartida — pendiente.
- **T4** (S2, S10) registro y carga en el Sistema en Línea + Formato I firmado — pendiente.
- **T5** (S1) verificación de requisitos legales de cada miembro — pendiente, datos personales fuera
  del repositorio.

## Log

- **L1** — Pedido del usuario, textual: «has lo que sea necesario , mi objetivo es ganar».
- **L2** — Decisión previa del usuario, textual: «persona natural». Descarta Validación de la
  Innovación (exige RUC piurano con 2 años de operación y ventas 2025).
- **L3** — Bases verificadas desde el sitio oficial (bases finales, anexos y formatos descargados):
  calendario, montos, requisitos, umbrales y pesos de S1–S10.
- **L4** — Estado real del producto verificado: el repositorio declara «desarrollo local con datos
  sintéticos», no desplegado. **No existe ninguna sesión de piloto ejecutada** (sin registros en
  `docs/pilot/` ni archivos de resultados). Tracción documentada hoy: cero. Esto es el bloqueo
  decisivo de S5 y no se puede sustituir con redacción.
- **L5** — Evidencia técnica ya verificada y citable: CI `guardian` verde en `main` (run 40118873452),
  `pnpm test:integration` 9/9, `pnpm test:e2e` 4/4, `security:database` y `security:image` sin
  hallazgos HIGH/CRITICAL, base PostGIS fijada por digest con ICU `es-PE`, aislamiento por RLS.
- **L6** — Restricción de privacidad: el repositorio es público. Ningún DNI, nombre, correo ni dato
  de productores entra en `docs/`; el expediente vive en `.local/concurso/` (ignorado por git).
- **L7** — El usuario autorizó continuar y aportó su documento y domicilio. El domicilio está en
  Castilla, provincia de Piura: cumple el requisito de S3 y S4. Los datos personales se guardan solo
  en `.local/concurso/equipo.md`, nunca en un archivo versionado.
- **L8** — El kit de sesión estaba completo salvo el consentimiento escrito que exige el protocolo:
  se agregó `docs/pilot/consent.md` (plantilla sin datos personales). El registro por sesión ya está
  definido en `docs/pilot/protocol.md`.
- **L9** — Queda pendiente el insumo que no se puede redactar: la asociación y las cuatro personas
  que ejecutan las sesiones. Sin eso, T1 no avanza y S5 no se acredita.
- **L10** — Ensayo de preparación del kit de campo (24/10). Se encontraron dos defectos que habrían
  arruinado una sesión real: el proceso de la API estaba bloqueado —escuchaba en 3001 pero no
  respondía ninguna petición— y el proxy seguía con certificado para la IP anterior `192.168.1.17`
  mientras la máquina ahora es `192.168.1.83`. Se reinició la API con `APP_ORIGIN` correcto y el
  proxy con `PILOT_HOST` correcto. `pnpm pilot:check` contra `https://192.168.1.83:8443`: **7 de 7
  comprobaciones en verde**, incluido contexto seguro y service worker controlando la página.
  El kit está listo para recibir un teléfono; falta el teléfono y las personas.
- **L11** — El intento de delegar la redacción a un subagente falló por transporte (`Missing bearer or
basic authentication in header`), no por la tarea. Se hizo el trabajo en línea y no se reintentó a
  ciegas.
- **L12** — Creado `docs/pilot/session-record.md` (una hoja por sesión: participantes, condiciones,
  recorrido cronometrado, errores, H1–H3 con su evidencia, citas, capturas, firma). Expandida la
  propuesta a v2: mérito innovador explicado por mecanismo, protocolo de tracción, plan de seis meses
  con hitos verificables, presupuesto por partida y riesgos de ejecución. Verificado que las rutas
  citadas existen (`docs/verification.md`, 20 KB, contiene las mediciones 9/9 y 4/4).
