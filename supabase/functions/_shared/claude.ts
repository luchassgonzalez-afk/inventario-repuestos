// Cliente de Claude compartido por las funciones "ia" y "precios-ml".
// La clave de Anthropic queda en el servidor (secreto ANTHROPIC_API_KEY).

import Anthropic from "npm:@anthropic-ai/sdk@1.4.0";
import { json } from "./comun.ts";

export { Anthropic };
export const API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
export const MODELO = Deno.env.get("ANTHROPIC_MODEL") || "claude-sonnet-5-5";
// Supabase corta cada función a los 150 segundos: los reintentos los hace la app.
export const claude = new Anthropic({ apiKey: API_KEY || "sin-clave", maxRetries: 0, timeout: 120_000 });

export function sinClave() {
  return json({ code: "sampling_disabled", error: "Falta ANTHROPIC_API_KEY en el servidor." }, 500);
}

// Saca el JSON de la respuesta aunque venga con ``` o con texto alrededor.
export function sacarJSON(texto: string): unknown {
  const t = texto.replace(/```(?:json)?/gi, "").trim();
  try { return JSON.parse(t); } catch { /* sigue */ }
  const ini = Math.min(...["{", "["].map((c) => { const i = t.indexOf(c); return i < 0 ? Infinity : i; }));
  const fin = Math.max(t.lastIndexOf("}"), t.lastIndexOf("]"));
  if (ini === Infinity || fin <= ini) throw new Error("invalid_json");
  return JSON.parse(t.slice(ini, fin + 1));
}

export function textoDe(msg: Anthropic.Message): string {
  return msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
}

// Traduce los errores de la API a los códigos que entiende la app.
export function errorIA(e: unknown): Response {
  if (e instanceof Anthropic.APIConnectionTimeoutError) {
    return json({ code: "ia_tardo", error: "La IA tardó demasiado." }, 504);
  }
  if (e instanceof Anthropic.APIError) {
    const st = e.status;
    if (st === 429 || st === 529) return json({ code: "rate_limited" }, 429);
    if (st === 401) return json({ code: "ia_clave", error: "La clave de Anthropic no es válida." }, 500);
    if (st === 402) return json({ code: "ia_sin_credito", error: "Se terminó el crédito de Claude." }, 402);
    console.error("Error de la API de Claude", st, e.message);
    return json({ code: "ia_error", error: `La IA respondió ${st ?? "con un error"}: ${e.message}`.slice(0, 500) }, 502);
  }
  console.error("Error llamando a Claude", e);
  return json({ code: "ia_error", error: String(e).slice(0, 500) }, 502);
}
