// Catálogo de servicios e iconos, compartido por la página pública y el panel.
/* ---------- Servicios (del folleto) ---------- */
export const ICONOS = {
  tijeras: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13" cy="35" r="5.5"/><circle cx="35" cy="35" r="5.5"/><path d="M17 31 38 7M31 31 10 7"/></svg>`,
  ojo: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 28c6-9 14-13 20-13s14 4 20 13c-6 7-14 10-20 10S10 35 4 28Z"/><circle cx="24" cy="27" r="6"/><path d="M8 20 5 14M16 15l-2-6M24 13V6M32 15l2-6M40 20l3-6"/></svg>`,
  esmalte: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="13" y="21" width="22" height="22" rx="6"/><path d="M19 21v-5h10v5M21 16V5h6v11"/><path d="M19 30c3-2 7 2 10 0"/></svg>`,
  loto: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M24 40c-6-4-9-10-9-17 5 1 8 5 9 10 1-5 4-9 9-10 0 7-3 13-9 17Z"/><path d="M24 33C20 26 21 15 24 7c3 8 4 19 0 26Z"/><path d="M6 33c6 1 10 4 12 8M42 33c-6 1-10 4-12 8"/></svg>`,
  lampara: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="24" cy="22" r="8"/><path d="M24 5v5M24 34v5M7 22h5M36 22h5M12 10l4 4M32 30l4 4M36 10l-4 4M16 30l-4 4"/><path d="M14 44h20"/></svg>`,
  columna: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="17" y="4" width="14" height="8" rx="3"/><rect x="15" y="15" width="18" height="8" rx="3"/><rect x="17" y="26" width="14" height="8" rx="3"/><rect x="19" y="37" width="10" height="7" rx="3"/></svg>`
};
export const CATALOGO = [
  { cat: "Barbería · Lady Barber", ico: "tijeras", color: "#dcf0f3", tx: "#0b6b78",
    items: ["Corte de pelo", "Lavado", "Corte de barba", "Corte para niños"] },
  { cat: "Pestañas", ico: "ojo", color: "#eee3f6", tx: "#6b2fa5",
    items: ["Clásicas", "Efecto rímel", "Volumen", "Híbridas"] },
  { cat: "Uñas", ico: "esmalte", color: "#fbe3ec", tx: "#a3125c",
    items: ["Manicura", "Gelish", "Espejo", "Pedicura", "Acripie", "Tornasol", "Acrílicas", "Baño acrílico", "Encapsulados"] },
  { cat: "Masajes", ico: "loto", color: "#ffead6", tx: "#b84a0c",
    items: ["Relajantes", "Descontracturantes", "Deportivos"] },
  { cat: "Aparatos", ico: "lampara", color: "#e6f0da", tx: "#2e6b12",
    items: ["Compresas calientes", "Electrodos", "Lámpara infrarroja", "Pistola masajeadora"] },
  { cat: "Te atendemos dolores en", ico: "columna", color: "#eee3f6", tx: "#6b2fa5",
    items: ["Espalda", "Columna", "Hombro", "Tobillo", "Ciática", "Y más"] }
];
// El servicio se guarda como "<primera palabra de la categoría> - <servicio>", p. ej. "Uñas - Gelish".
export const categoriaDe = (servicio) =>
  CATALOGO.find(c => String(servicio || "").startsWith(c.cat.split(" ")[0] + " -")) || null;
