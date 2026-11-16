import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithPopup, GoogleAuthProvider,
  signInWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, doc, writeBatch, query, where, orderBy, getDocs, updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig, ADMIN_EMAILS } from "./firebase-config.js";
import { ICONOS, categoriaDe } from "./catalogo.js";

const $ = (id) => document.getElementById(id);
let auth = null, db = null;
try {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app); db = getFirestore(app);
} catch (e) { console.warn("Firebase no configurado:", e.message); }

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
// Fecha local (no UTC): en México, después de las 18:00, toISOString() ya da el día siguiente.
const hoy = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const fmtFecha = (f) => new Date(f + "T12:00:00").toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
const waLink = (tel, texto) => `https://wa.me/52${tel}?text=${encodeURIComponent(texto)}`;
// Recordatorio para la administradora: abre Google Calendar con el evento listo (1 h, hora de México).
// Google Calendar avisa antes de la cita según las notificaciones del calendario (por defecto 30 min).
const calLink = (c) => {
  const ini = c.fecha.replace(/-/g, "") + "T" + c.hora.replace(":", "") + "00";
  const h = String(Number(c.hora.slice(0, 2)) + 1).padStart(2, "0");
  const fin = c.fecha.replace(/-/g, "") + "T" + h + c.hora.slice(3, 5) + "00";
  const p = new URLSearchParams({
    action: "TEMPLATE", text: `${c.servicio} · ${c.nombre}`, dates: `${ini}/${fin}`, ctz: "America/Mexico_City",
    details: `Clienta: ${c.nombre}\nWhatsApp: ${c.telefono}${c.notas ? "\nNotas: " + c.notas : ""}`,
    location: "Chely's Spa Nails Studio, Av. 7 Poniente No. 303, Col. Centro"
  });
  return "https://calendar.google.com/calendar/render?" + p;
};
const msg = (el, t) => { el.textContent = t; el.className = "msg"; };

$("adminDesde").value = hoy();
$("btnLogout").onclick = () => signOut(auth);
$("btnGoogle").onclick = () => signInWithPopup(auth, new GoogleAuthProvider()).catch(e => msg($("loginMsg"), e.message));
$("btnEntrar").onclick = () => signInWithEmailAndPassword(auth, $("email").value, $("pass").value)
  .catch(() => msg($("loginMsg"), "Correo o contraseña incorrectos"));

const esAdmin = (u) => u && u.emailVerified && ADMIN_EMAILS.includes(u.email);
if (!auth) msg($("loginMsg"), "Firebase no está configurado (js/firebase-config.js).");
else onAuthStateChanged(auth, (u) => {
  const ok = esAdmin(u);
  $("loginBox").hidden = !!u; $("btnLogout").hidden = !u;
  $("adminArea").hidden = !ok;
  if (u && !ok) { msg($("loginMsg"), "Esta cuenta no es de administradora."); signOut(auth); }
  if (ok) cargarAdmin();
});

/* ---------- Panel admin ---------- */
async function cargarAdmin() {
  // Solo orderBy("fecha") para no depender de un índice compuesto; la hora se ordena aquí.
  const q = query(collection(db, "appointments"), where("fecha", ">=", $("adminDesde").value || hoy()), orderBy("fecha"));
  let lista;
  try {
    lista = (await getDocs(q)).docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.error(e);
    $("adminCitas").innerHTML = `<p class="msg">No se pudieron cargar las citas (${esc(e.code || e.message)}).</p>`;
    return;
  }
  lista.sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
  const hoyStr = hoy();
  $("adminCitas").innerHTML = !lista.length ? "<p>Sin citas.</p>" : lista.map(c => {
    const cat = categoriaDe(c.servicio);
    const ico = cat ? ICONOS[cat.ico] : ICONOS.esmalte;
    const estilo = cat ? `--c:${cat.color};--t:${cat.tx}` : "";
    // Un solo botón de WhatsApp: confirmar si está pendiente, recordar si ya se confirmó.
    const wa = c.estado === "pendiente"
      ? `<a class="btn small wa" target="_blank" rel="noopener" data-conf="${c.id}" href="${waLink(esc(c.telefono),
          `Hola ${c.nombre}, te confirmamos tu cita en Chely's Spa: ${c.servicio}, ${fmtFecha(c.fecha)} a las ${c.hora}. ¡Te esperamos!`)}">Confirmar por WhatsApp</a>`
      : c.estado === "confirmada"
      ? `<a class="btn small wa" target="_blank" rel="noopener" href="${waLink(esc(c.telefono),
          `Hola ${c.nombre}, te recordamos tu cita de ${c.servicio} el ${fmtFecha(c.fecha)} a las ${c.hora} en Chely's Spa.`)}">Recordar por WhatsApp</a>`
      : "";
    const cal = c.estado !== "cancelada"
      ? `<a class="btn small cal" target="_blank" rel="noopener" href="${calLink(c)}">Agregar a mi calendario</a>` : "";
    return `<div class="cita ${c.estado}${c.fecha === hoyStr ? " hoy" : ""}" style="${estilo}">
      <div class="ci">${ico}</div>
      <div class="info">
        <div><b>${esc(c.nombre)}</b> <span class="badge ${c.estado}">${c.estado}</span>${c.fecha === hoyStr ? ' <span class="badge hoy">HOY</span>' : ""}</div>
        <div class="srv">${esc(c.servicio)}</div>
        <div>${fmtFecha(c.fecha)} · <b>${esc(c.hora)}</b></div>
        <div>Tel: ${esc(c.telefono)}${c.notas ? " · Nota: " + esc(c.notas) : ""}</div>
        <div class="acts">${wa}${cal}
          ${c.estado !== "cancelada" ? `<button class="btn small gray" data-adm-cancel="${c.id}" data-slot="${c.slotId}">Cancelar</button>` : ""}
        </div>
      </div></div>`;
  }).join("");
}
$("adminRefrescar").onclick = cargarAdmin;
$("adminCitas").addEventListener("click", async (e) => {
  if (e.target.dataset.conf) {
    await updateDoc(doc(db, "appointments", e.target.dataset.conf), { estado: "confirmada" });
    setTimeout(cargarAdmin, 500);
  }
  if (e.target.dataset.admCancel) {
    if (!confirm("¿Cancelar esta cita?")) return;
    const b = writeBatch(db);
    b.update(doc(db, "appointments", e.target.dataset.admCancel), { estado: "cancelada" });
    b.delete(doc(db, "slots", e.target.dataset.slot));
    await b.commit(); cargarAdmin();
  }
});
