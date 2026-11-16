// Función "precios-ml": busca un repuesto en MercadoLibre Argentina y devuelve
// precio mínimo, mediano, cantidad de publicaciones y enlace a la más barata.
// Recibe { q: "bobina encendido honda wave 110", estado?: "Nuevo" | "Usado bueno" | ... }

import { cors, json, usuario } from "../_shared/comun.ts";
import { tokenML } from "../_shared/ml.ts";

type Item = { title: string; price: number; currency_id: string; permalink: string; condition?: string; thumbnail?: string };

function mediana(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

async function buscar(q: string, condicion: string, token: string) {
  const u = new URL("https://api.mercadolibre.com/sites/MLA/search");
  u.searchParams.set("q", q);
  u.searchParams.set("limit", "50");
  if (condicion) u.searchParams.set("ITEM_CONDITION", condicion === "new" ? "2230284" : "2230581");
  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(u, { headers });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ code: "method" }, 405);
  if (!(await usuario(req))) return json({ code: "not_granted", error: "Iniciá sesión." }, 401);

  let body: { q?: string; estado?: string };
  try { body = await req.json(); } catch { return json({ code: "bad_request" }, 400); }
  const q = String(body.q || "").trim().slice(0, 120);
  if (!q) return json({ code: "bad_request", error: "Falta el texto de búsqueda." }, 400);
  const estado = String(body.estado || "");
  const condicion = estado.startsWith("Nuevo") ? "new" : estado.startsWith("Usado") || estado === "Para reparar" ? "used" : "";

  let token = await tokenML();
  let r = await buscar(q, condicion, token);
  if ((r.status === 401 || r.status === 403) && token) { token = await tokenML(true); r = await buscar(q, condicion, token); }
  if (r.status === 401 || r.status === 403) {
    return json({ code: "ml_sin_permiso", error: "MercadoLibre pide conectar la cuenta: tocá \"Conectar MercadoLibre\" en la app." }, 502);
  }
  if (r.status === 429) return json({ code: "rate_limited" }, 429);
  if (!r.ok) return json({ code: "ml_error", error: `MercadoLibre respondió ${r.status}` }, 502);

  const data = await r.json();
  let items: Item[] = (data.results || []).filter((it: Item) => it.currency_id === "ARS" && it.price > 0);
  // Si filtrando por estado no hay nada, probamos sin filtro.
  if (!items.length && condicion) {
    const r2 = await buscar(q, "", token);
    if (r2.ok) items = ((await r2.json()).results || []).filter((it: Item) => it.currency_id === "ARS" && it.price > 0);
  }
  const listado = "https://listado.mercadolibre.com.ar/" + encodeURIComponent(q.replace(/\s+/g, "-").toLowerCase());
  if (!items.length) {
    return json({ ml: { q, n: 0, min: 0, mediana: 0, enlace: "", listado, fecha: Date.now() } });
  }
  // Sacamos lo que está muy por debajo de la mediana (calcos, tornillos, publicaciones "consultar").
  const m0 = mediana(items.map((i) => i.price));
  const buenos = items.filter((i) => i.price >= m0 * 0.25 && i.price <= m0 * 4);
  const usar = buenos.length >= 3 ? buenos : items;
  usar.sort((a, b) => a.price - b.price);
  const barata = usar[0];
  return json({
    ml: {
      q,
      n: usar.length,
      total: data.paging?.total ?? usar.length,
      min: Math.round(barata.price),
      mediana: Math.round(mediana(usar.map((i) => i.price))),
      enlace: barata.permalink,
      titulo: barata.title.slice(0, 120),
      condicion: condicion || "todas",
      listado,
      fecha: Date.now(),
    },
  });
});
