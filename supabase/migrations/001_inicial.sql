-- Inventario de Repuestos: esquema inicial para Supabase.
-- Pegalo entero en Supabase > SQL Editor > New query > Run.

-- 1) Tabla de repuestos. Cada fila guarda la ficha completa en "data" (mismo formato
--    que el documento del artefacto de Claude), así la migración es directa.
create table if not exists public.repuestos (
  id         text primary key default replace(gen_random_uuid()::text, '-', ''),
  data       jsonb not null default '{}'::jsonb,
  creado     bigint not null default (extract(epoch from now()) * 1000)::bigint,
  updated_at timestamptz not null default now()
);
create index if not exists repuestos_creado_idx on public.repuestos (creado desc);

alter table public.repuestos enable row level security;

-- Solo usuarios con sesión iniciada (lucas, franco, elvas) pueden leer y escribir.
drop policy if exists "usuarios leen" on public.repuestos;
create policy "usuarios leen" on public.repuestos
  for select to authenticated using (true);
drop policy if exists "usuarios cargan" on public.repuestos;
create policy "usuarios cargan" on public.repuestos
  for insert to authenticated with check (true);
drop policy if exists "usuarios editan" on public.repuestos;
create policy "usuarios editan" on public.repuestos
  for update to authenticated using (true) with check (true);
drop policy if exists "usuarios borran" on public.repuestos;
create policy "usuarios borran" on public.repuestos
  for delete to authenticated using (true);
grant select, insert, update, delete on public.repuestos to authenticated;

-- 2) Cambios parciales sin pisar lo que escribió otro: data = data || patch.
create or replace function public.patch_repuesto(p_id text, p_patch jsonb)
returns void language sql security invoker as $$
  update public.repuestos
     set data = data || p_patch, updated_at = now()
   where id = p_id;
$$;
revoke execute on function public.patch_repuesto(text, jsonb) from public, anon;
grant execute on function public.patch_repuesto(text, jsonb) to authenticated;

-- 3) Tiempo real: que la lista se actualice sola en todos los teléfonos.
alter table public.repuestos replica identity full;
do $$ begin
  alter publication supabase_realtime add table public.repuestos;
exception when duplicate_object then null; end $$;

-- 4) Fotos y videos. Bucket público para LEER (las fotos se muestran con <img>),
--    pero solo usuarios con sesión pueden subir o borrar. Límite 50 MB por archivo.
insert into storage.buckets (id, name, public, file_size_limit)
values ('repuestos', 'repuestos', true, 52428800)
on conflict (id) do update set public = true, file_size_limit = 52428800;

drop policy if exists "repuestos suben" on storage.objects;
create policy "repuestos suben" on storage.objects
  for insert to authenticated with check (bucket_id = 'repuestos');
drop policy if exists "repuestos actualizan" on storage.objects;
create policy "repuestos actualizan" on storage.objects
  for update to authenticated using (bucket_id = 'repuestos');
drop policy if exists "repuestos borran" on storage.objects;
create policy "repuestos borran" on storage.objects
  for delete to authenticated using (bucket_id = 'repuestos');

-- 5) Token de MercadoLibre (solo lo lee el servidor; ningún usuario de la app lo ve).
create table if not exists public.ml_token (
  id            int primary key default 1 check (id = 1),
  access_token  text,
  refresh_token text,
  expires_at    timestamptz,
  updated_at    timestamptz not null default now()
);
alter table public.ml_token enable row level security;
revoke all on public.ml_token from anon, authenticated;
-- Sin políticas: solo la service role (las funciones del servidor) puede tocarla.
