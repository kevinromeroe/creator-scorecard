-- Colaboraciones de cada ficha para que el analista las confirme o corrija desde la plataforma.
-- El OptiPlex las publica (propuesta de Claude) y, cuando el analista decide, las aplica y rehace ficha y PDF.
create table if not exists public.scorecard_colaboraciones (
  id              bigserial primary key,
  solicitud_id    uuid not null references public.scorecard_solicitudes(id) on delete cascade,
  codigo          text not null,                 -- id de la publicación
  red             text not null,
  fecha           date,
  url             text,
  texto           text,
  senales         jsonb not null default '[]'::jsonb,
  propuesta_es    boolean,                       -- lo que propuso Claude
  propuesta_marca text,
  estado          text not null default 'por_confirmar'
                  check (estado in ('por_confirmar', 'confirmada', 'rechazada')),
  marca           text,                          -- marca final (editable por el analista)
  decidido_por    text,
  decidido_en     timestamptz,
  aplicado        boolean not null default false,  -- el OptiPlex ya rehízo la ficha con esta decisión
  unique (solicitud_id, codigo)
);
alter table public.scorecard_colaboraciones enable row level security;

drop policy if exists scorecard_colab_ver on public.scorecard_colaboraciones;
create policy scorecard_colab_ver on public.scorecard_colaboraciones
  for select to authenticated using (public.scorecard_es_analista());

drop policy if exists scorecard_colab_decidir on public.scorecard_colaboraciones;
create policy scorecard_colab_decidir on public.scorecard_colaboraciones
  for update to authenticated using (public.scorecard_es_analista())
  with check (public.scorecard_es_analista() and estado in ('confirmada', 'rechazada'));

-- El analista solo puede cambiar la decisión y la marca; lo demás lo controla el OptiPlex.
create or replace function public.scorecard_colab_solo_decision() returns trigger
language plpgsql as $$
begin
  if current_user = 'authenticated' then
    new.solicitud_id := old.solicitud_id; new.codigo := old.codigo; new.red := old.red; new.fecha := old.fecha;
    new.url := old.url; new.texto := old.texto; new.senales := old.senales;
    new.propuesta_es := old.propuesta_es; new.propuesta_marca := old.propuesta_marca;
    new.decidido_por := coalesce(auth.jwt() ->> 'email', 'analista');
    new.decidido_en := now();
    new.aplicado := false;
    if new.estado = 'rechazada' then new.marca := null; end if;
    if new.estado = 'confirmada' and coalesce(trim(new.marca), '') = '' then
      raise exception 'Escribe el nombre de la marca para confirmar la colaboración.';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists scorecard_colab_decision on public.scorecard_colaboraciones;
create trigger scorecard_colab_decision before update on public.scorecard_colaboraciones
  for each row execute function public.scorecard_colab_solo_decision();

-- Supabase da todos los permisos por defecto: se dejan solo los necesarios.
revoke all on public.scorecard_colaboraciones from anon, authenticated;
grant select, update (estado, marca) on public.scorecard_colaboraciones to authenticated;
