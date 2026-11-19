-- Pedir una ficha solo pasa por la función scorecard-pedir (sesión + analista autorizado + Turnstile).
-- El navegador ya no puede insertar directo en la cola.
drop policy if exists scorecard_crear on public.scorecard_solicitudes;
