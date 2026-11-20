import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithPopup, GoogleAuthProvider,
  signInWithEmailAndPassword, signInWithCredential, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, doc, writeBatch, query, where, orderBy, onSnapshot, updateDoc, runTransaction, setDoc, addDoc, serverTimestamp, getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig, ADMIN_EMAILS, TRACK_EMAILS } from "./firebase-config.js?v=20261119";
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

/* ---------- Alertas: sonido, notificación y título de la pestaña ---------- */
// Funcionan mientras el panel esté abierto (aunque sea en otra pestaña o minimizado).
// Con el panel cerrado el aviso llega al celular por ntfy (js/aviso.js), disparado al reservar, confirmar o cancelar.
const TITULO = document.title;
let alertasOn = false, pendientesAviso = 0, audioCtx = null, parpadeo = null;
try { alertasOn = localStorage.getItem("alertasAdmin") === "1"; } catch { /* sin almacenamiento */ }

function pintarBtnAlertas() {
  const b = $("btnAlertas");
  const bloqueado = "Notification" in window && Notification.permission === "denied";
  b.className = "alert-btn" + (alertasOn ? " on" : "");
  b.textContent = alertasOn ? "🔔 Alertas activas" : bloqueado ? "🔕 Alertas bloqueadas" : "🔔 Activar alertas";
  b.title = bloqueado ? "El navegador bloqueó las notificaciones: actívalas en el candado junto a la dirección. El sonido sí funciona."
    : "Sonido y avisos cuando llegue o se confirme una cita";
}
// Una campana suave: golpe rápido + cola larga que decae, con armónicos metálicos.
// vol más alto que antes para que se escuche aunque el celular esté en la bolsa o haya ruido.
const campana = (ctx, f, t0, dur, vol = 0.6) => {
  [[1, 1], [2.01, 0.5], [3.01, 0.28], [4.18, 0.14]].forEach(([mult, amp]) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sine"; o.frequency.value = f * mult; o.connect(g); g.connect(ctx.destination);
    const peak = Math.max(0.0002, vol * amp);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.006);   // golpe
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);   // cola que se apaga
    o.start(t0); o.stop(t0 + dur + 0.02);
  });
};
function sonido(tipo) {
  try {
    audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
    const t = audioCtx.currentTime;
    if (tipo === "cancelo") {                 // cancelada: campana que baja, suave
      campana(audioCtx, 660, t, 1.1, 0.5);
      campana(audioCtx, 495, t + 0.30, 1.5, 0.5);
    } else if (tipo === "confirmo") {         // confirmada: campana que sube, alegre
      campana(audioCtx, 784, t, 1.1, 0.6);
      campana(audioCtx, 1047, t + 0.26, 1.6, 0.65);
    } else {                                  // cita nueva: doble campana clara "ting-ting", más fuerte
      campana(audioCtx, 880, t, 1.4, 0.8);
      campana(audioCtx, 880, t + 0.34, 1.9, 0.8);
    }
  } catch { /* sin audio */ }
}
function alerta(tipo, titulo, cuerpo) {
  if (nativo()) return;   // en la app: el servicio nativo avisa con su propio tono (aunque esté cerrada)
  if (!alertasOn) return;
  sonido(tipo);
  try { navigator.vibrate?.([200, 100, 200]); } catch { /* sin vibración */ }
  if (document.hidden) {
    pendientesAviso++;
    clearInterval(parpadeo);
    let v = false;
    parpadeo = setInterval(() => { document.title = (v = !v) ? `(${pendientesAviso}) ${titulo}` : TITULO; }, 1000);
    if ("Notification" in window && Notification.permission === "granted") {
      try { new Notification(titulo + " · Chely's Spa", { body: cuerpo, icon: "img/logo-flor.png", tag: "chelys-" + tipo }); } catch { /* móvil sin permiso de página */ }
    }
  }
}
document.addEventListener("visibilitychange", () => {
  if (document.hidden) return;
  pendientesAviso = 0; clearInterval(parpadeo); document.title = TITULO;
});
$("btnAlertas").addEventListener("click", async () => {
  if (alertasOn) { alertasOn = false; } else {
    alertasOn = true;
    sonido("confirmo");                                   // el clic desbloquea el audio y sirve de prueba
    if ("Notification" in window && Notification.permission === "default") { try { await Notification.requestPermission(); } catch { /* ignorar */ } }
    toast("Alertas activadas");
  }
  try { localStorage.setItem("alertasAdmin", alertasOn ? "1" : "0"); } catch { /* ignorar */ }
  pintarBtnAlertas();
});
pintarBtnAlertas();

