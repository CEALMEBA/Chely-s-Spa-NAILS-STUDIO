import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithPopup, GoogleAuthProvider,
  signInWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, doc, writeBatch, query, where, orderBy, onSnapshot, updateDoc, runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig, ADMIN_EMAILS } from "./firebase-config.js?v=20261116";
import { ICONOS, categoriaDe } from "./catalogo.js?v=20261116";

const $ = (id) => document.getElementById(id);
let auth = null, db = null;
try {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app); db = getFirestore(app);
} catch (e) { console.warn("Firebase no configurado:", e.message); }

/* ---------- Utilidades ---------- */
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
// Fecha local (no UTC): en México, después de las 18:00, toISOString() ya da el día siguiente.
const iso = (d) => { d = new Date(d); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const hoy = () => iso(new Date());
const masDias = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };
const fmtFecha = (f) => new Date(f + "T12:00:00").toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
const waLink = (tel, texto) => `https://api.whatsapp.com/send?phone=52${tel}&text=${encodeURIComponent(texto)}`;
const msg = (el, t) => { el.textContent = t; el.className = "msg"; };
const toast = (t) => {
  const el = $("toast"); el.textContent = t; el.classList.add("show");
  clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove("show"), 2600);
};

// Recordatorio para la administradora: abre Google Calendar con el evento listo (1 h, hora de México).
// El aviso usa las notificaciones predeterminadas de su Google Calendar (p. ej. 10 min antes).
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

/* ---------- Mensajes de WhatsApp ---------- */
// Emoji y frase según la categoría del servicio (primera palabra de la categoría en catalogo.js).
const ESTILO_WA = {
  "Barbería": { e: "💈", f: "✂️ Te dejaremos con un look impecable y a tu estilo." },
  "Pestañas": { e: "👁️", f: "✨ Para un mejor resultado, te recomendamos venir sin maquillaje en los ojos." },
  "Uñas":     { e: "💅", f: "💖 Prepárate para lucir unas uñas espectaculares." },
  "Masajes":  { e: "💆‍♀️", f: "🌿 Ven con ropa cómoda y prepárate para un momento de relajación total." },
  "Aparatos": { e: "🔆", f: "🌿 Un tratamiento pensado para tu bienestar y recuperación." },
  "Te":       { e: "🩺", f: "🤍 Al llegar, cuéntanos tus molestias para darte la mejor atención." }
};
const estiloWa = (servicio) => ESTILO_WA[String(servicio || "").split(" - ")[0]] || { e: "🌸", f: "💖 Será un gusto atenderte." };

// Enlace a la página donde la clienta confirma o cancela (cita.html). WhatsApp no permite botones
// reales en mensajes enviados por enlace, así que van como enlaces que abren los botones.
const enlaceCita = (c) => new URL(`cita.html?${c.id}`, location.href).href;

// tipo "pedir": cita pendiente, se le pide a la clienta confirmar o cancelar.
// tipo "recordar": cita ya confirmada, recordatorio con enlace para cancelar.
const mensajeWa = (c, tipo) => {
  const { e, f } = estiloWa(c.servicio);
  const srv = String(c.servicio || "").split(" - ").pop();
  const encabezado = tipo === "pedir"
    ? `¡Hola, ${c.nombre}! 🌸\nRecibimos tu solicitud de cita. Por favor *confírmala* con el enlace de abajo 👇`
    : `¡Hola, ${c.nombre}! 🌸\n🔔 Te recordamos tu próxima cita con nosotras.`;
  // Un solo enlace corto: la página muestra los dos botones (Confirmar cita / Cancelar cita).
  const enlaces = tipo === "pedir"
    ? [`👉 *Confirma o cancela tu cita aquí:*`, enlaceCita(c)]
    : [`❌ ¿No podrás asistir? *Cancela tu cita aquí:*`, enlaceCita(c)];
  return [
    `✨ *Chely's Spa Nails Studio* ✨`,
    ``,
    encabezado,
    ``,
    `${e} *Servicio:* ${srv}`,
    `📅 *Fecha:* ${fmtFecha(c.fecha)}`,
    `🕐 *Hora:* ${c.hora}`,
    `📍 *Dirección:* Av. 7 Poniente No. 303, Col. Centro`,
    ``,
    ...enlaces,
    ``,
    f,
    ``,
    `⏰ *¡No se te olvide asistir!* Te esperamos puntual.`,
    `Si necesitas cambiar tu cita, avísanos por este medio con anticipación. 🙏`,
    ``,
    `¡Gracias por tu preferencia! 💖`
  ].join("\n");
};

