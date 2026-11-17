# Manual de usuario – Chely's Spa Nails Studio

Sitio: https://cealmeba.github.io/Chely-s-Spa-NAILS-STUDIO/
Panel de la administradora: https://cealmeba.github.io/Chely-s-Spa-NAILS-STUDIO/admin.html

---

## 1. Para las clientas (agendar una cita)

No hace falta crear cuenta ni iniciar sesión.

1. Abre la página y baja a **Agenda tu cita** (o pulsa "Agendar cita" en el menú).
2. Llena el formulario:
   - **Tu nombre**
   - **Tu WhatsApp** (10 dígitos, sin espacios). Ahí recibirás la confirmación.
   - **Servicio**: elige de la lista (barbería, pestañas, uñas, masajes, aparatos…).
   - **Día**: de lunes a sábado. Los domingos están cerrados.
   - **Hora**: solo aparecen las horas **libres** de ese día (10:00 a 18:00). Si una hora no aparece, ya está ocupada.
   - **Notas** (opcional): por ejemplo "primera vez" o el diseño que quieres.
3. Pulsa **Reservar**.
4. Aparece una ventana con una palomita verde: **"¡Tu cita fue agendada!"**, el resumen (servicio con su ícono, día y hora) y el aviso de que recibirá un WhatsApp con un enlace para confirmar su cita. Se cierra con **¡Entendido!**

Importante:
- La cita queda como **pendiente**. Chely le manda un WhatsApp con dos enlaces: **Confirmar cita** y **Cancelar cita**. Al abrir uno ve su cita y los botones; la cita cambia sola en el panel cuando toca uno.
- Si dos personas intentan la misma hora, solo la primera se guarda. A la segunda le dirá que ese horario ya fue tomado y mostrará las horas que sigan libres.
- Para cancelar, la clienta usa el enlace **Cancelar cita** de su mensaje. Para cambiarla, escribe por WhatsApp al **271 120 6132**.

---

## 2. Para la administradora

### Entrar
1. Abre la dirección del panel (termina en `/admin.html`). No hay botón para llegar a ella desde la página pública. Guarda el enlace en favoritos.
2. Entra de una de estas formas:
   - **Continuar con Google**, con una cuenta autorizada como administradora.
   - **Usuario y contraseña**, si tu cuenta se creó de esa forma.
3. Si la cuenta no está autorizada, el panel no mostrará nada.

Para salir pulsa **Salir** (arriba a la derecha).

### Pantalla principal
Al entrar verás un saludo con la fecha de hoy y la marca **En vivo**: las citas nuevas aparecen solas, sin recargar, y sale el aviso "Llegó una cita nueva". Si la marca se pone gris, se perdió la conexión; recarga la página.

Arriba hay cuatro recuadros de resumen (puedes tocarlos para filtrar):
- **Citas hoy**
- **Por confirmar** (pendientes)
- **Confirmadas**
- **Próximos 7 días**

### Buscar y filtrar
- **Todas / Hoy / Mañana / 7 días**: elige qué días ver.
- **Activas / Pendientes / Confirmadas / Atendidas / Canceladas**: elige el estado. "Activas" muestra las pendientes y confirmadas.
- **Buscar**: escribe el nombre, teléfono o servicio de la clienta.
- **Desde**: la fecha a partir de la cual se cargan citas (por defecto, hoy). Cámbiala para ver días anteriores.

Las citas se agrupan por día y se ordenan por hora. Cada una muestra hora, estado, ícono del servicio, nombre, servicio, teléfono y notas. Los estados son:
- **pendiente**: la clienta la pidió y falta confirmarla.
- **confirmada**: la clienta la confirmó desde su enlace (o Chely la confirmó a mano).
- **atendida**: la clienta ya recibió su servicio.
- **cancelada**: se canceló y la hora quedó libre otra vez.

### Confirmar una cita (pendiente)
1. Pulsa **Pedir confirmación**. Se abre WhatsApp con el mensaje ya escrito, que incluye los enlaces **Confirmar cita** y **Cancelar cita**.
2. Envía el mensaje. La tarjeta mostrará "Mensaje enviado · esperando respuesta" y el botón cambia a **Reenviar**.
3. Cuando la clienta toca **Confirmar cita**, la cita pasa a **confirmada** sola y sale el aviso "… confirmó su cita". Si toca **Cancelar cita**, pasa a **cancelada** y la hora se libera.
4. Si la clienta te confirmó por otro medio (llamada, mensaje), pulsa **Confirmar** para marcarla a mano.

