// Página que abre la clienta desde el enlace de WhatsApp: cita.html?id=<id de la cita>&a=confirmar|cancelar
// Nunca cambia nada al abrirse: la clienta siempre tiene que tocar un botón.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig, WHATSAPP_NEGOCIO } from "./firebase-config.js?v=20261116";
import { ICONOS, categoriaDe } from "./catalogo.js?v=20261116";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
const hoy = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const fmtFecha = (f) => new Date(f + "T12:00:00").toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });

const ICO = {
  ok: `<svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="24"/><path d="M15 27l7 7 15-15"/></svg>`,
  x: `<svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="24"/><path d="M18 18l16 16M34 18 18 34"/></svg>`,
  q: `<svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="24"/><path d="M26 14v14l8 5"/></svg>`
};

const params = new URLSearchParams(location.search);
const id = params.get("id") || "";
const accion = params.get("a");
let ref = null, cita = null;

$("rWa").href = `https://api.whatsapp.com/send?phone=${WHATSAPP_NEGOCIO}`;

function ver(tono, titulo, texto) {
  $("rCargando").hidden = true; $("rCaja").hidden = false;
  $("rIcono").className = "resp-ico " + tono;
  $("rIcono").innerHTML = ICO[tono === "bien" ? "ok" : tono === "mal" ? "x" : "q"];
  $("rTitulo").textContent = titulo;
  $("rTexto").textContent = texto;
  $("rMsg").textContent = "";
}

function resumen() {
  const cat = categoriaDe(cita.servicio);
  const [catNombre, srv] = String(cita.servicio || "").split(" - ");
  const el = $("rResumen");
  el.style.cssText = cat ? `--c:${cat.color};--t:${cat.tx}` : "";
  el.innerHTML = `
    <div class="ci">${ICONOS[cat ? cat.ico : "esmalte"]}</div>
    <div><b>${esc(srv || catNombre)}</b><small>${esc(srv ? (cat ? cat.cat : catNombre) : "")}</small>
    <span>📅 ${esc(fmtFecha(cita.fecha))} · 🕐 ${esc(cita.hora)}</span></div>`;
  el.hidden = false;
}

function pintar(pedirSeguro = false) {
  const nombre = String(cita.nombre || "").split(" ")[0];
  const pasada = cita.fecha < hoy();
  const activa = !pasada && (cita.estado === "pendiente" || cita.estado === "confirmada");
  resumen();
  $("rBotones").hidden = !activa || pedirSeguro;
  $("rSeguro").hidden = !activa || !pedirSeguro;
  $("rConfirmar").hidden = cita.estado !== "pendiente";
  $("rAgendar").hidden = activa;

  if (cita.estado === "cancelada") ver("mal", "Cita cancelada", "Esta cita fue cancelada. Si quieres, puedes agendar otra cuando gustes.");
  else if (cita.estado === "atendida") ver("bien", "¡Gracias por tu visita!", "Esta cita ya fue atendida. Te esperamos pronto. 💖");
  else if (pasada) ver("duda", "Esta cita ya pasó", "La fecha de esta cita ya pasó. Puedes agendar una nueva.");
  else if (cita.estado === "confirmada") ver("bien", "¡Tu cita está confirmada!", `${nombre ? nombre + ", te" : "Te"} esperamos puntual. Si ya no puedes asistir, cancélala aquí para liberar la hora.`);
  else ver("duda", `Hola${nombre ? ", " + nombre : ""} 🌸`, "Por favor confirma tu cita, o cancélala si ya no podrás asistir.");
}

async function responder(estado, respuesta) {
  const botones = document.querySelectorAll(".resp-btns button");
  botones.forEach(b => b.disabled = true);
  $("rMsg").textContent = "Guardando…";
  try {
    await updateDoc(ref, { estado, respuesta });
    cita.estado = estado;
    pintar();
  } catch (e) {
    console.error(e);
    // Lo más probable: la cita cambió mientras la página estaba abierta. Se vuelve a leer.
    try { const s = await getDoc(ref); if (s.exists()) { cita = s.data(); pintar(); } } catch { /* sin conexión */ }
    $("rMsg").textContent = "No se pudo guardar. Revisa tu conexión e intenta de nuevo, o escríbenos por WhatsApp.";
  }
  botones.forEach(b => b.disabled = false);
}

$("rConfirmar").onclick = () => responder("confirmada", "confirmo");
$("rCancelar").onclick = () => pintar(true);
$("rNoCancelar").onclick = () => pintar();
$("rSiCancelar").onclick = () => responder("cancelada", "cancelo");

const noEncontrada = () => {
  ver("duda", "No encontramos tu cita", "El enlace no es válido o la cita ya fue borrada. Escríbenos por WhatsApp y con gusto te ayudamos.");
  $("rAgendar").hidden = false;
};

(async () => {
  if (!/^[A-Za-z0-9]{10,40}$/.test(id)) return noEncontrada();
  try {
    ref = doc(getFirestore(initializeApp(firebaseConfig)), "appointments", id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return noEncontrada();
    cita = snap.data();
    pintar(accion === "cancelar");
  } catch (e) {
    console.error(e);
    ver("duda", "No se pudo abrir tu cita", "Revisa tu conexión y vuelve a abrir el enlace, o escríbenos por WhatsApp.");
  }
})();
