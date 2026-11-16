#!/usr/bin/env node
// Crea los usuarios de la app en Supabase (una sola vez).
// Uso:
//   SUPABASE_URL=https://xxxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=eyJ... node scripts/crear-usuarios.mjs
// Te pide la contraseña inicial por teclado (no queda guardada en ningún archivo).
// Cada usuario tiene que cambiarla la primera vez que entra.

import readline from "node:readline/promises";
import { stdin, stdout, env, exit } from "node:process";

const URL_SB = (env.SUPABASE_URL || "").replace(/\/$/, "");
const KEY = env.SUPABASE_SERVICE_ROLE_KEY || "";
const DOMINIO = env.DOMINIO_USUARIOS || "repuestos-app.com.ar"; // tiene que ser igual al de web/config.js
const USUARIOS = (env.USUARIOS || "lucas,franco,elvas").split(",").map((u) => u.trim().toLowerCase()).filter(Boolean);

if (!URL_SB || !KEY) {
  console.error("Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (Supabase > Project Settings > API).");
  exit(1);
}

const rl = readline.createInterface({ input: stdin, output: stdout });
const clave = env.CLAVE_INICIAL || (await rl.question(`Contraseña inicial para ${USUARIOS.join(", ")}: `));
rl.close();
if (clave.length < 6) { console.error("Supabase pide al menos 6 caracteres."); exit(1); }

const headers = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

for (const u of USUARIOS) {
  const email = `${u}@${DOMINIO}`;
  const r = await fetch(`${URL_SB}/auth/v1/admin/users`, {
    method: "POST",
    headers,
    body: JSON.stringify({ email, password: clave, email_confirm: true, user_metadata: { nombre: u, cambiar_clave: true } }),
  });
  if (r.ok) console.log(`✔ ${u} creado (entra con usuario "${u}")`);
  else {
    const t = await r.text();
    if (/already|exists|registered/i.test(t)) console.log(`• ${u} ya existía, no lo toqué`);
    else console.log(`✘ ${u}: ${r.status} ${t}`);
  }
}