Notas:
- WhatsApp no permite botones dentro del mensaje (eso solo existe en la API de paga de WhatsApp Business); por eso van como enlaces que abren una página con los botones.
- Si la clienta no tiene guardado el número del negocio, WhatsApp puede mostrar los enlaces sin poder tocarlos hasta que responda el mensaje o agregue el contacto.
- Cuando la clienta cancela, la hora se libera en cuanto el panel esté abierto en algún dispositivo (el panel es quien la libera).

### Recordar una cita (confirmada)
Pulsa **Recordar**. Se abre el chat con un recordatorio listo para enviar, sin cambiar el estado. Incluye el enlace **Cancelar cita** por si ya no puede asistir.

### Cómo son los mensajes de WhatsApp
Ambos mensajes son profesionales e incluyen: nombre del negocio, saludo, servicio, fecha, hora, dirección, una frase según el servicio, el aviso **"¡No se te olvide asistir!"** y cómo cambiar la cita. El ícono cambia según el servicio:

| Servicio | Ícono |
|---|---|
| Barbería | 💈 |
| Pestañas | 👁️ (incluye: venir sin maquillaje en los ojos) |
| Uñas | 💅 |
| Masajes | 💆‍♀️ (incluye: venir con ropa cómoda) |
| Aparatos | 🔆 |
| Dolores | 🩺 |

Los textos están en `js/admin.js` (sección "Mensajes de WhatsApp").

### Marcar un servicio como atendido
Cuando la clienta ya vino y terminaste, pulsa **Atendida** (botón azul). La cita queda en estado **atendida**, sale de la lista de "Activas" y se ve en el filtro **Atendidas**. Si lo pulsaste por error, toca **Deshacer** y vuelve a confirmada.

### Agregar la cita a tu calendario
Pulsa **Calendario**. Se abre Google Calendar con el evento listo (1 hora, con nombre, servicio, WhatsApp y notas). Guárdalo y Google te avisará antes de la cita.

### Cancelar una cita
Pulsa **Cancelar**. En la misma tarjeta aparece la pregunta "¿Cancelar la cita…?": pulsa **Sí, cancelar** (o **No** para dejarla). La cita queda como cancelada y esa hora vuelve a estar disponible para otras clientas.

---

## 3. Preguntas frecuentes

**¿La clienta ve las citas de otras personas?**
No. Solo se comparte qué horas están ocupadas, sin nombres ni teléfonos. Los datos de las clientas los ve solo la administradora.

**¿Puedo cambiar los servicios o los horarios?**
Los servicios están en `js/catalogo.js` y las horas (10:00 a 18:00) en `js/app.js`. Hay que editarlo y subir el cambio a GitHub.

**¿Cuánto cuesta?**
Nada: GitHub Pages y el plan gratuito de Firebase (Spark) alcanzan para un negocio de este tamaño.

**Una clienta dice que no puede reservar.**
Que revise que el WhatsApp tenga 10 dígitos y que haya elegido una hora de la lista. Si dice "No se pudo consultar", que recargue la página.

---

## 4. Para quien mantiene el sitio (técnico)

- **Código:** https://github.com/CEALMEBA/Chely-s-Spa-NAILS-STUDIO. Cada vez que se sube un cambio a `main`, la página se actualiza en 1 o 2 minutos.
- **Base de datos y acceso:** proyecto de Firebase `chelys-spa` (Authentication y Firestore).
- **Reglas de seguridad:** `firestore.rules`. Cualquiera puede crear una cita y ver las horas ocupadas. Solo la administradora ve la lista de citas; la clienta puede abrir, confirmar o cancelar **su** cita con el enlace que recibe (`cita.html?id=…`). Al cambiarlas hay que pegarlas también en Firebase → Firestore → Reglas → Publicar.
- **Agregar otra administradora:** añadir su correo (Google) o su ID de usuario a las reglas y a `js/firebase-config.js`.
- **Índice de Firestore:** no hace falta; el panel solo ordena por fecha y la hora se ordena en el navegador.
- **Versión de archivos (caché):** los enlaces a CSS y JS llevan `?v=AAAAMMDD` (en `index.html`, `admin.html` y en los `import` de `js/admin.js` y `js/app.js`). Al cambiar un archivo, cambia su número (o agrega una letra, p. ej. `20261116b`) donde se cargue, para que los celulares no usen la versión vieja guardada.
- **Estilos y `hidden`:** `css/style.css` empieza con `[hidden]{display:none!important}`. No lo quites: sin esa regla el panel se queda en "Cargando…" y muestra el login aunque ya hayas iniciado sesión.
- **Seguridad:** no subir contraseñas al repositorio. Usar contraseñas largas para el panel.
