import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, doc, writeBatch, query, where, orderBy, getDocs,
  serverTimestamp, updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js?v=20261116";
import { ICONOS, CATALOGO, categoriaDe } from "./catalogo.js?v=20261116";

let db = null;
try {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
} catch (e) {
  console.warn("Firebase no configurado (edita js/firebase-config.js):", e.message);
}
const $ = (id) => document.getElementById(id);

/* ---------- Horarios ---------- */
const HORAS = []; // 10:00 a 18:00 (última cita, cierra 19:00)
for (let h = 10; h <= 18; h++) HORAS.push(String(h).padStart(2, "0") + ":00");

$("grid").innerHTML = CATALOGO.map(c =>
  `<div class="cat" style="--c:${c.color};--t:${c.tx}"><div class="ci">${ICONOS[c.ico]}</div><h3>${c.cat}</h3><ul>${c.items.map(i => `<li>${i}</li>`).join("")}</ul></div>`).join("");
$("servicio").innerHTML = CATALOGO.flatMap(c =>
  [`<optgroup label="${c.cat}">`, ...c.items.map(i => `<option>${c.cat.split(" ")[0]} - ${i}</option>`), `</optgroup>`]).join("");

/* ---------- Utilidades ---------- */
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
// Fecha local (no UTC): en México, después de las 18:00, toISOString() ya da el día siguiente.
const hoy = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const fmtFecha = (f) => new Date(f + "T12:00:00").toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
const waLink = (tel, texto) => `https://api.whatsapp.com/send?phone=52${tel}&text=${encodeURIComponent(texto)}`;
const msg = (el, t, ok) => { el.textContent = t; el.className = "msg" + (ok ? " ok" : ""); };

$("fecha").min = hoy();

/* ---------- Horarios disponibles ---------- */
$("fecha").addEventListener("change", async () => {
  const f = $("fecha").value;
  if (!f) return;
  if (!db) { $("hora").innerHTML = `<option value="">Sistema no configurado</option>`; return; }
  if (new Date(f + "T12:00:00").getDay() === 0) {
    $("hora").innerHTML = `<option value="">Domingo cerrado</option>`; return;
  }
  $("hora").innerHTML = `<option value="">Consultando…</option>`;
  let ocupadas;
  try {
    const q = query(collection(db, "slots"), where("fecha", "==", f));
    ocupadas = new Set((await getDocs(q)).docs.map(d => d.data().hora));
  } catch { $("hora").innerHTML = `<option value="">No se pudo consultar</option>`; return; }
  const libres = HORAS.filter(h => !ocupadas.has(h));
  $("hora").innerHTML = libres.length
    ? libres.map(h => `<option>${h}</option>`).join("")
    : `<option value="">Sin horarios libres ese día</option>`;
});

/* ---------- Reservar ---------- */
$("formCita").addEventListener("submit", async (e) => {
  e.preventDefault();
  const fecha = $("fecha").value, hora = $("hora").value;
  if (!hora) return msg($("msg"), "Elige un horario disponible");
  if (!db) return msg($("msg"), "El sistema de citas aún no está configurado.");
  const slotId = `${fecha}_${hora.replace(":", "")}`;
  try {
    const citaRef = doc(collection(db, "appointments"));
    const b = writeBatch(db);
    b.set(doc(db, "slots", slotId), { fecha, hora });
    b.set(citaRef, {
      nombre: $("nombre").value.trim(),
      telefono: $("telefono").value, servicio: $("servicio").value, notas: $("notas").value,
      fecha, hora, slotId, estado: "pendiente", creada: serverTimestamp()
    });
    await b.commit();
    msg($("msg"), "");
    mostrarExito({ nombre: $("nombre").value.trim(), telefono: $("telefono").value, servicio: $("servicio").value, fecha, hora });
    $("formCita").reset(); $("hora").innerHTML = "";
  } catch (err) {
    console.error(err);
    msg($("msg"), err.code === "permission-denied"
      ? "Ese horario ya fue tomado o algún dato no es válido. Revisa e intenta de nuevo."
      : "No se pudo reservar (" + (err.code || "error de conexión") + "). Intenta de nuevo.");
    $("fecha").dispatchEvent(new Event("change"));
  }
});


/* ---------- Aviso de cita agendada ---------- */
function mostrarExito(c) {
  const cat = categoriaDe(c.servicio);
  const [catNombre, srv] = String(c.servicio).split(" - ");
  const dlg = $("okCita");
  dlg.style.cssText = cat ? `--c:${cat.color};--t:${cat.tx}` : "";
  $("okHola").textContent = `Gracias, ${c.nombre.split(" ")[0]} 🌸 Ya tenemos tu solicitud.`;
  $("okResumen").innerHTML = `
    <div class="ci">${ICONOS[cat ? cat.ico : "esmalte"]}</div>
    <div><b>${esc(srv || catNombre)}</b><small>${esc(srv ? (cat ? cat.cat : catNombre) : "")}</small>
    <span>📅 ${esc(fmtFecha(c.fecha))} · 🕐 ${esc(c.hora)}</span></div>`;
  $("okTel").textContent = c.telefono.replace(/(\d{3})(\d{3})(\d{4})/, "$1 $2 $3");
  if (dlg.showModal) dlg.showModal(); else dlg.setAttribute("open", "");
}
$("okCerrar").addEventListener("click", () => $("okCita").close ? $("okCita").close() : $("okCita").removeAttribute("open"));
$("okCita").addEventListener("click", (e) => { if (e.target === $("okCita")) $("okCita").close(); });
