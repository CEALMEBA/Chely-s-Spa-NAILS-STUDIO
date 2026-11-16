import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithPopup, GoogleAuthProvider,
  signInWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, doc, writeBatch, query, where, orderBy, getDocs, updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig, ADMIN_EMAILS } from "./firebase-config.js";

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
  $("adminCitas").innerHTML = !lista.length ? "<p>Sin citas.</p>" : lista.map(c => {
    const txtConf = `Hola ${c.nombre}, te confirmamos tu cita en Chely's Spa: ${c.servicio}, ${fmtFecha(c.fecha)} a las ${c.hora}. ¡Te esperamos!`;
    const txtRec = `Hola ${c.nombre}, te recordamos tu cita de ${c.servicio} el ${fmtFecha(c.fecha)} a las ${c.hora} en Chely's Spa.`;
    return `<div class="cita"><div><b>${esc(c.nombre)}</b> <span class="badge ${c.estado}">${c.estado}</span></div>
      <div>${esc(c.servicio)} · ${fmtFecha(c.fecha)} · ${c.hora}</div>
      <div>Tel: ${esc(c.telefono)}${c.notas ? " · Nota: " + esc(c.notas) : ""}</div>
      <div class="acts">
        <a class="btn small wa" target="_blank" rel="noopener" href="${waLink(esc(c.telefono), txtConf)}" data-conf="${c.id}">WhatsApp: confirmar</a>
        <a class="btn small wa" target="_blank" rel="noopener" href="${waLink(esc(c.telefono), txtRec)}">WhatsApp: recordar</a>
        ${c.estado !== "cancelada" ? `<button class="btn small gray" data-adm-cancel="${c.id}" data-slot="${c.slotId}">Cancelar</button>` : ""}
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
