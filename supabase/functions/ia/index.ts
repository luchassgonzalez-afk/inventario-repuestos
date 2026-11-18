// Función "ia": reemplaza a claude.use("sample") del artefacto.
// Recibe { prompt, fotos?: [ids del bucket "repuestos"] } y devuelve { resultado } con el JSON
// que respondió Claude.

import { encodeBase64 } from "jsr:@std/encoding@1/base64";
import { cors, json, usuario, SUPABASE_URL } from "../_shared/comun.ts";
import { Anthropic, API_KEY, MODELO, claude, errorIA, sacarJSON, sinClave, textoDe } from "../_shared/claude.ts";

const MAX_FOTOS = 8;
type Tipo = "image/jpeg" | "image/png" | "image/webp" | "image/gif";

async function fotoBase64(id: string): Promise<Anthropic.ImageBlockParam> {
  if (!/^[A-Za-z0-9_\-.]{6,120}$/.test(id)) throw new Error("foto_invalida");
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/public/repuestos/${id}`);
  if (!r.ok) throw new Error("foto_no_encontrada");
  let tipo = (r.headers.get("content-type") || "image/jpeg").split(";")[0] as Tipo;
  if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(tipo)) tipo = "image/jpeg";
  const bytes = new Uint8Array(await r.arrayBuffer());
  return { type: "image", source: { type: "base64", media_type: tipo, data: encodeBase64(bytes) } };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ code: "method" }, 405);
  if (!(await usuario(req))) return json({ code: "not_granted", error: "Iniciá sesión." }, 401);
  if (!API_KEY) return sinClave();

  let body: { prompt?: string; fotos?: string[] };
  try { body = await req.json(); } catch { return json({ code: "bad_request" }, 400); }
  const prompt = String(body.prompt || "").slice(0, 30000);
  const fotos = Array.isArray(body.fotos) ? body.fotos.slice(0, MAX_FOTOS).map(String) : [];
  if (!prompt) return json({ code: "bad_request" }, 400);

  let imagenes: Anthropic.ImageBlockParam[] = [];
  try { imagenes = await Promise.all(fotos.map(fotoBase64)); }
  catch (e) { return json({ code: "images_unavailable", error: String(e) }, 400); }

  let resp: Anthropic.Message;
  try {
    resp = await claude.messages.create({
      model: MODELO,
      // Alcanza para el razonamiento del modelo más el JSON de una lista de 40 repuestos.
      max_tokens: 16000,
      messages: [{ role: "user", content: [...imagenes, { type: "text", text: prompt }] }],
    });
  } catch (e) { return errorIA(e); }

  const texto = textoDe(resp);
  try { return json({ resultado: sacarJSON(texto) }); }
  catch {
    console.error("Respuesta sin JSON", resp.stop_reason, texto.slice(0, 300));
    return json({ code: "invalid_json", texto: texto.slice(0, 500) }, 502);
  }
});
