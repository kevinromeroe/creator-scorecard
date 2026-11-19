-- El PDF de cada ficha se guarda junto a la ficha (tipo 'pdf', contenido en base64 en la columna html).
alter table public.scorecard_archivos drop constraint if exists scorecard_archivos_tipo_check;
alter table public.scorecard_archivos add constraint scorecard_archivos_tipo_check check (tipo in ('ficha', 'comercial', 'pdf'));
