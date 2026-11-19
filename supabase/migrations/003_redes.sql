-- Varias redes por solicitud (Instagram, TikTok, Facebook, YouTube), sin nicho, ventana de 30 días.
alter table public.scorecard_solicitudes
  add column if not exists redes jsonb not null default '[]'::jsonb,   -- [{"red": "tiktok", "url": "https://…"}]
  add column if not exists ventana_dias int not null default 30;
alter table public.scorecard_solicitudes alter column enlace_instagram drop not null;
alter table public.scorecard_solicitudes alter column nicho drop not null;

create or replace function public.scorecard_validar_redes(r jsonb) returns boolean
language plpgsql immutable as $$
declare x jsonb; vistos text[] := '{}';
begin
  if jsonb_typeof(r) <> 'array' or jsonb_array_length(r) < 1 or jsonb_array_length(r) > 4 then return false; end if;
  for x in select * from jsonb_array_elements(r) loop
    if x->>'red' = any(vistos) then return false; end if;
    vistos := vistos || (x->>'red');
    if not (
      (x->>'red' = 'instagram' and x->>'url' ~* '^https://(www\.)?instagram\.com/[A-Za-z0-9._]{1,30}/?$') or
      (x->>'red' = 'tiktok'    and x->>'url' ~* '^https://(www\.)?tiktok\.com/@[A-Za-z0-9._]{1,30}/?$') or
      (x->>'red' = 'facebook'  and x->>'url' ~* '^https://(www\.|m\.)?facebook\.com/[A-Za-z0-9._-]{1,80}/?$') or
      (x->>'red' = 'youtube'   and x->>'url' ~* '^https://(www\.)?youtube\.com/@[A-Za-z0-9._-]{1,60}/?$')
    ) then return false; end if;
  end loop;
  return true;
end $$;

alter table public.scorecard_solicitudes drop constraint if exists scorecard_redes_validas;
alter table public.scorecard_solicitudes add constraint scorecard_redes_validas
  check (redes = '[]'::jsonb or public.scorecard_validar_redes(redes));
alter table public.scorecard_solicitudes drop constraint if exists scorecard_ventana;
alter table public.scorecard_solicitudes add constraint scorecard_ventana check (ventana_dias in (30));

-- El usuario (handle) sale de la primera red elegida.
create or replace function public.scorecard_limite_diario() returns trigger
language plpgsql security definer set search_path = public as $$
declare u text;
begin
  if (select count(*) from public.scorecard_solicitudes
      where creado_por = new.creado_por and creado_en > now() - interval '1 day') >= 10 then
    raise exception 'Llegaste al límite de 10 fichas por día.';
  end if;
  if new.redes = '[]'::jsonb and new.enlace_instagram is not null then   -- solicitudes antiguas
    new.redes := jsonb_build_array(jsonb_build_object('red', 'instagram', 'url', new.enlace_instagram));
  end if;
  u := substring(new.redes->0->>'url' from '(?:instagram\.com/|tiktok\.com/@|facebook\.com/|youtube\.com/@)([A-Za-z0-9._-]+)');
  new.handle := lower(u);
  return new;
end $$;
