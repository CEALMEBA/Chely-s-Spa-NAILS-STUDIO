# Chely's Spa Nails Studio – sitio de citas

HTML + JS puro. Hosting gratis en GitHub Pages, base de datos y login con Firebase (plan gratuito Spark).

## 1. Firebase (10 min)
1. https://console.firebase.google.com → **Crear proyecto**.
2. **Authentication → Comenzar** → habilita **Google** y **Correo/contraseña**.
3. **Authentication → Configuración → Dominios autorizados** → agrega `TU-USUARIO.github.io`.
4. **Firestore Database → Crear base de datos** (modo producción).
5. Pestaña **Reglas** → pega el contenido de `firestore.rules` (pon los correos de las administradoras en `isAdmin()`) → **Publicar**.
6. **Configuración del proyecto → Tus apps → Web (`</>`)** → copia el objeto `firebaseConfig` a `js/firebase-config.js`
   y pon los mismos correos en `ADMIN_EMAILS`.

## 2. Publicar en GitHub Pages
Repo nuevo → sube todo → Settings → Pages → Branch `main` / root.

## Seguridad
- La config de Firebase es pública por diseño; lo que protege los datos son las **reglas** (cualquiera puede pedir una cita y ver qué horas están ocupadas; solo la admin ve la lista de citas; cada clienta puede confirmar o cancelar la suya con el enlace que recibe por WhatsApp).
- La admin debe entrar con Google (correo verificado) usando el correo configurado.
- No subas contraseñas, ni archivos con datos de clientes.

## Uso de la administradora
Al iniciar sesión ve el panel en vivo: resumen del día, filtros por fecha y estado, búsqueda y las citas agrupadas por día. Cada cita tiene botones para **Pedir confirmación** o **Recordar** por WhatsApp (mensaje con emoji según el servicio y enlaces para que la clienta confirme o cancele ella misma), **Atendida** (marca el servicio como realizado), **Calendario** (Google Calendar) y **Cancelar** (libera la hora).

Guía completa: [MANUAL.md](MANUAL.md).

## Archivos
- `index.html`, `js/app.js`: página pública y formulario de citas.
- `cita.html`, `js/cita.js`: página donde la clienta confirma o cancela su cita (enlace del WhatsApp).
- `admin.html`, `js/admin.js`: panel de la administradora y mensajes de WhatsApp.
- `js/catalogo.js`: servicios e iconos.
- `js/firebase-config.js`: configuración de Firebase y correos de administradoras.
- `firestore.rules`: reglas de seguridad.
