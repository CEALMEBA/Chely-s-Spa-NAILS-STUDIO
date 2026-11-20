// Aviso al celular de la administradora vía ntfy.sh. Nunca incluye datos personales (nombre ni teléfono).
import { NTFY_TOPIC } from "./firebase-config.js?v=20261119";

export function avisarCelular(titulo, mensaje, tags = "bell") {
  if (!NTFY_TOPIC) return;
  try {
    fetch("https://ntfy.sh/", {
      method: "POST", keepalive: true,
      body: JSON.stringify({
        topic: NTFY_TOPIC, title: titulo, message: mensaje, priority: 4, tags: [tags],
        click: new URL("admin.html", location.href).href
      })
    }).catch(() => { /* sin conexión: el aviso es opcional */ });
  } catch { /* ignorar */ }
}
