# Arquitectura — Chely's Spa Nails Studio

Sitio de citas sin servidor propio: páginas estáticas en GitHub Pages + Firebase (Authentication y Firestore) en el plan gratuito.

```
 Clienta (celular / PC)                     Administradora (celular / PC)
        │                                              │
        ▼                                              ▼
  index.html + js/app.js                      admin.html + js/admin.js
        │  (sin sesión)                                │  (login Google o correo/contraseña)
        └───────────────┬──────────────────────────────┘
                        ▼
             Firebase (proyecto chelys-spa)
             ├─ Authentication  → identifica a las administradoras
             └─ Firestore       → colecciones `appointments` y `slots`
                  protegido por firestore.rules (es la verdadera barrera de seguridad)

  Hosting: GitHub Pages, rama `main`, carpeta raíz (se publica solo al hacer push).
```

## Archivos

| Archivo | Función |
|---|---|
| `index.html` | Página pública: servicios, formulario de cita, horario, contacto. |
| `js/app.js` | Lógica pública: arma el catálogo, calcula horarios libres, reserva la cita, muestra el aviso de éxito. |
| `js/catalogo.js` | Catálogo de servicios, colores e íconos (fuente única para la página y el panel). |
| `cita.html`, `js/cita.js` | Página de la clienta para confirmar o cancelar su cita. Se abre con el enlace del WhatsApp: `cita.html?id=<id>&a=confirmar/cancelar`. |
| `admin.html` | Panel de administración. |
| `js/admin.js` | Login, lista de citas en tiempo real, confirmar / cancelar / marcar atendida, mensajes de WhatsApp, enlace a Google Calendar. |
| `js/firebase-config.js` | Configuración pública de Firebase, correos admin (solo para mostrar el panel) y número del negocio. |
| `js/aviso.js` | Aviso al celular vía ntfy.sh (tema en `firebase-config.js`) al reservar, confirmar o cancelar. Sin nombre ni teléfono. |
| `rastreo.html`, `js/rastreo.js` | Página aparte (login Firebase, solo correos admin): mapa con la ubicación actual y el historial de aperturas del panel. |
| `firestore.rules` | Reglas de seguridad de la base de datos. Se pegan en Firebase Console → Firestore → Reglas. |
| `css/style.css` | Estilos de ambas páginas (adaptativo a celular). |
| `img/` | Logo (flor). |
| `MANUAL.md`, `README.md` | Manual de usuario e instrucciones de instalación. |

## Datos (Firestore)

**`appointments/{id}`** — la cita completa (datos personales). Solo las administradoras ven la lista; una cita suelta se abre con su id (el enlace de la clienta).
`nombre, telefono, servicio, notas, fecha, hora, slotId, estado, creada` y, después: `avisada` (ya se le envió el mensaje), `respuesta` (`confirmo` / `cancelo`, lo que tocó la clienta), `slotLibre` (el panel ya liberó la hora de una cita que canceló la clienta).
Estados: `pendiente → confirmada → atendida`, o `cancelada`.

**`slots/{fecha_HHMM}`** — marca de hora ocupada, sin datos personales: `fecha, hora`.
El id es fijo (p. ej. `2026-11-20_1000`), así dos clientas no pueden reservar la misma hora: el segundo intento falla.

## Flujos

1. **Reservar (clienta):** elige servicio y día → `app.js` lee `slots` de ese día y ofrece solo las horas libres → al enviar, un `writeBatch` crea el `slot` y la `appointment` a la vez (todo o nada) → aparece la ventana de éxito.
2. **Atender (administradora):** inicia sesión → `admin.js` escucha `appointments` en tiempo real → "Pedir confirmación" abre WhatsApp con el mensaje y los enlaces Confirmar / Cancelar → la clienta abre `cita.html` y toca un botón → la cita cambia a confirmada o cancelada (si cancela, el panel libera el `slot` en una transacción); "Cancelar" libera el `slot`; "Atendida" cierra el servicio.
3. **Recordatorio:** botón "Recordar" (WhatsApp) y botón de Google Calendar con el evento prellenado.

**`ubicacion/{correo}`** — última ubicación (lat, lng, precisión) de cada cuenta en `TRACK_EMAILS`, mientras tenga el panel abierto y haya dado permiso. **`accesos/{id}`** — historial de aperturas del panel.

## Reglas de negocio

- Atención de lunes a sábado, 10:00 a 18:00 (última cita), una cita por hora. Domingo cerrado.
- No se agendan fechas pasadas ni horas de hoy que ya pasaron. Un aviso visible explica por qué una fecha u hora no está disponible.
- Los mensajes de WhatsApp se abren con `https://api.whatsapp.com/send?phone=52…&text=…` (así los emojis llegan bien en WhatsApp Web, escritorio y celular).

## Despliegue

`git push` a `main` → GitHub Pages compila y publica en 1–2 minutos
(`https://cealmeba.github.io/Chely-s-Spa-NAILS-STUDIO/`). Los scripts llevan `?v=AAAAMMDDx` para evitar archivos viejos en caché: al cambiar un `.js` o `.css`, sube ese número en el HTML.

## Límites y vida útil (planes gratuitos)

- GitHub Pages: sin vencimiento; 100 GB de tráfico al mes.
- Firebase Spark: 1 GB de datos, ~50 000 lecturas y 20 000 escrituras por día. Suficiente para años de uso de un negocio local.
- Mantenimiento recomendado: exportar o borrar citas antiguas periódicamente.
