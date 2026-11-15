import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, doc, writeBatch, query, where, orderBy, getDocs,
  serverTimestamp, updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

let db = null;
try {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
} catch (e) {
  console.warn("Firebase no configurado (edita js/firebase-config.js):", e.message);
}
const $ = (id) => document.getElementById(id);

/* ---------- Servicios (del folleto) ---------- */
const CATALOGO = [
  { cat: "Barbería · Lady Barber", color: "#dcf0f3", tx: "#0b6b78",
    items: ["Corte de pelo", "Lavado", "Corte de barba", "Corte para niños"] },
  { cat: "Pestañas", color: "#eee3f6", tx: "#6b2fa5",
    items: ["Clásicas", "Efecto rímel", "Volumen", "Híbridas"] },
  { cat: "Uñas", color: "#fbe3ec", tx: "#a3125c",
    items: ["Manicura", "Gelish", "Espejo", "Pedicura", "Acripie", "Tornasol", "Acrílicas", "Baño acrílico", "Encapsulados"] },
  { cat: "Masajes", color: "#ffead6", tx: "#b84a0c",
    items: ["Relajantes", "Descontracturantes", "Deportivos"] },
  { cat: "Aparatos", color: "#e6f0da", tx: "#2e6b12",
    items: ["Compresas calientes", "Electrodos", "Lámpara infrarroja", "Pistola masajeadora"] },
  { cat: "Te atendemos dolores en", color: "#eee3f6", tx: "#6b2fa5",
    items: ["Espalda", "Columna", "Hombro", "Tobillo", "Ciática", "Y más"] }
];
const HORAS = []; // 10:00 a 18:00 (última cita, cierra 19:00)
for (let h = 10; h <= 18; h++) HORAS.push(String(h).padStart(2, "0") + ":00");

$("grid").innerHTML = CATALOGO.map(c =>
  `<div class="cat" style="background:${c.color}"><h3 style="color:${c.tx}">${c.cat}</h3><ul>${c.items.map(i => `<li>${i}</li>`).join("")}</ul></div>`).join("");
$("servicio").innerHTML = CATALOGO.flatMap(c =>
  [`<optgroup label="${c.cat}">`, ...c.items.map(i => `<option>${c.cat.split(" ")[0]} - ${i}</option>`), `</optgroup>`]).join("");

/* ---------- Utilidades ---------- */
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
const hoy = () => new Date().toISOString().slice(0, 10);
const fmtFecha = (f) => new Date(f + "T12:00:00").toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
const waLink = (tel, texto) => `https://wa.me/52${tel}?text=${encodeURIComponent(texto)}`;
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
    msg($("msg"), "¡Cita solicitada! Te confirmaremos por WhatsApp.", true);
    $("formCita").reset(); $("hora").innerHTML = "";
  } catch {
    msg($("msg"), "Ese horario ya fue tomado. Elige otro.");
    $("fecha").dispatchEvent(new Event("change"));
  }
});

