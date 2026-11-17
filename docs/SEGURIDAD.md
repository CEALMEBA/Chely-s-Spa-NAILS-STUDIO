# Seguridad — Chely's Spa Nails Studio

Revisión y pruebas realizadas el 2026-11-16.

## 1. Modelo de seguridad

No hay servidor propio: **la seguridad la dan las reglas de Firestore** (`firestore.rules`) y el inicio de sesión de Firebase Authentication. El código de las páginas es público por naturaleza (cualquiera puede verlo en el navegador), así que no se confía en él para proteger nada.

| Colección | Leer | Crear | Editar | Borrar |
|---|---|---|---|---|
| `appointments` (datos personales) | Lista: solo administradoras. Una cita suelta: quien tenga su id | Cualquiera, con validación | Administradoras; la clienta solo puede confirmar o cancelar con su enlace | Solo administradoras |
| `slots` (fecha y hora ocupada) | Público | Cualquiera, con validación | Nadie | Solo administradoras |
| Cualquier otra colección | Nadie | Nadie | Nadie | Nadie |

Una administradora es una cuenta con correo **verificado** incluido en la lista de `firestore.rules`.
Validación al crear una cita: estado `pendiente`, nombre de 1 a 60 caracteres, teléfono de exactamente 10 dígitos y solo los campos permitidos.

### Enlace de la clienta (confirmar / cancelar)

Desde que la clienta confirma o cancela con un enlace (`cita.html?id=…`), **el id de la cita funciona como llave**: quien tenga el enlace puede ver esa cita (nombre, teléfono, servicio, fecha, hora, notas) y confirmarla o cancelarla. Es un riesgo aceptado, con estos límites:

- El id son 20 caracteres al azar: no se puede adivinar ni listar (la lista sigue siendo solo para administradoras).
- El enlace solo viaja en el WhatsApp que la administradora manda al número de la clienta.
- Con el enlace solo se puede pasar una cita activa a `confirmada` o `cancelada` (campos `estado` y `respuesta`); no se puede editar nada más, ni reactivar una cancelada, ni borrar.
- La clienta no puede borrar el horario: lo libera el panel de la administradora.

**Las pruebas 2 y 6 de abajo son anteriores a este cambio**: ahora leer una cita por id está permitido y editarla se permite solo en la forma descrita. Conviene repetirlas en el simulador de reglas.

## 2. Pruebas realizadas (contra la base real, sin iniciar sesión)

Se enviaron peticiones directas a la API de Firestore, como lo haría un atacante, sin pasar por la página.

| # | Intento | Resultado esperado | Resultado |
|---|---|---|---|
| 1 | Leer la lista de citas | Rechazado | ✅ 403 PERMISSION_DENIED |
| 2 | Leer una cita por id | Rechazado | ✅ 403 |
| 3 | Leer horarios ocupados | Permitido (público) | ✅ 200, solo `fecha` y `hora` |
| 4 | Borrar una cita | Rechazado | ✅ 403 |
| 5 | Borrar un horario ocupado | Rechazado | ✅ 403 |
| 6 | Editar una cita (cancelarla) | Rechazado | ✅ 403 |
| 7 | Editar un horario ocupado | Rechazado | ✅ 403 |
| 8 | Leer una colección no prevista (`users`) | Rechazado | ✅ 403 |
| 9 | Crear una colección no prevista | Rechazado | ✅ 403 |
| 10 | Crear cita ya "confirmada" | Rechazado | ✅ 403 |
| 11 | Crear cita con teléfono inválido | Rechazado | ✅ 403 |
| 12 | Crear cita con campo extra (`isAdmin`) | Rechazado | ✅ 403 |
| 13 | Crear horario con id que no corresponde | Rechazado | ✅ 403 |

**Alcance y limitaciones.** Las pruebas 10 a 13 se enviaron con datos mínimos, por lo que también podrían rechazarse por faltar campos y no solo por la regla específica. No se probó crear una cita válida directamente para no ensuciar la agenda real; ese camino lo ejercen las clientas desde la página. Tampoco se probó con una sesión de administradora ni con una cuenta ajena: conviene hacerlo en el **simulador de reglas** de Firebase Console (Firestore → Reglas → Simulador) o con el emulador.

## 3. Revisión del código

- **XSS (inyección de HTML):** los datos de las clientas (nombre, notas, teléfono, estado) se escapan con `esc()` antes de mostrarse en el panel. ✅
- **Doble reserva:** el id fijo del horario y la creación en bloque (`writeBatch`) impiden reservar dos veces la misma hora. ✅
- **Zona horaria:** las fechas se calculan en hora local, no UTC.
- Sin dependencias externas de ejecución propias (no hay `npm`), por lo que no hay cadena de suministro que vigilar más allá de Firebase y las fuentes.

## 4. ¿Qué se ve en el repositorio público?

El repositorio es **público**. Se revisaron todos los archivos y **todo el historial** de git.

| Dato | ¿Se ve? | Riesgo |
|---|---|---|
| Contraseñas, llaves privadas, tokens, cuentas de servicio | **No** (búsqueda en todo el historial: sin resultados) | — |
| Datos de clientas (nombres, teléfonos, citas) | **No**: viven en Firestore, nunca en git | — |
| Llave de Firebase (`apiKey`) e identificadores del proyecto | Sí | **Ninguno por sí solo.** Son públicos por diseño; sin sesión de administradora las reglas niegan el acceso (pruebas 1–9). |
| Los 2 correos de administradoras (`firestore.rules`, `js/firebase-config.js`) | Sí | **Bajo.** Revelan quién administra, pero no dan acceso: se requiere iniciar sesión con esa cuenta. Pueden recibir intentos de phishing. |
| Teléfono/WhatsApp del negocio | Sí | Ninguno: ya es público en la página. |
| Un teléfono de ejemplo como `placeholder` del formulario | Sí | Es el del negocio. |

## 5. Riesgos conocidos y recomendaciones

1. **Verificación en dos pasos (2FA) en las cuentas de Google de las administradoras.** Es la medida más importante: si una cuenta se compromete, se ven todos los datos.
2. **Citas falsas masivas.** Cualquiera puede crear citas sin cuenta y ocupar horarios. Mitigaciones posibles: Firebase **App Check** (reCAPTCHA), o exigir confirmación por WhatsApp antes de dar por válida la cita (ya existe el estado `pendiente`).
3. **Restringir la llave de Firebase.** En Google Cloud Console → Credenciales → llave del navegador → restricción por referente HTTP: `cealmeba.github.io/*`. Evita que otros sitios usen tu proyecto.
4. **Dominios autorizados** en Firebase Authentication: dejar solo `cealmeba.github.io` (y el dominio propio, si se compra).
5. **Retención de datos.** Exportar o borrar citas antiguas: guardan teléfonos de clientas.
6. **Presupuesto.** Mantener el plan Spark (gratuito); no hay cobros sorpresa.
7. **Si se quisiera ocultar los correos admin:** usar un grupo de correo o *custom claims* de Firebase en lugar de listar correos en las reglas.

## 6. Cómo repetir las pruebas

Peticiones de ejemplo (deben dar `403`):

```bash
B="https://firestore.googleapis.com/v1/projects/chelys-spa/databases/(default)/documents"
curl -s -o /dev/null -w "%{http_code}\n" "$B/appointments"            # 403
curl -s -o /dev/null -w "%{http_code}\n" -X DELETE "$B/appointments/x" # 403
curl -s -o /dev/null -w "%{http_code}\n" "$B/slots"                    # 200 (público)
```
