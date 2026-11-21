-- Aplicar después de vigencia_planes.sql desde el editor SQL de Supabase.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

SELECT cron.schedule(
    'capstone-vencer-suscripciones',
    '* * * * *',
    'SELECT public.vencer_suscripciones();'
);
