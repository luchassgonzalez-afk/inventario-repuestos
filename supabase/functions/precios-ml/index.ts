// Función "precios-ml": busca un repuesto en MercadoLibre Argentina y devuelve precio mínimo,
// mediano, cantidad de publicaciones y enlace a la más barata.
// MercadoLibre dejó de dar de alta apps nuevas (noviembre de 2026), así que no usamos su API:
// Claude busca publicaciones reales con su búsqueda web, limitada a mercadolibre.com.ar.
// Cada búsqueda web cuesta US$ 0,01 más los tokens; se usan hasta BUSQUEDAS por repuesto.
// Recibe { q: "bobina encendido honda wave 110", estado?: "Nuevo" | "Usado bueno" | ... }

import { cors, json, usuario } from "../_shared/comun.ts";
import { Anthropic, API_KEY, MODELO, claude, errorIA, sacarJSON, sinClave, textoDe } from "../_shared/claude.ts";

const BUSQUEDAS = 3;
const PLAZO = 120_000; // Supabase corta la función a los 150 segundos.

const SISTEMA = `Ayudás a un vendedor de repuestos de moto de Argentina a ponerles precio. Con la búsqueda web (solo trae páginas de mercadolibre.com.ar) buscá publicaciones de MercadoLibre Argentina que vendan el repuesto que te piden, o uno equivalente para la misma moto.

Reglas:
- Anotá solo precios que aparezcan en los resultados, en pesos argentinos y por unidad. No inventes ni estimes precios.
- Dejá afuera publicaciones de otra pieza, kits o combos con otras piezas, lotes, precios en dólares y publicaciones sin precio.
- El enlace tiene que ser el de la publicación en mercadolibre.com.ar.
- Si no encontrás publicaciones que sirvan, devolvé la lista vacía.

Respondé solo con este JSON, sin texto antes ni después:
{"publicaciones":[{"titulo":"...","precio":12345,"enlace":"https://...","condicion":"nuevo"}]}
En "condicion" poné "nuevo", "usado" o "" si la publicación no lo dice.`;

type Pub = { titulo: string; precio: number; enlace: string; condicion: "new" | "used" | "" };

function mediana(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

// "$ 12.345", "12.345,50" o 12345 → 12345
function precioARS(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? Math.round(v) : 0;
  const s = String(v ?? "").replace(/[^\d.,]/g, "").replace(/,\d{1,2}$/, "").replace(/[.,]/g, "");
  return parseInt(s, 10) || 0;
}

function enlaceML(v: unknown): string {
  try {
    const u = new URL(String(v || ""));
    if (!/^https?:$/.test(u.protocol) || !/(^|\.)mercadolibre\.com\.ar$/.test(u.hostname)) return "";
    return "https://" + u.hostname + u.pathname;
  } catch { return ""; }
}

function condicionDe(v: unknown): Pub["condicion"] {
  const s = String(v || "").toLowerCase();
  return s.startsWith("nuev") ? "new" : s.startsWith("usad") ? "used" : "";
}

async function buscarConClaude(q: string, estado: string) {
  const limite = Date.now() + PLAZO;
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: `Repuesto: ${q}` + (estado ? `\nEstado del que vendemos: ${estado}` : "") },
  ];
  let resp: Anthropic.Message | null = null;
  // Si la búsqueda es larga, la API pausa el turno (pause_turn): se reenvía tal cual y sigue.
  for (let vuelta = 0; vuelta < 3; vuelta++) {
    const resta = limite - Date.now();
    if (resp && resta < 15_000) break;
    resp = await claude.messages.create({
      model: MODELO,
      max_tokens: 8000,
      system: SISTEMA,
      output_config: { effort: "medium" },
      tools: [{
        type: "web_search_20260209",
        name: "web_search",
        max_uses: BUSQUEDAS,
        allowed_domains: ["mercadolibre.com.ar"],
        user_location: { type: "approximate", country: "AR", timezone: "America/Argentina/Buenos_Aires" },
      }],
      messages,
    }, { timeout: Math.max(15_000, resta) });
    console.log(JSON.stringify({ q, vuelta, stop: resp.stop_reason, usage: resp.usage }));
    if (resp.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: resp.content });
  }
  return resp!;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ code: "method" }, 405);
  if (!(await usuario(req))) return json({ code: "not_granted", error: "Iniciá sesión." }, 401);
  if (!API_KEY) return sinClave();

  let body: { q?: string; estado?: string };
  try { body = await req.json(); } catch { return json({ code: "bad_request" }, 400); }
  const q = String(body.q || "").trim().slice(0, 120);
  if (!q) return json({ code: "bad_request", error: "Falta el texto de búsqueda." }, 400);
  const estado = String(body.estado || "").slice(0, 40);
  const condicion = estado.startsWith("Nuevo") ? "new" : estado.startsWith("Usado") || estado === "Para reparar" ? "used" : "";
  const listado = "https://listado.mercadolibre.com.ar/" + encodeURIComponent(q.replace(/\s+/g, "-").toLowerCase());

  let resp: Anthropic.Message;
  try { resp = await buscarConClaude(q, estado); }
  catch (e) { return errorIA(e); }

  const texto = textoDe(resp);
  let crudo: unknown;
  try { crudo = sacarJSON(texto); }
  catch {
    console.error("Respuesta sin JSON", resp.stop_reason, texto.slice(0, 300));
    return json({ code: "invalid_json", error: "La IA no devolvió la lista de publicaciones." }, 502);
  }
  const lista = Array.isArray(crudo) ? crudo : (crudo as { publicaciones?: unknown })?.publicaciones;

  const pubs: Pub[] = [];
  const vistos = new Set<string>();
  for (const p of Array.isArray(lista) ? lista : []) {
    const o = (p && typeof p === "object" ? p : {}) as Record<string, unknown>;
    const precio = precioARS(o.precio), enlace = enlaceML(o.enlace);
    if (precio < 100 || !enlace || vistos.has(enlace)) continue;
    vistos.add(enlace);
    pubs.push({ titulo: String(o.titulo || "").slice(0, 120), precio, enlace, condicion: condicionDe(o.condicion) });
  }
  if (!pubs.length) {
    return json({ ml: { q, n: 0, min: 0, mediana: 0, enlace: "", listado, fecha: Date.now(), fuente: "ia" } });
  }

  // Si hay al menos 2 publicaciones en el mismo estado que la nuestra, usamos solo esas.
  let usar = pubs, cond = "todas";
  const mismas = condicion ? pubs.filter((p) => p.condicion === condicion) : [];
  if (mismas.length >= 2) { usar = mismas; cond = condicion; }
  // Sacamos lo que está muy lejos de la mediana (calcos, tornillos, publicaciones "consultar").
  const m0 = mediana(usar.map((p) => p.precio));
  const buenos = usar.filter((p) => p.precio >= m0 * 0.25 && p.precio <= m0 * 4);
  if (buenos.length >= 3) usar = buenos;
  usar.sort((a, b) => a.precio - b.precio);
  const barata = usar[0];
  return json({
    ml: {
      q,
      n: usar.length,
      total: pubs.length,
      min: barata.precio,
      mediana: mediana(usar.map((p) => p.precio)),
      enlace: barata.enlace,
      titulo: barata.titulo,
      condicion: cond,
      listado,
      fecha: Date.now(),
      fuente: "ia",
    },
  });
});
