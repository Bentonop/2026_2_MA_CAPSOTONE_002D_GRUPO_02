-- Actualiza una base existente sin ejecutar el script de reinicio de datos.
BEGIN;

ALTER TABLE public.asistencia
    ADD COLUMN IF NOT EXISTS asistio boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS fecha_hora_ingreso TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS metodo_ingreso TEXT DEFAULT 'QR',
    ADD COLUMN IF NOT EXISTS token_qr_usado TEXT;

-- PostgreSQL conserva todos los datos si existen duplicados y aborta esta transacción.
CREATE UNIQUE INDEX IF NOT EXISTS asistencia_id_reserva_key ON public.asistencia (id_reserva);

-- Marcar manualmente y registrar QR docente actualizan asistencia y reserva juntas.
CREATE OR REPLACE FUNCTION public.registrar_asistencia_docente(
    p_clase_id integer,
    p_reserva_id integer,
    p_token_qr text DEFAULT NULL
)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
SET TimeZone = 'America/Santiago'
AS $func$
DECLARE
    v_docente uuid := auth.uid();
    v_clase public.clase%ROWTYPE;
    v_estado_reserva text;
    v_ingreso timestamptz;
BEGIN
    SELECT * INTO v_clase
    FROM public.clase
    WHERE id_clase = p_clase_id AND id_profesor = v_docente
    FOR SHARE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Solo el docente asignado puede registrar asistencia.' USING ERRCODE = '42501';
    END IF;

    IF v_clase.estado_clase = 'cancelada' THEN
        RAISE EXCEPTION 'La clase está cancelada.';
    END IF;

    IF p_token_qr IS NULL AND v_clase.estado_clase = 'programada'
       AND v_clase.fecha_hora_inicio > now() THEN
        RAISE EXCEPTION 'Comienza la clase antes de marcar asistencia manual.';
    END IF;

    SELECT estado_reserva INTO v_estado_reserva
    FROM public.reserva
    WHERE id_reserva = p_reserva_id AND id_clase = p_clase_id
    FOR UPDATE;

    IF NOT FOUND OR v_estado_reserva IS NULL
       OR v_estado_reserva NOT IN ('confirmada', 'presente') THEN
        RAISE EXCEPTION 'El alumno necesita una reserva confirmada para esta clase.';
    END IF;

    INSERT INTO public.asistencia AS a
        (id_reserva, asistio, fecha_hora_ingreso, metodo_ingreso, token_qr_usado)
    VALUES
        (p_reserva_id, true, now(), CASE WHEN p_token_qr IS NULL THEN 'MANUAL' ELSE 'QR_DOCENTE' END, p_token_qr)
    ON CONFLICT (id_reserva) DO UPDATE SET
        asistio = EXCLUDED.asistio,
        fecha_hora_ingreso = EXCLUDED.fecha_hora_ingreso,
        metodo_ingreso = EXCLUDED.metodo_ingreso,
        token_qr_usado = EXCLUDED.token_qr_usado
    WHERE a.asistio IS DISTINCT FROM true OR a.fecha_hora_ingreso IS NULL;

    SELECT fecha_hora_ingreso INTO v_ingreso
    FROM public.asistencia WHERE id_reserva = p_reserva_id;

    UPDATE public.reserva SET estado_reserva = 'presente'
    WHERE id_reserva = p_reserva_id AND estado_reserva <> 'presente';

    RETURN v_ingreso;
END;
$func$;

REVOKE ALL ON FUNCTION public.registrar_asistencia_docente(integer, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_asistencia_docente(integer, integer, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.puede_leer_asistencia(p_reserva_id integer)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $func$
    SELECT EXISTS (
        SELECT 1
        FROM public.reserva r
        JOIN public.clase c ON c.id_clase = r.id_clase
        WHERE r.id_reserva = p_reserva_id
          AND (
              r.id_usuario = auth.uid()
              OR c.id_profesor = auth.uid()
              OR EXISTS (
                  SELECT 1 FROM public.profiles p
                  WHERE p.id = auth.uid() AND p.role = 'administrador' AND p.active IS TRUE
              )
          )
    );
$func$;

REVOKE ALL ON FUNCTION public.puede_leer_asistencia(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.puede_leer_asistencia(integer) TO authenticated;

DROP POLICY IF EXISTS "Asistencia: Consulta autorizada" ON public.asistencia;
CREATE POLICY "Asistencia: Consulta autorizada" ON public.asistencia
    FOR SELECT TO authenticated USING (public.puede_leer_asistencia(id_reserva));

COMMIT;
