// Cosas compartidas por las funciones del servidor.

export const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
function clave(viejo: string, nuevo: string): string {
  const v = Deno.env.get(viejo);
  if (v) return v;
  try { const m = JSON.parse(Deno.env.get(nuevo) || "{}"); return m.default || Object.values(m)[0] as string || ""; }
  catch { return ""; }
}
export const ANON_KEY = clave("SUPABASE_ANON_KEY", "SUPABASE_PUBLISHABLE_KEYS");
export const SERVICE_KEY = clave("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEYS");

export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

// La clave "anon" también es un JWT válido, así que no alcanza con verify_jwt:
// confirmamos que haya un usuario real con sesión iniciada.
export async function usuario(req: Request): Promise<{ id: string; email?: string } | null> {
  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: auth, apikey: ANON_KEY },
  });
  if (!r.ok) return null;
  const u = await r.json();
  return u && u.id ? { id: u.id, email: u.email } : null;
}

// Llamadas a la base con permisos de servidor (para el token de MercadoLibre).
export async function rest(path: string, init: RequestInit = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      ...(SERVICE_KEY.startsWith("eyJ") ? { Authorization: `Bearer ${SERVICE_KEY}` } : {}),
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
}
