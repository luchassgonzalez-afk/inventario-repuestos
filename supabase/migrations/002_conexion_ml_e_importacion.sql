-- Conexión con MercadoLibre desde la app (botón "Conectar MercadoLibre") e importación de fotos.

-- Estado temporal del pedido de autorización a MercadoLibre (lo usa la función ml-auth).
alter table public.ml_token add column if not exists estado text;
alter table public.ml_token add column if not exists estado_creado timestamptz;
alter table public.ml_token add column if not exists volver text;

-- Los usuarios con sesión pueden listar los archivos del bucket (lo necesita la importación).
create policy "repuestos leen" on storage.objects
  for select to authenticated using (bucket_id = 'repuestos');