/* ---------- Ubicación de la administradora (se ve en rastreo.html) ---------- */
// Solo cuentas de TRACK_EMAILS. En el navegador: ubica mientras el panel está abierto.
// Dentro de la app de Android (Capacitor): ubica en segundo plano, aun con la pantalla apagada.
let ubicWatch = null, ubicUltimo = 0, ubicInicio = 0, ubicUsuario = null, accesoHecho = false;
const enApp = () => !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
const dispositivo = () => (enApp() ? "app" : /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) ? "celular" : "computadora");

function detenerUbic() {
  if (ubicWatch === null) return;
  navigator.geolocation.clearWatch(ubicWatch);
  ubicWatch = null;
}

/* ---------- App de Android: servicio nativo siempre activo ---------- */
// Manda la ubicación y avisa de citas (tono distinto para nueva / confirmada / cancelada) aunque la app
// esté cerrada o el celular se reinicie. Al confirmar una clienta la agrega a los Contactos del celular.
const nativo = () => enApp() && !!window.Capacitor.Plugins.Rastreo;
async function iniciarApp(u) {
  if (!nativo()) return;
  const R = window.Capacitor.Plugins.Rastreo;
  try {
    await R.requestPermissions({ permissions: ["notificaciones"] });
    await R.requestPermissions({ permissions: ["contactos"] });
    const rastrear = TRACK_EMAILS.includes(u.email);
    let p = { ubicacion: "denied", segundoPlano: "denied" };
    if (rastrear) {
      p = await R.requestPermissions({ permissions: ["ubicacion"] });
      if (p.ubicacion === "granted") p = await R.requestPermissions({ permissions: ["segundoPlano"] });
    }
    await R.iniciar({ rastrear });
    const e = await R.estado();
    const faltaUbic = rastrear && p.segundoPlano !== "granted";
    $("appAviso").hidden = !(faltaUbic || !e.bateria);
    $("appAvisoTxt").textContent = faltaUbic
      ? "Para que la ubicación funcione con la app cerrada: Permisos → Ubicación → «Permitir todo el tiempo»."
      : "Para que los avisos no se detengan con la pantalla apagada, permite que la app funcione sin restricción de batería.";
    $("appAvisoBtn").onclick = () => (faltaUbic ? R.abrirAjustes() : R.pedirBateria());
    if (!e.bateria && !faltaUbic) R.pedirBateria();
  } catch (err) { console.error(err); }
}
async function registrarAcceso(datos) {
  try { await addDoc(collection(db, "accesos"), { email: ubicUsuario.email, ...datos, dispositivo: dispositivo(), creada: serverTimestamp() }); }
  catch (e) { console.error(e); }
}
// Un punto del recorrido (el rastro del día que se dibuja en el mapa).
async function guardarRastro(d) {
  try { await addDoc(collection(db, "rastro"), { email: ubicUsuario.email, ...d, dispositivo: dispositivo(), creada: serverTimestamp() }); }
  catch (e) { console.error(e); }
}
// Guarda una lectura (ubicación actual + punto del recorrido), a lo más una por minuto.
async function guardarUbicacion(lat, lng, prec) {
  const ahora = Date.now();
  const primera = ubicUltimo === 0;
  if (primera && prec > 100 && (ahora - ubicInicio) < 20000) return;   // espera una buena al arrancar
  if (!primera && ahora - ubicUltimo < 60000) return;                  // después, un punto por minuto
  ubicUltimo = ahora;
  const d = { lat, lng, precision: Math.round(prec) };
  try {
    await setDoc(doc(db, "ubicacion", ubicUsuario.email), { email: ubicUsuario.email, ...d, dispositivo: dispositivo(), actualizada: serverTimestamp() });
  } catch (e) { console.error(e); }
  guardarRastro(d);
  if (!accesoHecho) { accesoHecho = true; registrarAcceso(d); }
}
async function iniciarUbic(u) {
  ubicUsuario = u; detenerUbic(); ubicUltimo = 0; ubicInicio = Date.now();
  if (!TRACK_EMAILS.includes(u.email)) return;
  if (nativo()) return;            // en la app lo hace el servicio nativo (iniciarApp)
  // Navegador: ubica con el panel abierto. Máxima precisión (GPS, sin lecturas viejas).
  if (!navigator.geolocation) return;
  ubicWatch = navigator.geolocation.watchPosition(
    (pos) => guardarUbicacion(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy),
    (err) => { if (err.code === 1 && !accesoHecho) { accesoHecho = true; registrarAcceso({ lat: null, lng: null, precision: null, motivo: "sin permiso" }); } },
    { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 });
}

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
$("btnLogout").onclick = async () => {
  if (nativo()) {   // apaga el servicio (ya no rastrea ni avisa) y cierra también la sesión nativa
    try { await window.Capacitor.Plugins.Rastreo.detener(); } catch { /* ignorar */ }
    try { await window.Capacitor.Plugins.FirebaseAuthentication.signOut(); } catch { /* ignorar */ }
  }
  signOut(auth);
};
// Entrar con Google: en la app de Android usa el login NATIVO (la cuenta del teléfono, sin popup);
// en el navegador usa el popup normal. En ambos casos la sesión queda en el SDK web (para Firestore).
async function entrarConGoogle() {
  msg($("loginMsg"), "");
  if (enApp() && window.Capacitor.Plugins.FirebaseAuthentication) {
    try {
      const res = await window.Capacitor.Plugins.FirebaseAuthentication.signInWithGoogle();
      const idToken = res && res.credential && res.credential.idToken;
      if (!idToken) throw new Error("No se obtuvo el token de Google");
      await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
    } catch (e) { msg($("loginMsg"), e.message || "No se pudo entrar con Google"); }
  } else {
    signInWithPopup(auth, new GoogleAuthProvider()).catch(e => msg($("loginMsg"), e.message));
  }
}
$("btnGoogle").onclick = entrarConGoogle;
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
    iniciarUbic(u);
    iniciarApp(u);
    escucharClientas();
    guardarPendientes();
  } else { detenerUbic(); accesoHecho = false; if (unsub) { unsub(); unsub = null; } if (unsubCli) { unsubCli(); unsubCli = null; } }
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
    if (!primera && nuevas) {
      toast(nuevas === 1 ? "Llegó una cita nueva" : `Llegaron ${nuevas} citas nuevas`);
      const n = snap.docChanges().find(ch => ch.type === "added").doc.data();
      alerta("nueva", nuevas === 1 ? "Cita nueva" : `${nuevas} citas nuevas`,
        nuevas === 1 ? `${n.nombre} · ${fmtFecha(n.fecha)} ${n.hora}` : "Revisa el panel");
    }
    // Aviso cuando una clienta confirma o cancela desde su enlace.
    if (!primera) snap.docChanges().forEach(ch => {
      const d = ch.doc.data();
      if (ch.type === "modified" && d.respuesta && respuestas.get(ch.doc.id) !== d.respuesta)
      {
        const cancelo = d.respuesta === "cancelo";
        toast(`${d.nombre} ${cancelo ? "canceló" : "confirmó"} su cita`);
        alerta(cancelo ? "cancelo" : "confirmo", cancelo ? "Cita cancelada" : "Cita confirmada",
          `${d.nombre} · ${fmtFecha(d.fecha)} ${d.hora}`);
      }
    });
    respuestas = new Map(citas.map(c => [c.id, c.respuesta]));
    citas.forEach(liberarSiCancelo);
    citas.forEach(guardarContacto);
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

