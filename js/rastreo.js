// Página de rastreo: login (solo cuentas admin registradas en Firebase) y mapa con la ubicación actual
// y el historial de dónde se abrió el panel.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, query, where, orderBy, limit, onSnapshot, getDocs, writeBatch
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
// Hora real del punto: "t" si viene del celular, si no la del servidor.
const horaDe = (d) => d.t?.toDate ? d.t : d.creada;
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
  // Se ordena por "t" (la hora en que el GPS tomó el punto): los puntos guardados sin señal llegan
  // después, todos juntos, y así se acomodan en su lugar en vez de revolver la línea.
  unsubs.push(onSnapshot(query(collection(db, "rastro"), where("creada", ">=", inicioDia), orderBy("creada", "desc")), (snap) => {
    capaRuta.clearLayers();
    const porAdmin = new Map();
    snap.docs.forEach(doc => {
      const d = doc.data(), h = horaDe(d);
      if (!esHoy(h) || num(d.lat) === null || num(d.lng) === null) return;
      if (!porAdmin.has(d.email)) porAdmin.set(d.email, []);
      porAdmin.get(d.email).push({ ll: [d.lat, d.lng], ms: h.toDate().getTime() });
    });
    porAdmin.forEach((pts, email) => {
      pts.sort((a, b) => a.ms - b.ms);
      // Si pasaron más de 10 min entre dos puntos (GPS apagado o sin señal), ese tramo va punteado:
      // se sabe dónde se perdió y dónde reapareció, pero no por dónde anduvo.
      let tramo = [];
      const cerrar = () => { if (tramo.length > 1) L.polyline(tramo, { color: colorDe(email), weight: 4, opacity: .7 }).addTo(capaRuta); };
      pts.forEach((p, i) => {
        const prev = pts[i - 1];
        if (prev && p.ms - prev.ms > 10 * 60000) {
          cerrar(); tramo = [];
          const min = Math.round((p.ms - prev.ms) / 60000);
          L.polyline([prev.ll, p.ll], { color: colorDe(email), weight: 2, opacity: .6, dashArray: "6 8" })
            .bindTooltip(`Sin GPS ${min >= 60 ? Math.floor(min / 60) + " h " + (min % 60) + " min" : min + " min"}`, { sticky: true })
            .addTo(capaRuta);
        }
        tramo.push(p.ll);
      });
      cerrar();
    });
  }, (e) => console.error(e)));

  // Historial: cada vez que se abrió el panel.
  unsubs.push(onSnapshot(query(collection(db, "accesos"), orderBy("creada", "desc"), limit(50)), (snap) => {
    capaHist.clearLayers();
    const filas = snap.docs.map(d => d.data());
    $("accesos").innerHTML = filas.length ? filas.map(d => {
      const ok = num(d.lat) !== null && num(d.lng) !== null;
      return `<div class="rt-fila"><div><b>${esc(d.email)}</b><small>${esc(cuando(horaDe(d)))} · ${esc(d.dispositivo || "")}${ok && d.motivo ? " · " + esc(d.motivo) : ""}</small></div>
        ${ok ? `<a href="${maps(d.lat, d.lng)}" target="_blank" rel="noopener">Ver mapa</a>` : `<small>${esc(d.motivo || "sin ubicación")}</small>`}</div>`;
    }).join("") : `<div class="empty">Sin accesos registrados todavía.</div>`;
    filas.forEach(d => {
      if (num(d.lat) === null || num(d.lng) === null) return;
      L.circleMarker([d.lat, d.lng], { radius: 5, color: "#6d0f27", weight: 1, fillColor: "#d9a441", fillOpacity: .9 })
        .bindPopup(popup(String(d.email), cuando(horaDe(d)))).addTo(capaHist);
    });
  }, (e) => console.error(e)));
}

/* ---------- Borrar historial ---------- */
// Borra el recorrido (rastro) y los accesos; la ubicación actual se queda y todo vuelve a registrarse desde ahora.
// Dos toques para confirmar (sin ventanas emergentes).
let armado = null;
async function borrarColeccion(nombre) {
  let total = 0;
  for (;;) {
    const snap = await getDocs(query(collection(db, nombre), limit(400)));
    if (snap.empty) return total;
    const b = writeBatch(db);
    snap.docs.forEach(d => b.delete(d.ref));
    await b.commit();
    total += snap.size;
  }
}
$("btnBorrarHist").onclick = async () => {
  const btn = $("btnBorrarHist");
  if (!armado) {
    btn.textContent = "¿Seguro? Toca otra vez para borrar";
    armado = setTimeout(() => { armado = null; btn.textContent = "Borrar historial"; }, 5000);
    return;
  }
  clearTimeout(armado); armado = null;
  btn.disabled = true; btn.textContent = "Borrando…";
  try {
    const r = await borrarColeccion("rastro");
    const a = await borrarColeccion("accesos");
    msg($("borrarMsg"), `Listo: se borraron ${r} puntos del recorrido y ${a} accesos. Desde ahora se registra de nuevo.`);
  } catch (e) {
    console.error(e);
    msg($("borrarMsg"), "No se pudo borrar todo (revisa que las reglas nuevas estén publicadas en Firebase).");
  }
  btn.disabled = false; btn.textContent = "Borrar historial";
};
