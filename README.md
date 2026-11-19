# Creator Scorecard

Plataforma interna de Datalítica (https://scorecard.datalitica.com.co): un analista entra con su usuario,
pega el perfil de Instagram de un creador y recibe su ficha de desempeño.

- Página estática (GitHub Pages): `index.html`, `assets/app.js`, `assets/app.css`.
- Datos: Supabase (proyecto tidctfgcbzziiqnbjjer). Esquema en `supabase/migrations/`.
- La ficha la arma el OptiPlex (`fichas-creadores/scripts/scorecard_worker.py`, cron cada minuto).
- La clave del navegador es la pública (anon); los permisos los da RLS y la lista `scorecard_analistas`.
