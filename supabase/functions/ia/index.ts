// Función "ia": reemplaza a claude.use("sample") del artefacto.
// Recibe { prompt, fotos?: [ids del bucket "repuestos"] } y devuelve { resultado } con el JSON
// que respondió Claude. La clave de Anthropic queda en el servidor (secreto ANTHROPIC_API_KEY).

import { encodeBase64 } from "jsr:@std/encoding@1/base64";
import { cors, json, usuario, SUPABASE_URL } from "../_shared/comun.ts";

const API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const MODELO = Deno.env.get("ANTHROPIC_MODEL") || "claude-sonnet-5-5";
const MAX_FOTOS = 8;

function sacarJSON(texto: string): unknown {
  const t = texto.replace(/```(?:json)?/gi, "").trim();
  try { return JSON.parse(t); } catch { /* sigue */ }
  const ini = Math.min(...["{", "["].map((c) => { const i = t.indexOf(c); return i < 0 ? Infinity : i; }));
  const fin = Math.max(t.lastIndexOf("}"), t.lastIndexOf("]"));
  if (ini === Infinity || fin <= ini) throw new Error("invalid_json");
  return JSON.parse(t.slice(ini, fin + 1));
}

async function fotoBase64(id: string) {
  if (!/^[A-Za-z0-9_\-.]{6,120}$/.test(id)) throw new Error("foto_invalida");
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/public/repuestos/${id}`);
  if (!r.ok) throw new Error("foto_no_encontrada");
  let tipo = (r.headers.get("content-type") || "image/jpeg").split(";")[0];
  if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(tipo)) tipo = "image/jpeg";
  const bytes = new Uint8Array(await r.arrayBuffer());
  return { type: "image", source: { type: "base64", media_type: tipo, data: encodeBase64(bytes) } };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ code: "method" }, 405);
  if (!(await usuario(req))) return json({ code: "not_granted", error: "Iniciá sesión." }, 401);
  if (!API_KEY) return json({ code: "sampling_disabled", error: "Falta ANTHROPIC_API_KEY en el servidor." }, 500);

  let body: { prompt?: string; fotos?: string[] };
  try { body = await req.json(); } catch { return json({ code: "bad_request" }, 400); }
  const prompt = String(body.prompt || "").slice(0, 30000);
  const fotos = Array.isArray(body.fotos) ? body.fotos.slice(0, MAX_FOTOS).map(String) : [];
  if (!prompt) return json({ code: "bad_request" }, 400);

  let imagenes: unknown[] = [];
  try { imagenes = await Promise.all(fotos.map(fotoBase64)); }
  catch (e) { return json({ code: "images_unavailable", error: String(e) }, 400); }

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODELO,
      max_tokens: 4096,
      messages: [{ role: "user", content: [...imagenes, { type: "text", text: prompt }] }],
    }),
  });
  if (r.status === 429 || r.status === 529) return json({ code: "rate_limited" }, 429);
  if (!r.ok) return json({ code: "ia_error", error: (await r.text()).slice(0, 500) }, 502);

  const data = await r.json();
  const texto = (data.content || []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("");
  try { return json({ resultado: sacarJSON(texto) }); }
  catch { return json({ code: "invalid_json", texto: texto.slice(0, 500) }, 502); }
});
