-- Modelo de datos de Creator Scorecard en el OptiPlex (PostgreSQL 18 local, base "scorecard").
-- Es la base de producción con todo el detalle; Supabase solo guarda la cola, el usuario y la ficha final.
-- Crear:  createdb scorecard && psql -d scorecard -f optiplex/001_modelo.sql

create table if not exists creadores (
  handle          text primary key,             -- usuario de la primera red pedida (carpeta fichas/<handle>)
  nombre          text,
  creado_en       timestamptz not null default now()
);

create table if not exists cuentas (            -- una fila por red del creador
  handle          text not null references creadores(handle) on delete cascade,
  red             text not null check (red in ('instagram', 'tiktok', 'facebook', 'youtube')),
  url             text not null,
  usuario         text,
  primary key (handle, red)
);

create table if not exists solicitudes (        -- espejo de scorecard_solicitudes (Supabase)
  id              uuid primary key,
  handle          text not null references creadores(handle),
  ventana_dias    int  not null default 30,
  estado          text not null,
  etapa           text,
  segundos        numeric,
  error           text,
  creado_en       timestamptz not null,
  terminado_en    timestamptz
);

create table if not exists solicitud_redes (    -- redes elegidas en cada solicitud y cómo quedó cada una
  solicitud_id    uuid not null references solicitudes(id) on delete cascade,
  red             text not null,
  url             text not null,
  estado          text not null default 'pendiente'
                  check (estado in ('pendiente', 'capturada', 'pendiente_chrome', 'error')),
  publicaciones   int,
  comentarios     int,
  primary key (solicitud_id, red)
);

create table if not exists perfiles (           -- foto del perfil en cada captura
  handle          text not null,
  red             text not null,
  fecha_captura   date not null,
  nombre          text,
  seguidores      bigint,
  verificado      boolean,
  bio             text,
  primary key (handle, red, fecha_captura)
);

create table if not exists publicaciones (
  red             text not null,
  codigo          text not null,
  handle          text not null,
  url             text,
  fecha           date,
  tipo            text,
  categoria       text,
  marca           text,
  reproducciones  bigint,
  me_gusta        bigint,
  comentarios     bigint,
  guardados       bigint,
  interacciones   bigint,
  tasa            numeric,
  hallazgo        text,
  opinion         jsonb,
  actualizado_en  timestamptz not null default now(),
  primary key (red, codigo)
);

create table if not exists comentarios (        -- sin nombres de usuario, nunca
  id              text primary key,
  red             text not null,
  codigo          text not null,               -- publicación
  texto           text not null,
  reacciones      int,
  tema            text,
  tono            text,
  hacia_marca     text
);

create table if not exists fichas (
  solicitud_id    uuid primary key references solicitudes(id) on delete cascade,
  metricas        jsonb not null,               -- metricas.json completo
  html_bytes      int,
  creado_en       timestamptz not null default now()
);

create index if not exists publicaciones_handle on publicaciones (handle, red, fecha);
create index if not exists comentarios_pub on comentarios (red, codigo);
