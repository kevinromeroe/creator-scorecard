-- Las fichas listas se guardan en la base (no en Storage): así el OptiPlex solo necesita la conexión a
-- Postgres que ya tiene (DB_URL_polar en ~/ops/secrets/ops.env) y no hace falta otra clave.
create table if not exists public.scorecard_archivos (
  solicitud_id uuid not null references public.scorecard_solicitudes(id) on delete cascade,
  tipo         text not null check (tipo in ('ficha', 'comercial')),
  html         text not null,
  creado_en    timestamptz not null default now(),
  primary key (solicitud_id, tipo)
);
alter table public.scorecard_archivos enable row level security;

drop policy if exists scorecard_leer_archivos on public.scorecard_archivos;
create policy scorecard_leer_archivos on public.scorecard_archivos
  for select to authenticated using (public.scorecard_es_analista());

-- El bucket ya no se usa.
drop policy if exists scorecard_leer_fichas on storage.objects;
