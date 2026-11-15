# Chely's Spa Nails Studio – sitio de citas

HTML + JS puro. Hosting gratis en GitHub Pages, base de datos y login con Firebase (plan gratuito Spark).

## 1. Firebase (10 min)
1. https://console.firebase.google.com → **Crear proyecto**.
2. **Authentication → Comenzar** → habilita **Google** y **Correo/contraseña**.
3. **Authentication → Configuración → Dominios autorizados** → agrega `TU-USUARIO.github.io`.
4. **Firestore Database → Crear base de datos** (modo producción).
5. Pestaña **Reglas** → pega el contenido de `firestore.rules` (cambia `CORREO_ADMIN@gmail.com`) → **Publicar**.
6. **Configuración del proyecto → Tus apps → Web (`</>`)** → copia el objeto `firebaseConfig` a `js/firebase-config.js`
   y pon el mismo correo de admin en `ADMIN_EMAIL`.
7. Al probar por primera vez, Firestore pedirá crear un **índice** (aparece un enlace en la consola del navegador, F12). Da clic y créalo.

## 2. Publicar en GitHub Pages
Repo nuevo → sube todo → Settings → Pages → Branch `main` / root.

## Seguridad
- La config de Firebase es pública por diseño; lo que protege los datos son las **reglas** (clientes solo ven sus citas; solo la admin ve todas).
- La admin debe entrar con Google (correo verificado) usando el correo configurado.
- No subas contraseñas, ni archivos con datos de clientes.

## Uso de la administradora
Al iniciar sesión con su correo ve el panel: todas las citas, botones de WhatsApp (confirmar / recordar, abre el chat con mensaje listo) y cancelar.