/* ---------- Clientas: se guardan solas al confirmar, para mandarles promociones ---------- */
// Un documento por teléfono en "contactos". Se guarda una sola vez por cita (marca contactoGuardado).
const guardandoCli = new Set();
async function guardarContacto(c) {
  if (!["confirmada", "atendida"].includes(c.estado) || c.contactoGuardado
    || !/^\d{10}$/.test(c.telefono || "") || guardandoCli.has(c.id)) return;
  guardandoCli.add(c.id);
  try {
    await runTransaction(db, async (tx) => {
      const r = doc(db, "appointments", c.id), k = doc(db, "contactos", c.telefono);
      const s = await tx.get(r), ks = await tx.get(k);
      if (!s.exists() || s.data().contactoGuardado) return;
      const prev = ks.exists() ? ks.data() : null;
      tx.set(k, {
        nombre: c.nombre, telefono: c.telefono, ultimoServicio: c.servicio || "",
        ultimaCita: prev && prev.ultimaCita > c.fecha ? prev.ultimaCita : c.fecha,
        citas: (prev?.citas || 0) + 1, promos: prev ? prev.promos !== false : true,
        ultimaPromo: prev?.ultimaPromo || null,
        creada: prev?.creada || serverTimestamp(), actualizada: serverTimestamp()
      });
      tx.update(r, { contactoGuardado: true });
    });
  } catch (e) { console.error(e); }
  guardandoCli.delete(c.id);
}
// Al entrar: guarda las confirmadas/atendidas de días anteriores que aún no estaban en la lista.
async function guardarPendientes() {
  try {
    const snap = await getDocs(query(collection(db, "appointments"), where("estado", "in", ["confirmada", "atendida"])));
    for (const d of snap.docs) await guardarContacto({ id: d.id, ...d.data() });
  } catch (e) { console.error(e); }
}

