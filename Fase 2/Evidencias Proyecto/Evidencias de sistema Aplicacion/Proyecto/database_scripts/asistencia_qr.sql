-- Actualiza una base existente sin ejecutar el script de reinicio de datos.
BEGIN;

ALTER TABLE public.asistencia
    ADD COLUMN IF NOT EXISTS fecha_hora_ingreso TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS metodo_ingreso TEXT DEFAULT 'QR',
    ADD COLUMN IF NOT EXISTS token_qr_usado TEXT;

-- PostgreSQL conserva todos los datos si existen duplicados y aborta esta transacción.
CREATE UNIQUE INDEX IF NOT EXISTS asistencia_id_reserva_key ON public.asistencia (id_reserva);

COMMIT;
