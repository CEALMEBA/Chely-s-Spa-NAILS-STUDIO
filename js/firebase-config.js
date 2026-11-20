// Pega aquí la configuración de tu app web de Firebase (Console > Configuración del proyecto > Tus apps).
// Estos valores NO son secretos: la seguridad la dan las reglas de Firestore (firestore.rules).
export const firebaseConfig = {
  apiKey: "AIzaSyASjZrSCRMM_9YCHvjveuDfjx9EQpqm0lE",
  authDomain: "chelys-spa.firebaseapp.com",
  projectId: "chelys-spa",
  appId: "1:175430280671:web:dc16d677cfa03ea564506a"
};

// Correo de la administradora (solo para mostrar el panel; la seguridad real está en firestore.rules).
export const ADMIN_EMAILS = ["cesamendoza19@gmail.com", "araceltruji1984@gmail.com"];

export const WHATSAPP_NEGOCIO = "522711206132";

// Avisos al celular de la administradora con ntfy.sh (gratis): instala la app "ntfy" y suscríbete a este tema.
// El tema funciona como contraseña: no lo compartas. Los avisos NO llevan nombre ni teléfono de la clienta.
export const NTFY_TOPIC = "chelys-5a56be5cf26ad1df";

// Cuentas cuya ubicación se registra al abrir el panel (las dos admins).
export const TRACK_EMAILS = ["cesamendoza19@gmail.com", "araceltruji1984@gmail.com"];

// Cuentas que pueden ENTRAR a la página de rastreo (rastreo.html) y ver la ubicación de todas. Por ahora solo tú.
export const RASTREO_EMAILS = ["cesamendoza19@gmail.com"];