let clientas = [], unsubCli = null, vista = "citas";
function escucharClientas() {
  if (unsubCli) unsubCli();
  unsubCli = onSnapshot(collection(db, "contactos"), (snap) => {
    clientas = snap.docs.map(d => d.data()).sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), "es"));
    $("tabCliN").textContent = clientas.length;
    if (vista === "clientas") pintarClientas();
  }, (e) => console.error(e));
}

const PROMO_DEF = "¡Hola, {nombre}! 🌸\nEn *Chely's Spa Nails Studio* tenemos una promoción especial para ti: …\n\n¡Te esperamos! 💖";
try { $("promoTxt").value = localStorage.getItem("promoTxt") || PROMO_DEF; } catch { $("promoTxt").value = PROMO_DEF; }
$("promoTxt").addEventListener("input", () => { try { localStorage.setItem("promoTxt", $("promoTxt").value); } catch { /* ignorar */ } });
const textoPromo = (c) => $("promoTxt").value.replaceAll("{nombre}", String(c.nombre || "").split(" ")[0]);

function pintarClientas() {
  const t = $("buscarCli").value.trim().toLowerCase();
  const lista = clientas.filter(c => !t || [c.nombre, c.telefono, c.ultimoServicio].some(v => String(v || "").toLowerCase().includes(t)));
  const activas = clientas.filter(c => c.promos !== false).length;
  $("cliResumen").textContent = `${clientas.length} clienta${clientas.length === 1 ? "" : "s"} · ${activas} reciben promociones`;
  $("btnContactosCel").hidden = !nativo();
  if (!lista.length) {
    $("cliLista").innerHTML = `<div class="empty">${clientas.length ? "Nadie coincide con la búsqueda." : "Aún no hay clientas. Se agregan solas cuando confirman su cita."}</div>`;
    return;
  }
  const h = hoy();
  $("cliLista").innerHTML = lista.map(c => {
    const no = c.promos === false;
    const tel = esc(c.telefono);
    const enviada = c.ultimaPromo ? (c.ultimaPromo === h ? "Promo enviada hoy" : "Última promo: " + fmtFecha(c.ultimaPromo)) : "";
    return `<article class="cli${no ? " no" : ""}">
      <div class="cli-i"><b>${esc(c.nombre)}</b>
        <span>${tel} · ${c.citas || 1} cita${(c.citas || 1) === 1 ? "" : "s"} · última ${esc(fmtFecha(c.ultimaCita))}</span>
        <small>${esc(String(c.ultimoServicio || "").split(" - ").pop())}${enviada ? " · " + esc(enviada) : ""}</small></div>
      <div class="cli-a">
        ${no ? "" : `<a class="act wa" target="_blank" rel="noopener" data-promo="${tel}" href="${esc(waLink(c.telefono, textoPromo(c)))}">${SVG.wa}Enviar promo</a>`}
        <button class="act ghost" data-baja="${tel}">${no ? "Volver a enviar" : "No enviar más"}</button>
      </div></article>`;
  }).join("");
}
$("buscarCli").addEventListener("input", pintarClientas);
$("promoTxt").addEventListener("change", pintarClientas);
$("cliLista").addEventListener("click", async (e) => {
  const t = e.target.closest("[data-promo],[data-baja]"); if (!t) return;
  try {
    if (t.dataset.promo) await updateDoc(doc(db, "contactos", t.dataset.promo), { ultimaPromo: hoy() });
    else {
      const c = clientas.find(x => x.telefono === t.dataset.baja);
      await updateDoc(doc(db, "contactos", t.dataset.baja), { promos: !!(c && c.promos === false) });
    }
  } catch (err) { console.error(err); toast("No se pudo guardar (" + (err.code || "error") + ")"); }
});
// Lista para importar en WhatsApp Business (listas de difusión) o en Google Contactos.
$("btnCsv").addEventListener("click", () => {
  const filas = [["Nombre", "Telefono", "Citas", "Ultima cita", "Ultimo servicio"]]
    .concat(clientas.filter(c => c.promos !== false).map(c => [c.nombre + " (Chely's Spa)", "+52" + c.telefono, c.citas || 1, c.ultimaCita, c.ultimoServicio]));
  const csv = "﻿" + filas.map(f => f.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = `clientas-chelys-${hoy()}.csv`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
});
// En la app: guarda en los Contactos del celular a todas las que aún no estén.
$("btnContactosCel").addEventListener("click", async () => {
  const R = window.Capacitor.Plugins.Rastreo;
  try {
    const p = await R.requestPermissions({ permissions: ["contactos"] });
    if (p.contactos !== "granted") return toast("Permite el acceso a Contactos en los ajustes de la app");
    $("btnContactosCel").disabled = true;
    const r = await R.guardarContactos({ lista: clientas.map(c => ({ nombre: c.nombre, telefono: c.telefono })) });
    toast(r.agregados ? `${r.agregados} agregada${r.agregados === 1 ? "" : "s"} a tus contactos como «Nombre (Chely's Spa)»` : "Todas ya estaban en tus contactos");
  } catch (err) { console.error(err); toast("No se pudieron guardar los contactos"); }
  $("btnContactosCel").disabled = false;
});

document.querySelector(".tabs").addEventListener("click", (e) => {
  const b = e.target.closest("[data-vista]"); if (!b) return;
  vista = b.dataset.vista;
  document.querySelectorAll(".tabs [data-vista]").forEach(x => x.classList.toggle("on", x === b));
  $("vistaCitas").hidden = vista !== "citas"; $("vistaClientas").hidden = vista !== "clientas";
  if (vista === "clientas") pintarClientas();
});
