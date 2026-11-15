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
4. Verás el mensaje **"¡Cita solicitada! Te confirmaremos por WhatsApp."**

Importante:
- La cita queda como **pendiente** hasta que Chely la confirme por WhatsApp.
- Si dos personas intentan la misma hora, solo la primera se guarda. A la segunda le dirá que ese horario ya fue tomado y mostrará las horas que sigan libres.
- Para cancelar o cambiar una cita, la clienta escribe por WhatsApp al **271 120 6132**.

---

## 2. Para la administradora

### Entrar
1. Abre la dirección del panel (termina en `/admin.html`). No hay botón para llegar a ella desde la página pública. Guarda el enlace en favoritos.
2. Entra de una de estas formas:
   - **Continuar con Google**, con una cuenta autorizada como administradora.
   - **Usuario y contraseña**, si tu cuenta se creó de esa forma.
3. Si la cuenta no está autorizada, el panel no mostrará nada.

Para salir pulsa **Salir** (arriba a la derecha).

### Ver las citas
- Al entrar aparece la lista de citas desde la fecha de **"Ver desde"** (por defecto, hoy).
- Cambia la fecha y pulsa **Actualizar** para ver otros días.
- Cada cita muestra: nombre, servicio, día, hora, teléfono, notas y su estado:
  - **pendiente**: la clienta la pidió y falta confirmarla.
  - **confirmada**: ya se le confirmó.
  - **cancelada**: se canceló y la hora quedó libre otra vez.

### Confirmar una cita
1. Pulsa **WhatsApp: confirmar**. Se abre WhatsApp con el mensaje ya escrito para esa clienta.
2. Envía el mensaje.
3. La cita pasa a **confirmada**. Si no cambia, pulsa **Actualizar**.

### Recordar una cita
Pulsa **WhatsApp: recordar**. Se abre el chat con un recordatorio listo para enviar, sin cambiar el estado.

### Cancelar una cita
Pulsa **Cancelar** y acepta el aviso. La cita queda como cancelada y esa hora vuelve a estar disponible para otras clientas.

---

## 3. Preguntas frecuentes

**¿La clienta ve las citas de otras personas?**
No. Solo se comparte qué horas están ocupadas, sin nombres ni teléfonos. Los datos de las clientas los ve solo la administradora.

**¿Puedo cambiar los servicios o los horarios?**
Los servicios y las horas (10:00 a 18:00) están en el archivo `js/app.js`. Hay que editarlo y subir el cambio a GitHub.

**¿Cuánto cuesta?**
Nada: GitHub Pages y el plan gratuito de Firebase (Spark) alcanzan para un negocio de este tamaño.

**Una clienta dice que no puede reservar.**
Que revise que el WhatsApp tenga 10 dígitos y que haya elegido una hora de la lista. Si dice "No se pudo consultar", que recargue la página.

---

## 4. Para quien mantiene el sitio (técnico)

- **Código:** https://github.com/CEALMEBA/Chely-s-Spa-NAILS-STUDIO. Cada vez que se sube un cambio a `main`, la página se actualiza en 1 o 2 minutos.
- **Base de datos y acceso:** proyecto de Firebase `chelys-spa` (Authentication y Firestore).
- **Reglas de seguridad:** `firestore.rules`. Cualquiera puede crear una cita y ver las horas ocupadas. Solo la administradora puede leer, confirmar o cancelar citas. Al cambiarlas hay que pegarlas también en Firebase → Firestore → Reglas → Publicar.
- **Agregar otra administradora:** añadir su correo (Google) o su ID de usuario a las reglas y a `js/firebase-config.js`.
- **Índice de Firestore:** la primera vez que se abra el panel puede pedir un índice. En la consola del navegador (F12) aparece un enlace; al abrirlo y pulsar **Crear** queda listo en unos minutos.
- **Seguridad:** no subir contraseñas al repositorio. Usar contraseñas largas para el panel.
