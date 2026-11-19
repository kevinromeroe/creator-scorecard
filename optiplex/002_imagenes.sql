-- Imágenes de cada ficha (foto de perfil y portadas) dentro de la base de producción del OptiPlex.
-- Se guarda el archivo completo (bytea) y sus datos: así la imagen sobrevive aunque se borren las carpetas,
-- y se puede saber de dónde salió (captura de pantalla, URL de la red o Apify) y verificar su huella.
create table if not exists imagenes (
  id            bigserial primary key,
  handle        text not null references creadores(handle) on delete cascade,
  red           text,                              -- null = foto de perfil elegida para la ficha
  codigo        text not null,                     -- id de la publicación, o 'avatar'
  tipo          text not null check (tipo in ('avatar', 'portada')),
  origen        text not null check (origen in ('captura', 'url', 'apify', 'desconocido')),
  formato       text not null,                     -- image/png, image/jpeg
  ancho         int,
  alto          int,
  bytes         int not null,
  sha256        text not null,
  ruta          text,                              -- dónde está el archivo en el OptiPlex
  contenido     bytea not null,
  capturada_en  timestamptz not null default now(),
  unique (handle, codigo, sha256)
);
create index if not exists imagenes_handle on imagenes (handle, tipo);

-- Qué imágenes usó cada ficha
create table if not exists ficha_imagenes (
  solicitud_id  uuid not null references solicitudes(id) on delete cascade,
  imagen_id     bigint not null references imagenes(id) on delete cascade,
  primary key (solicitud_id, imagen_id)
);
