// Token de MercadoLibre guardado en la tabla ml_token (solo servidor).
import { rest, SUPABASE_URL } from "./comun.ts";

export const ML_CLIENT_ID = Deno.env.get("ML_CLIENT_ID") || "";
export const ML_CLIENT_SECRET = Deno.env.get("ML_CLIENT_SECRET") || "";
export const ML_REDIRECT_URI = Deno.env.get("ML_REDIRECT_URI") || `${SUPABASE_URL}/functions/v1/ml-auth`;

type Tok = { access_token?: string; refresh_token?: string; expires_at?: string };

export async function guardarToken(t: { access_token: string; refresh_token?: string; expires_in?: number }) {
  const fila = {
    id: 1,
    access_token: t.access_token,
    refresh_token: t.refresh_token ?? null,
    expires_at: new Date(Date.now() + ((t.expires_in || 21600) - 300) * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  };
  await rest("ml_token?on_conflict=id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify(fila),
  });
}

async function pedirToken(params: Record<string, string>) {
  const r = await fetch("https://api.mercadolibre.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ client_id: ML_CLIENT_ID, client_secret: ML_CLIENT_SECRET, ...params }),
  });
  if (!r.ok) return null;
  const t = await r.json();
  if (!t.access_token) return null;
  await guardarToken(t);
  return t.access_token as string;
}

export function canjearCodigo(code: string) {
  return pedirToken({ grant_type: "authorization_code", code, redirect_uri: ML_REDIRECT_URI });
}

// Devuelve un access token válido, o "" si no hay forma de conseguirlo.
export async function tokenML(forzar = false): Promise<string> {
  if (!ML_CLIENT_ID || !ML_CLIENT_SECRET) return "";
  const r = await rest("ml_token?id=eq.1&select=*");
  const filas: Tok[] = r.ok ? await r.json() : [];
  const t = filas[0] || {};
  const vigente = t.access_token && t.expires_at && new Date(t.expires_at).getTime() > Date.now();
  if (vigente && !forzar) return t.access_token!;
  if (t.refresh_token) {
    const nuevo = await pedirToken({ grant_type: "refresh_token", refresh_token: t.refresh_token });
    if (nuevo) return nuevo;
  }
  // Último intento: token de aplicación (no siempre está habilitado para todas las apps).
  return (await pedirToken({ grant_type: "client_credentials" })) || "";
}