const SVG = {
  wa: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.2c0-.1-.2-.2-.5-.3Z"/></svg>`,
  cal: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4M12 13v5M9.5 15.5h5"/></svg>`,
  ok: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`,
  x: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>`
};

/* ---------- Estado ---------- */
let citas = [];           // todas las citas desde "adminDesde"
let rango = "todo";       // todo | hoy | manana | semana
let estado = "activas";   // activas | pendiente | confirmada | cancelada
let unsub = null;
let respuestas = new Map(); // id → última respuesta vista de la clienta (para avisar solo una vez)
const liberando = new Set();

/* ---------- Login ---------- */
$("adminDesde").value = hoy();
$("btnLogout").onclick = () => signOut(auth);
$("btnGoogle").onclick = () => signInWithPopup(auth, new GoogleAuthProvider()).catch(e => msg($("loginMsg"), e.message));
$("btnEntrar").onclick = () => signInWithEmailAndPassword(auth, $("email").value, $("pass").value)
  .catch(() => msg($("loginMsg"), "Correo o contraseña incorrectos"));
$("pass").addEventListener("keydown", (e) => { if (e.key === "Enter") $("btnEntrar").click(); });

const esAdmin = (u) => u && u.emailVerified && ADMIN_EMAILS.includes(u.email);
if (!auth) { $("admCargando").hidden = true; $("loginBox").hidden = false; msg($("loginMsg"), "Firebase no está configurado (js/firebase-config.js)."); }
else onAuthStateChanged(auth, (u) => {
  const ok = esAdmin(u);
  $("admCargando").hidden = true;
  $("loginBox").hidden = ok; $("btnLogout").hidden = !u;
  $("adminArea").hidden = !ok;
  $("admUser").textContent = ok ? u.email : "";
  if (u && !ok) { msg($("loginMsg"), "Esta cuenta no es de administradora."); signOut(auth); }
  if (ok) {
    const h = new Date().getHours();
    const nombre = (u.displayName || "").split(" ")[0];
    $("admSaludo").textContent = (h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches") + (nombre ? ", " + nombre : "");
    $("admHoy").textContent = fmtFecha(hoy()).toUpperCase();
    escuchar();
  } else if (unsub) { unsub(); unsub = null; }
});

/* ---------- Datos en vivo ---------- */
function escuchar() {
  if (unsub) unsub();
  $("adminCitas").innerHTML = `<div class="empty"><span class="spin"></span>Cargando citas…</div>`;
  // Solo orderBy("fecha") para no depender de un índice compuesto; la hora se ordena aquí.
  const q = query(collection(db, "appointments"), where("fecha", ">=", $("adminDesde").value || hoy()), orderBy("fecha"));
  let primera = true;
  unsub = onSnapshot(q, (snap) => {
    const nuevas = snap.docChanges().filter(ch => ch.type === "added").length;
    citas = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
    if (!primera && nuevas) toast(nuevas === 1 ? "Llegó una cita nueva" : `Llegaron ${nuevas} citas nuevas`);
    // Aviso cuando una clienta confirma o cancela desde su enlace.
    if (!primera) snap.docChanges().forEach(ch => {
      const d = ch.doc.data();
      if (ch.type === "modified" && d.respuesta && respuestas.get(ch.doc.id) !== d.respuesta)
        toast(`${d.nombre} ${d.respuesta === "cancelo" ? "canceló" : "confirmó"} su cita`);
    });
    respuestas = new Map(citas.map(c => [c.id, c.respuesta]));
    citas.forEach(liberarSiCancelo);
    primera = false;
    $("admLive").classList.remove("off");
    pintar();
  }, (e) => {
    console.error(e);
    $("admLive").classList.add("off");
    $("adminCitas").innerHTML = `<div class="empty">No se pudieron cargar las citas<br><small>${esc(e.code || e.message)}</small></div>`;
  });
}
$("adminDesde").addEventListener("change", escuchar);

// La clienta no puede borrar el horario (las reglas no la dejan): cuando cancela desde su enlace,
// el panel libera la hora. En transacción, para que no se libere dos veces si hay dos paneles abiertos
// (la segunda vez podría borrar el horario de una cita nueva).
async function liberarSiCancelo(c) {
  if (c.estado !== "cancelada" || c.respuesta !== "cancelo" || c.slotLibre || liberando.has(c.id)) return;
  liberando.add(c.id);
  try {
    await runTransaction(db, async (tx) => {
      const r = doc(db, "appointments", c.id);
      const s = await tx.get(r);
      if (!s.exists() || s.data().slotLibre || s.data().respuesta !== "cancelo") return;
      if (c.slotId) tx.delete(doc(db, "slots", c.slotId));
      tx.update(r, { slotLibre: true });
    });
  } catch (e) { console.error(e); }
  liberando.delete(c.id);
}

/* ---------- Filtros ---------- */
const enRango = (c) => {
  const h = hoy();
  if (rango === "hoy") return c.fecha === h;
  if (rango === "manana") return c.fecha === masDias(1);
  if (rango === "semana") return c.fecha >= h && c.fecha <= masDias(6);
  return true;
};
const enEstado = (c) => estado === "activas" ? !["cancelada", "atendida"].includes(c.estado) : c.estado === estado;
const coincide = (c) => {
  const t = $("buscar").value.trim().toLowerCase();
  return !t || [c.nombre, c.telefono, c.servicio, c.notas].some(v => String(v || "").toLowerCase().includes(t));
};
const marcar = (grupo, attr, val) =>
  document.querySelectorAll(`#${grupo} .chip`).forEach(b => b.classList.toggle("on", b.dataset[attr] === val));

$("chipsRango").addEventListener("click", (e) => {
  const b = e.target.closest(".chip"); if (!b) return;
  rango = b.dataset.rango; marcar("chipsRango", "rango", rango); pintar();
});
$("chipsEstado").addEventListener("click", (e) => {
  const b = e.target.closest(".chip"); if (!b) return;
  estado = b.dataset.estado; marcar("chipsEstado", "estado", estado); pintar();
});
$("buscar").addEventListener("input", pintar);
$("stats").addEventListener("click", (e) => {
  const b = e.target.closest(".stat"); if (!b) return;
  const go = b.dataset.go;
  if (go === "hoy" || go === "semana") { rango = go; estado = "activas"; }
  else { rango = "todo"; estado = go; }
  marcar("chipsRango", "rango", rango); marcar("chipsEstado", "estado", estado);
  $("adminCitas").scrollIntoView({ behavior: "smooth", block: "start" });
  pintar();
});

/* ---------- Borrar citas atendidas o canceladas (con confirmación) ---------- */
let borrando = false;
const NOMBRE = { atendida: ["atendida", "atendidas"], cancelada: ["cancelada", "canceladas"] };
const paraBorrar = () => citas.filter(c => c.estado === estado);
const limpiable = () => estado === "atendida" || estado === "cancelada";
function pintarLimpiar(confirmando = false) {
  const n = limpiable() ? paraBorrar().length : 0;
  const [uno, varios] = NOMBRE[estado] || ["", ""];
  const t = (k) => (k === 1 ? uno : varios);
  $("limpiar").hidden = !n;
  if (!n) return;
  if (!confirmando) { $("limpiarNo").hidden = true; $("limpiarBtn").textContent = "Borrar " + varios; }
  $("limpiarTxt").textContent = confirmando
    ? `¿Seguro? Se borrarán ${n} cita${n === 1 ? "" : "s"} ${t(n)} para siempre. No se puede deshacer.`
    : `Hay ${n} cita${n === 1 ? "" : "s"} ${t(n)}. Puedes borrarlas para limpiar la lista.`;
}
$("limpiarBtn").addEventListener("click", async () => {
  if ($("limpiarNo").hidden) {                       // primer clic: pedir confirmación
    $("limpiarNo").hidden = false; $("limpiarBtn").textContent = "Sí, borrar"; return pintarLimpiar(true);
  }
  if (borrando || !limpiable()) return;
  borrando = true; $("limpiarBtn").disabled = true;
  const lista = paraBorrar(), tipo = estado;
  try {
    for (let i = 0; i < lista.length; i += 200) {     // lotes (máx. 500 operaciones por lote)
      const b = writeBatch(db);
      lista.slice(i, i + 200).forEach(c => {
        b.delete(doc(db, "appointments", c.id));
        // Solo las atendidas liberan su horario. En las canceladas el horario ya se liberó al cancelar
        // y puede estar tomado por otra cita: no se debe tocar.
        // (Salvo que la haya cancelado la clienta y su horario aún no se haya liberado.)
        const sinLiberar = c.respuesta === "cancelo" && !c.slotLibre;
        if ((tipo === "atendida" || sinLiberar) && c.slotId) b.delete(doc(db, "slots", c.slotId));
      });
      await b.commit();
    }
    toast(`Se borraron ${lista.length} cita${lista.length === 1 ? "" : "s"} ${NOMBRE[tipo][lista.length === 1 ? 0 : 1]}`);
  } catch (err) {
    console.error(err); toast("No se pudo borrar (" + (err.code || "error") + ")");
  }
  borrando = false; $("limpiarBtn").disabled = false; $("limpiarNo").hidden = true; pintarLimpiar();
});
$("limpiarNo").addEventListener("click", () => pintarLimpiar());

/* ---------- Pintar ---------- */
function pintar() {
  pintarLimpiar();
  const h = hoy(), sem = masDias(6);
  // Solo cuentan las que faltan por atender: las atendidas y canceladas ya no suman.
  const activas = citas.filter(c => c.estado === "pendiente" || c.estado === "confirmada");
  $("stHoy").textContent = activas.filter(c => c.fecha === h).length;
  $("stPend").textContent = activas.filter(c => c.estado === "pendiente").length;
  $("stConf").textContent = activas.filter(c => c.estado === "confirmada").length;
  $("stSem").textContent = activas.filter(c => c.fecha >= h && c.fecha <= sem).length;

  const lista = citas.filter(c => enRango(c) && enEstado(c) && coincide(c));
  if (!lista.length) {
    $("adminCitas").innerHTML = `<div class="empty"><img src="img/logo-flor.png" alt="" width="56" height="46">
      ${citas.length ? "No hay citas con estos filtros." : "Aún no hay citas. Las nuevas aparecerán aquí al momento."}</div>`;
    return;
  }
  const dias = {};
  lista.forEach(c => (dias[c.fecha] ||= []).push(c));
  $("adminCitas").innerHTML = Object.entries(dias).map(([f, cs]) => {
    const etiqueta = f === h ? "Hoy" : f === masDias(1) ? "Mañana" : "";
    return `<section class="dia">
      <h3>${etiqueta ? `<em>${etiqueta}</em> · ` : ""}${fmtFecha(f)}<span>${cs.length} ${cs.length === 1 ? "cita" : "citas"}</span></h3>
      ${cs.map(tarjeta).join("")}
    </section>`;
  }).join("");
}

function tarjeta(c) {
  const cat = categoriaDe(c.servicio);
  const ico = cat ? ICONOS[cat.ico] : ICONOS.esmalte;
  const estilo = cat ? `--c:${cat.color};--t:${cat.tx}` : "";
  const [catNombre, srv] = String(c.servicio || "").split(" - ");
  const tel = esc(c.telefono);
  // Un solo botón de WhatsApp: pedir confirmación si está pendiente, recordar si ya se confirmó.
  // La cita pasa a confirmada cuando la clienta toca "Confirmar cita" en su enlace (o a mano con "Confirmar").
  const wa = c.estado === "pendiente"
    ? `<a class="act wa" target="_blank" rel="noopener" data-aviso="${c.id}" href="${waLink(tel, mensajeWa(c, "pedir"))}" title="Enviar mensaje con los enlaces Confirmar / Cancelar">${SVG.wa}${c.avisada ? "Reenviar" : "Pedir confirmación"}</a>
       <button class="act conf" data-conf="${c.id}" title="Confirmar sin esperar la respuesta de la clienta">${SVG.ok}Confirmar</button>`
    : c.estado === "confirmada"
    ? `<a class="act wa" target="_blank" rel="noopener" href="${waLink(tel, mensajeWa(c, "recordar"))}">${SVG.wa}Recordar</a>`
    : "";
  const tag = c.respuesta === "cancelo" && c.estado === "cancelada" ? `<span class="resp-tag no">Canceló la clienta</span>`
    : c.respuesta === "confirmo" && c.estado !== "cancelada" ? `<span class="resp-tag si">Confirmó la clienta</span>`
    : c.estado === "pendiente" && c.avisada ? `<span class="resp-tag">Mensaje enviado · esperando respuesta</span>`
    : "";
  const activa = c.estado === "pendiente" || c.estado === "confirmada";
  return `<article class="cita2 ${esc(c.estado)}" style="${estilo}" data-id="${c.id}">
    <div class="hora"><b>${esc(c.hora)}</b><span class="badge ${esc(c.estado)}">${esc(c.estado)}</span></div>
    <div class="ci">${ico}</div>
    <div class="info">
      <b class="nom">${esc(c.nombre)}</b>
      <span class="srv">${esc(srv || catNombre)}<small>${srv ? esc(catNombre) : ""}</small></span>
      <span class="tel">${tel}</span>
      ${c.notas ? `<span class="nota">“${esc(c.notas)}”</span>` : ""}
      ${tag}
    </div>
    ${activa ? `<div class="acts2">
      ${wa}
      <button class="act done" data-done="${c.id}" title="Marcar el servicio como atendido">${SVG.ok}Atendida</button>
      <a class="act cal" target="_blank" rel="noopener" href="${calLink(c)}" title="Agregar a mi calendario">${SVG.cal}Calendario</a>
      <button class="act ghost" data-ask="${c.id}" title="Cancelar cita">${SVG.x}Cancelar</button>
    </div>
    <div class="ask" hidden>
      <span>¿Cancelar la cita de ${esc(c.nombre)}? La hora quedará libre.</span>
      <button class="act danger" data-cancel="${c.id}" data-slot="${esc(c.slotId)}">Sí, cancelar</button>
      <button class="act ghost" data-no>No</button>
    </div>` : c.estado === "atendida" ? `<div class="acts2">
      <span class="hecho">${SVG.ok}Servicio atendido</span>
      <button class="act ghost" data-undo="${c.id}" title="Volver a confirmada">Deshacer</button>
    </div>` : ""}
  </article>`;
}

/* ---------- Acciones ---------- */
$("adminCitas").addEventListener("click", async (e) => {
  const t = e.target.closest("[data-aviso],[data-conf],[data-done],[data-undo],[data-ask],[data-cancel],[data-no]");
  if (!t) return;
  const card = t.closest(".cita2");
  try {
    if (t.dataset.aviso) {
      // El enlace abre WhatsApp; aquí solo se anota que ya se le pidió confirmar. La cita sigue pendiente.
      await updateDoc(doc(db, "appointments", t.dataset.aviso), { avisada: true });
      toast("Se confirmará cuando la clienta responda");
    } else if (t.dataset.conf) {
      t.disabled = true;
      await updateDoc(doc(db, "appointments", t.dataset.conf), { estado: "confirmada" });
      toast("Cita confirmada");
    } else if (t.dataset.done) {
      t.disabled = true;
      await updateDoc(doc(db, "appointments", t.dataset.done), { estado: "atendida" });
      toast("Servicio atendido ✓");
    } else if (t.dataset.undo) {
      t.disabled = true;
      await updateDoc(doc(db, "appointments", t.dataset.undo), { estado: "confirmada" });
      toast("La cita volvió a confirmada");
    } else if (t.dataset.ask) {
      card.querySelector(".acts2").hidden = true; card.querySelector(".ask").hidden = false;
    } else if ("no" in t.dataset) {
      card.querySelector(".acts2").hidden = false; card.querySelector(".ask").hidden = true;
    } else if (t.dataset.cancel) {
      t.disabled = true;
      const b = writeBatch(db);
      b.update(doc(db, "appointments", t.dataset.cancel), { estado: "cancelada" });
      if (t.dataset.slot) b.delete(doc(db, "slots", t.dataset.slot));
      await b.commit();
      toast("Cita cancelada, la hora quedó libre");
    }
  } catch (err) {
    console.error(err); toast("No se pudo guardar (" + (err.code || "error") + ")");
    t.disabled = false;
  }
});
