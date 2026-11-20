-- Enlace de la página pública de cada ficha (scorecard.datalitica.com.co/@usuario-fecha/), para enviársela al cliente.
-- Lo escribe el OptiPlex al publicar; el analista solo lo lee.
alter table public.scorecard_solicitudes add column if not exists enlace_publico text;
