-- Creator Scorecard (scorecard.datalitica.com.co)
-- Vive en el proyecto Supabase tidctfgcbzziiqnbjjer junto al formulario de pipeagency (prefijo scorecard_).
-- El navegador solo entra con usuario y contraseña (Supabase Auth). El OptiPlex usa la clave secreta.

-- Solo los correos de esta lista entran a la plataforma, aunque alguien logre crear un usuario.
create table if not exists public.scorecard_analistas (
  email     text primary key,
  nombre    text,
  creado_en timestamptz not null default now()
);
alter table public.scorecard_analistas enable row level security;   -- sin políticas: nadie la lee desde el navegador

create or replace function public.scorecard_es_analista() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.scorecard_analistas where lower(email) = lower(auth.jwt() ->> 'email'));
$$;

create table if not exists public.scorecard_solicitudes (
  id               uuid primary key default gen_random_uuid(),
  creado_en        timestamptz not null default now(),
  actualizado_en   timestamptz not null default now(),
  creado_por       uuid not null default auth.uid() references auth.users(id),
  enlace_instagram text not null
                   check (enlace_instagram ~* '^https://(www\.)?instagram\.com/[A-Za-z0-9._]{1,30}/?(\?.*)?$'),
  enlace_tiktok    text
                   check (enlace_tiktok is null or enlace_tiktok ~* '^https://(www\.)?tiktok\.com/@[A-Za-z0-9._]{1,30}/?(\?.*)?$'),
  nicho            text not null default 'sin definir',
  handle           text,
  estado           text not null default 'recibida'
                   check (estado in ('recibida', 'en_proceso', 'lista', 'error')),
  etapa            text,
  segundos         numeric,
  error            text,
  notas            jsonb not null default '[]'::jsonb,
  por_confirmar    int,
  ruta             text            -- carpeta en el bucket scorecard-fichas
);

create index if not exists scorecard_solicitudes_estado on public.scorecard_solicitudes (estado, creado_en);

alter table public.scorecard_solicitudes enable row level security;

-- El analista ve y crea solicitudes; no puede editarlas ni borrarlas (eso lo hace el OptiPlex).
drop policy if exists scorecard_ver on public.scorecard_solicitudes;
create policy scorecard_ver on public.scorecard_solicitudes
  for select to authenticated using (public.scorecard_es_analista());

drop policy if exists scorecard_crear on public.scorecard_solicitudes;
create policy scorecard_crear on public.scorecard_solicitudes
  for insert to authenticated
  with check (public.scorecard_es_analista() and creado_por = auth.uid() and estado = 'recibida' and etapa is null and ruta is null);

-- Límite: 10 solicitudes por usuario por día (protege el saldo de Apify).
create or replace function public.scorecard_limite_diario() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.scorecard_solicitudes
      where creado_por = new.creado_por and creado_en > now() - interval '1 day') >= 10 then
    raise exception 'Llegaste al límite de 10 fichas por día.';
  end if;
  new.handle := lower(substring(new.enlace_instagram from 'instagram\.com/([A-Za-z0-9._]+)'));
  return new;
end $$;

drop trigger if exists scorecard_limite on public.scorecard_solicitudes;
create trigger scorecard_limite before insert on public.scorecard_solicitudes
  for each row execute function public.scorecard_limite_diario();

-- Fichas listas: bucket privado; el analista autenticado puede leerlas, solo el OptiPlex las sube.
insert into storage.buckets (id, name, public)
values ('scorecard-fichas', 'scorecard-fichas', false)
on conflict (id) do nothing;

drop policy if exists scorecard_leer_fichas on storage.objects;
create policy scorecard_leer_fichas on storage.objects
  for select to authenticated using (bucket_id = 'scorecard-fichas' and public.scorecard_es_analista());
