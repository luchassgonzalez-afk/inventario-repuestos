// Función "ml-auth": conecta la app con MercadoLibre (una vez; se puede repetir si se corta).
// 1) La app (con sesión iniciada) hace POST { volver } → se guarda un "estado" al azar y se devuelve
//    la URL de autorización de MercadoLibre.
// 2) MercadoLibre vuelve acá con ?code=...&state=... → se valida el estado, se guarda el token en
//    la tabla ml_token y se vuelve a la app con ?ml=ok.
// Va con "Verify JWT" apagado porque MercadoLibre vuelve sin sesión de Supabase; el POST igual
// exige un usuario con sesión iniciada.
// Secretos necesarios: ML_CLIENT_ID y ML_CLIENT_SECRET (de developers.mercadolibre.com.ar).

import { cors, json, usuario, rest, SUPABASE_URL } from "../_shared/comun.ts";
import { guardarToken, ML_CLIENT_ID, ML_CLIENT_SECRET, ML_REDIRECT_URI } from "../_shared/ml.ts";

// En supabase.co las funciones no pueden devolver HTML (se muestra como texto), así que va texto plano.
function pagina(texto: string, status = 200) {
  return new Response(`MercadoLibre\n\n${texto}\n`, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const configurado = !!(ML_CLIENT_ID && ML_CLIENT_SECRET);

  // 1) Inicio desde la app
  if (req.method === "POST") {
    if (!(await usuario(req))) return json({ code: "not_granted", error: "Iniciá sesión." }, 401);
    if (!configurado) return json({ code: "ml_sin_configurar", error: "Faltan ML_CLIENT_ID y ML_CLIENT_SECRET en Supabase." }, 500);
    let volver = "";
    try { volver = String((await req.json()).volver || "").slice(0, 500); } catch { /* sin volver */ }
    if (!/^https:\/\//.test(volver)) volver = "";
    const estado = crypto.randomUUID();
    const r = await rest("ml_token?on_conflict=id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({ id: 1, estado, estado_creado: new Date().toISOString(), volver }),
    });
    if (!r.ok) return json({ code: "error", error: "No se pudo preparar la conexión." }, 500);
    const auth = new URL("https://auth.mercadolibre.com.ar/authorization");
    auth.searchParams.set("response_type", "code");
    auth.searchParams.set("client_id", ML_CLIENT_ID);
    auth.searchParams.set("redirect_uri", ML_REDIRECT_URI);
    auth.searchParams.set("state", estado);
    return json({ url: auth.toString() });
  }

  // 2) Vuelta desde MercadoLibre
  const u = new URL(req.url);
  const code = u.searchParams.get("code");
  const state = u.searchParams.get("state") || "";
  if (!configurado) return pagina("Faltan configurar ML_CLIENT_ID y ML_CLIENT_SECRET en Supabase.", 500);
  if (!code) return pagina("Para conectar MercadoLibre tocá el botón \"Conectar MercadoLibre\" en la app.", 400);

  const fr = await rest("ml_token?id=eq.1&select=estado,estado_creado,volver");
  const fila = fr.ok ? (await fr.json())[0] : null;
  const vigente = fila && fila.estado && fila.estado === state &&
    Date.now() - new Date(fila.estado_creado).getTime() < 30 * 60 * 1000;
  if (!vigente) return pagina("El enlace venció o no es válido. Volvé a tocar \"Conectar MercadoLibre\" en la app.", 403);

  const r = await fetch("https://api.mercadolibre.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "authorization_code", client_id: ML_CLIENT_ID, client_secret: ML_CLIENT_SECRET,
      code, redirect_uri: ML_REDIRECT_URI,
    }),
  });
  const t = r.ok ? await r.json() : null;
  if (!t || !t.access_token) return pagina("MercadoLibre no aceptó la conexión. Volvé a intentar desde la app.", 502);
  await guardarToken(t);
  await rest("ml_token?id=eq.1", { method: "PATCH", body: JSON.stringify({ estado: null }) });

  if (fila.volver) {
    const v = new URL(fila.volver);
    v.searchParams.set("ml", "ok");
    return Response.redirect(v.toString(), 302);
  }
  return pagina("Listo, la app quedó conectada con MercadoLibre. Ya podés cerrar esta pestaña.");
});

// (SUPABASE_URL se importa para que quede claro de dónde sale ML_REDIRECT_URI.)
void SUPABASE_URL;
