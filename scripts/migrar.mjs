#!/usr/bin/env node
// Pasa las piezas y fotos exportadas del artefacto de Claude a Supabase.
// Uso (desde la carpeta app-repuestos):
//   SUPABASE_URL=https://xxxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=eyJ... node scripts/migrar.mjs
// Se puede correr más de una vez: si una pieza o foto ya está, la actualiza en vez de duplicarla.

import { readdir, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { env, exit } from "node:process";

const URL_SB = (env.SUPABASE_URL || "").replace(/\/$/, "");
const KEY = env.SUPABASE_SERVICE_ROLE_KEY || "";
if (!URL_SB || !KEY) { console.error("Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY."); exit(1); }

const base = join(dirname(fileURLToPath(import.meta.url)), "..", "migracion", "datos");
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };

// 1) Fotos: se suben con el mismo id que tenían, así las fichas siguen apuntando bien.
const fotos = (await readdir(join(base, "fotos"))).filter((f) => !f.startsWith("."));
let okF = 0;
for (const f of fotos) {
  const id = f.replace(/\.[^.]+$/, "");
  const tipo = /\.png$/i.test(f) ? "image/png" : /\.mp4$/i.test(f) ? "video/mp4" : /\.mov$/i.test(f) ? "video/quicktime" : "image/jpeg";
  const r = await fetch(`${URL_SB}/storage/v1/object/repuestos/${id}`, {
    method: "POST",
    headers: { ...H, "Content-Type": tipo, "x-upsert": "true", "cache-control": "max-age=31536000" },
    body: await readFile(join(base, "fotos", f)),
  });
  if (r.ok) okF++; else console.log(`✘ foto ${f}: ${r.status} ${await r.text()}`);
}
console.log(`Fotos: ${okF} de ${fotos.length} subidas.`);

// 2) Piezas
const archivos = (await readdir(join(base, "repuestos"))).filter((f) => f.endsWith(".json"));
const filas = [];
for (const f of archivos) {
  const data = JSON.parse(await readFile(join(base, "repuestos", f), "utf8"));
  data.autor = data.autor && !String(data.autor).startsWith("u_") ? data.autor : "importado";
  filas.push({ id: f.replace(/\.json$/, ""), data, creado: Number(data.creado) || Date.now() });
}
for (let i = 0; i < filas.length; i += 20) {
  const r = await fetch(`${URL_SB}/rest/v1/repuestos?on_conflict=id`, {
    method: "POST",
    headers: { ...H, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(filas.slice(i, i + 20)),
  });
  if (!r.ok) { console.error(`✘ piezas: ${r.status} ${await r.text()}`); exit(1); }
}
console.log(`Piezas: ${filas.length} cargadas. Abrí la app y deberían estar todas.`);
