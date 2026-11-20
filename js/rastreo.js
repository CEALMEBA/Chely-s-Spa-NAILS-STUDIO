// Página de rastreo: login (solo cuentas admin registradas en Firebase) y mapa con la ubicación actual
// y el historial de dónde se abrió el panel.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, query, where, orderBy, limit, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
// A rastreo.html solo entran las cuentas de RASTREO_EMAILS (por ahora, solo cesamendoza19@gmail.com).
import { firebaseConfig, RASTREO_EMAILS } from "./firebase-config.js?v=20261119";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
const msg = (el, t) => { el.textContent = t; el.className = "msg"; };
const num = (n) => Number.isFinite(n) ? n : null;

let auth = null, db = null;
try { const app = initializeApp(firebaseConfig); auth = getAuth(app); db = getFirestore(app); }
catch (e) { console.warn("Firebase no configurado:", e.message); }

const hace = (ts) => {
  if (!ts?.toDate) return "ahora";
  const m = Math.round((Date.now() - ts.toDate().getTime()) / 60000);
  if (m < 1) return "hace un momento";
  if (m < 60) return `hace ${m} min`;
  if (m < 1440) return `hace ${Math.round(m / 60)} h`;
  return ts.toDate().toLocaleDateString("es-MX", { day: "numeric", month: "short" });
};
const cuando = (ts) => ts?.toDate ? ts.toDate().toLocaleString("es-MX", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "ahora";
const maps = (lat, lng) => `https://www.google.com/maps?q=${lat},${lng}`;

/* ---------- Login ---------- */
$("btnLogout").onclick = () => signOut(auth);
$("btnGoogle").onclick = () => signInWithPopup(auth, new GoogleAuthProvider()).catch(e => msg($("loginMsg"), e.message));
$("btnEntrar").onclick = () => signInWithEmailAndPassword(auth, $("email").value, $("pass").value)
  .catch(() => msg($("loginMsg"), "Correo o contraseña incorrectos"));
$("pass").addEventListener("keydown", (e) => { if (e.key === "Enter") $("btnEntrar").click(); });

const esAdmin = (u) => u && u.emailVerified && RASTREO_EMAILS.includes(u.email);
let unsubs = [];
const parar = () => { unsubs.forEach(f => f()); unsubs = []; };

if (!auth) { $("admCargando").hidden = true; $("loginBox").hidden = false; msg($("loginMsg"), "Firebase no está configurado."); }
else onAuthStateChanged(auth, (u) => {
  const ok = esAdmin(u);
  $("admCargando").hidden = true;
  $("loginBox").hidden = ok; $("btnLogout").hidden = !u;
  $("rastreoArea").hidden = !ok;
  $("admUser").textContent = ok ? u.email : "";
  if (u && !ok) { msg($("loginMsg"), "Esta cuenta no tiene acceso."); signOut(auth); }
  parar();
  if (ok) iniciar();
});

/* ---------- Mapa ---------- */
let mapa = null, capaActual = null, capaHist = null, capaRuta = null, encuadrado = false;
const COLORES = ["#8e1230", "#1565c0", "#2e7d32", "#6a1b9a"];   // un color por admin
const colorDe = (email) => { let h = 0; for (const c of email) h = (h * 31 + c.charCodeAt(0)) >>> 0; return COLORES[h % COLORES.length]; };
const esHoy = (ts) => { if (!ts?.toDate) return false; const d = ts.toDate(), n = new Date(); return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate(); };
function crearMapa() {
  if (mapa) return;
  mapa = L.map("mapa").setView([19.4326, -99.1332], 5);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(mapa);
  capaRuta = L.layerGroup().addTo(mapa);     // la ruta del día (debajo)
  capaHist = L.layerGroup().addTo(mapa);
  capaActual = L.layerGroup().addTo(mapa);   // el punto que se mueve (encima)
}
// Los popups se arman con textContent para que ningún dato se interprete como HTML.
function popup(...lineas) {
  const d = document.createElement("div");
  lineas.forEach((t, i) => { if (i) d.appendChild(document.createElement("br")); const s = document.createElement(i ? "span" : "b"); s.textContent = t; d.appendChild(s); });
  return d;
}

function iniciar() {
  crearMapa();
  setTimeout(() => mapa.invalidateSize(), 100);

  // Ubicación actual (una por correo).
  unsubs.push(onSnapshot(collection(db, "ubicacion"), (snap) => {
    capaActual.clearLayers();
    const filas = snap.docs.map(d => d.data());
    $("ubicaciones").innerHTML = filas.length ? filas.map(d => `
      <div class="rt-card"><b>${esc(d.email)}</b>
        <span>📍 ${esc(hace(d.actualizada))} · ${esc(d.dispositivo || "")} · precisión ${esc(d.precision)} m</span>
        <a href="${maps(num(d.lat), num(d.lng))}" target="_blank" rel="noopener">Abrir en Google Maps</a>
      </div>`).join("") : `<div class="empty">Aún no hay ubicación. Aparece cuando abra el panel y acepte el permiso.</div>`;
    const puntos = [];
    filas.forEach(d => {
      if (num(d.lat) === null || num(d.lng) === null) return;
      const col = colorDe(d.email);
      L.circle([d.lat, d.lng], { radius: d.precision || 20, color: col, weight: 1, fillOpacity: .12 }).addTo(capaActual);
      L.circleMarker([d.lat, d.lng], { radius: 9, color: "#fff", weight: 3, fillColor: col, fillOpacity: 1 })
        .bindPopup(popup(String(d.email), hace(d.actualizada))).addTo(capaActual);
      puntos.push([d.lat, d.lng]);
    });
    // Sigue al punto en vivo: centra el mapa en la última ubicación cada vez que cambia.
    if (puntos.length) { if (!encuadrado) { mapa.setView(puntos[0], 16); encuadrado = true; } else mapa.panTo(puntos[0]); }
    $("admLive").classList.remove("off");
  }, (e) => { console.error(e); $("admLive").classList.add("off"); }));

  // Recorrido del día: une los puntos de hoy en una línea por cada admin (la ruta por donde anduvo).
  // Todo el día (desde las 00:00), sin tope: con la app el rastreo es continuo y 500 puntos eran ~4 horas.
  const inicioDia = new Date(); inicioDia.setHours(0, 0, 0, 0);
  unsubs.push(onSnapshot(query(collection(db, "rastro"), where("creada", ">=", inicioDia), orderBy("creada", "desc")), (snap) => {
    capaRuta.clearLayers();
    const porAdmin = new Map();
    // Vienen del más nuevo al más viejo: los recorremos al revés para que la línea vaya en orden.
    snap.docs.slice().reverse().forEach(doc => {
      const d = doc.data();
      if (!esHoy(d.creada) || num(d.lat) === null || num(d.lng) === null) return;
      if (!porAdmin.has(d.email)) porAdmin.set(d.email, []);
      porAdmin.get(d.email).push([d.lat, d.lng]);
    });
    porAdmin.forEach((pts, email) => {
      if (pts.length < 2) return;
      L.polyline(pts, { color: colorDe(email), weight: 4, opacity: .7 }).addTo(capaRuta);
    });
  }, (e) => console.error(e)));

  // Historial: cada vez que se abrió el panel.
  unsubs.push(onSnapshot(query(collection(db, "accesos"), orderBy("creada", "desc"), limit(50)), (snap) => {
    capaHist.clearLayers();
    const filas = snap.docs.map(d => d.data());
    $("accesos").innerHTML = filas.length ? filas.map(d => {
      const ok = num(d.lat) !== null && num(d.lng) !== null;
      return `<div class="rt-fila"><div><b>${esc(d.email)}</b><small>${esc(cuando(d.creada))} · ${esc(d.dispositivo || "")}</small></div>
        ${ok ? `<a href="${maps(d.lat, d.lng)}" target="_blank" rel="noopener">Ver mapa</a>` : `<small>${esc(d.motivo || "sin ubicación")}</small>`}</div>`;
    }).join("") : `<div class="empty">Sin accesos registrados todavía.</div>`;
    filas.forEach(d => {
      if (num(d.lat) === null || num(d.lng) === null) return;
      L.circleMarker([d.lat, d.lng], { radius: 5, color: "#6d0f27", weight: 1, fillColor: "#d9a441", fillOpacity: .9 })
        .bindPopup(popup(String(d.email), cuando(d.creada))).addTo(capaHist);
    });
  }, (e) => console.error(e)));
}
