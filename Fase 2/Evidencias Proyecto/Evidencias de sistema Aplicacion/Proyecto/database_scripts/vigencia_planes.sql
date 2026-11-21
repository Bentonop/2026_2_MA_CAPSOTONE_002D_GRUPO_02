BEGIN;

-- Las suscripciones antiguas conservan el inicio y el término registrados.
UPDATE public.user_suscripciones s
SET fecha_fin = s.fecha_inicio + p.duracion_dias * interval '24 hours'
FROM public.planes p
WHERE p.id_plan = s.plan_id AND s.estado = 'activa'
  AND s.fecha_inicio IS NOT NULL AND s.fecha_fin IS NULL;

CREATE OR REPLACE FUNCTION public.resolver_pago_plan(p_pago_id uuid, p_estado text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $func$
DECLARE
    v_pago public.user_pagos%ROWTYPE;
    v_plan public.planes%ROWTYPE;
    v_inicio timestamptz := now();
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'administrador') THEN
        RAISE EXCEPTION 'Solo administración puede resolver pagos.' USING ERRCODE = '42501';
    END IF;
    IF p_estado IS NULL OR p_estado NOT IN ('aprobado', 'rechazado') THEN
        RAISE EXCEPTION 'Estado de pago inválido.';
    END IF;

    SELECT * INTO v_pago FROM public.user_pagos WHERE id = p_pago_id FOR UPDATE;
    IF NOT FOUND OR v_pago.estado IS DISTINCT FROM 'pendiente' THEN
        RAISE EXCEPTION 'El pago ya fue revisado o no existe.';
    END IF;

    SELECT p.* INTO v_plan
    FROM public.user_suscripciones s JOIN public.planes p ON p.id_plan = s.plan_id
    WHERE s.id = v_pago.suscripcion_id AND s.user_id = v_pago.user_id AND s.estado = 'pendiente'
    FOR UPDATE OF s;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No se encontró una suscripción pendiente para este pago.';
    END IF;

    UPDATE public.user_suscripciones
    SET estado = CASE WHEN p_estado = 'aprobado' THEN 'activa' ELSE 'cancelada' END,
        fecha_inicio = CASE WHEN p_estado = 'aprobado' THEN v_inicio ELSE NULL END,
        fecha_fin = CASE WHEN p_estado = 'aprobado' THEN v_inicio + v_plan.duracion_dias * interval '24 hours' ELSE NULL END,
        creditos_restantes = CASE WHEN p_estado = 'aprobado' THEN v_plan.creditos_clases ELSE 0 END
    WHERE id = v_pago.suscripcion_id;

    UPDATE public.user_pagos SET estado = p_estado WHERE id = p_pago_id;
END;
$func$;

REVOKE ALL ON FUNCTION public.resolver_pago_plan(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolver_pago_plan(uuid, text) TO authenticated;

CREATE TABLE IF NOT EXISTS public.notificaciones_alumno (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    alumno_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    evento text NOT NULL,
    referencia text NOT NULL,
    titulo text NOT NULL,
    mensaje text NOT NULL,
    tipo text NOT NULL DEFAULT 'operativa',
    creado_en timestamptz NOT NULL DEFAULT now(),
    leida boolean NOT NULL DEFAULT false,
    descartada boolean NOT NULL DEFAULT false,
    UNIQUE (alumno_id, evento, referencia)
);
-- CREATE TABLE IF NOT EXISTS no añade la restricción a instalaciones anteriores.
CREATE UNIQUE INDEX IF NOT EXISTS notificaciones_alumno_alumno_id_evento_referencia_key
    ON public.notificaciones_alumno (alumno_id, evento, referencia);
CREATE INDEX IF NOT EXISTS notificaciones_alumno_bandeja
    ON public.notificaciones_alumno (alumno_id, creado_en DESC) WHERE NOT descartada;
ALTER TABLE public.notificaciones_alumno ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notificaciones_alumno_propia ON public.notificaciones_alumno;
CREATE POLICY notificaciones_alumno_propia ON public.notificaciones_alumno
    FOR SELECT TO authenticated USING (alumno_id = auth.uid());
DROP POLICY IF EXISTS notificaciones_alumno_actualizar ON public.notificaciones_alumno;
CREATE POLICY notificaciones_alumno_actualizar ON public.notificaciones_alumno
    FOR UPDATE TO authenticated USING (alumno_id = auth.uid()) WITH CHECK (alumno_id = auth.uid());
REVOKE ALL ON public.notificaciones_alumno FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE (leida, descartada) ON public.notificaciones_alumno TO authenticated;

CREATE OR REPLACE FUNCTION public.notificar_evento_alumno()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $func$
BEGIN
    IF TG_TABLE_NAME = 'user_suscripciones' THEN
        IF TG_OP = 'UPDATE' THEN
            IF NEW.estado IS NOT DISTINCT FROM OLD.estado THEN
                RETURN NEW;
            END IF;
        END IF;
        IF NEW.estado = 'activa' THEN
            INSERT INTO public.notificaciones_alumno (alumno_id, evento, referencia, titulo, mensaje)
            SELECT NEW.user_id, 'plan_aprobado', NEW.id::text, 'Plan activado', p.nombre_plan
            FROM public.planes p WHERE p.id_plan = NEW.plan_id
            ON CONFLICT DO NOTHING;
        ELSIF NEW.estado = 'vencida' AND NEW.fecha_fin <= now() THEN
            INSERT INTO public.notificaciones_alumno (alumno_id, evento, referencia, titulo, mensaje, creado_en)
            SELECT NEW.user_id, 'plan_vencido', NEW.id::text, 'Tu plan venció', p.nombre_plan, NEW.fecha_fin
            FROM public.planes p WHERE p.id_plan = NEW.plan_id
            ON CONFLICT DO NOTHING;
        END IF;
    ELSIF TG_TABLE_NAME = 'reserva' THEN
        IF TG_OP = 'DELETE' THEN
            IF OLD.estado_reserva IN ('confirmada', 'presente') AND auth.uid() IS DISTINCT FROM OLD.id_usuario THEN
                INSERT INTO public.notificaciones_alumno (alumno_id, evento, referencia, titulo, mensaje)
                SELECT OLD.id_usuario, 'clase_cancelada', c.id_clase::text, 'Tu clase fue cancelada', c.nombre_clase
                FROM public.clase c WHERE c.id_clase = OLD.id_clase
                ON CONFLICT DO NOTHING;
            END IF;
            RETURN OLD;
        END IF;
        IF NEW.estado_reserva = 'confirmada' THEN
            INSERT INTO public.notificaciones_alumno (alumno_id, evento, referencia, titulo, mensaje)
            SELECT NEW.id_usuario, 'reserva_confirmada', NEW.id_reserva::text, 'Inscripción confirmada', c.nombre_clase
            FROM public.clase c WHERE c.id_clase = NEW.id_clase
            ON CONFLICT DO NOTHING;
        END IF;
    ELSE
        IF TG_OP = 'DELETE' THEN
            INSERT INTO public.notificaciones_alumno (alumno_id, evento, referencia, titulo, mensaje)
            SELECT r.id_usuario, 'clase_cancelada', OLD.id_clase::text, 'Tu clase fue cancelada', OLD.nombre_clase
            FROM public.reserva r WHERE r.id_clase = OLD.id_clase AND r.estado_reserva IN ('confirmada', 'presente')
            ON CONFLICT DO NOTHING;
            RETURN OLD;
        END IF;
        IF NEW.estado_clase IN ('en_curso', 'cancelada') AND OLD.estado_clase IS DISTINCT FROM NEW.estado_clase THEN
            INSERT INTO public.notificaciones_alumno (alumno_id, evento, referencia, titulo, mensaje)
            SELECT r.id_usuario,
                   CASE WHEN NEW.estado_clase = 'en_curso' THEN 'clase_iniciada' ELSE 'clase_cancelada' END,
                   NEW.id_clase::text,
                   CASE WHEN NEW.estado_clase = 'en_curso' THEN 'Tu clase ha comenzado' ELSE 'Tu clase fue cancelada' END,
                   NEW.nombre_clase
            FROM public.reserva r WHERE r.id_clase = NEW.id_clase AND r.estado_reserva IN ('confirmada', 'presente')
            ON CONFLICT DO NOTHING;
        END IF;
    END IF;
    RETURN NEW;
END;
$func$;

REVOKE ALL ON FUNCTION public.notificar_evento_alumno() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS notificar_activacion_plan ON public.user_suscripciones;
CREATE TRIGGER notificar_activacion_plan AFTER INSERT OR UPDATE ON public.user_suscripciones
    FOR EACH ROW EXECUTE FUNCTION public.notificar_evento_alumno();
DROP TRIGGER IF EXISTS notificar_inscripcion ON public.reserva;
CREATE TRIGGER notificar_inscripcion AFTER INSERT OR DELETE ON public.reserva
    FOR EACH ROW EXECUTE FUNCTION public.notificar_evento_alumno();
DROP TRIGGER IF EXISTS notificar_estado_clase ON public.clase;
CREATE TRIGGER notificar_estado_clase AFTER UPDATE OF estado_clase ON public.clase
    FOR EACH ROW EXECUTE FUNCTION public.notificar_evento_alumno();
DROP TRIGGER IF EXISTS notificar_eliminacion_clase ON public.clase;
CREATE TRIGGER notificar_eliminacion_clase BEFORE DELETE ON public.clase
    FOR EACH ROW EXECUTE FUNCTION public.notificar_evento_alumno();

-- Evita que una escritura posterior recupere créditos de una suscripción vencida.
CREATE OR REPLACE FUNCTION public.controlar_vigencia_suscripcion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $func$
DECLARE
    v_duracion integer;
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF OLD.estado = 'vencida' OR (OLD.estado = 'activa' AND OLD.fecha_fin <= now()) THEN
            NEW.estado := 'vencida';
            NEW.fecha_fin := OLD.fecha_fin;
        END IF;
    END IF;

    IF NEW.estado = 'activa' AND NEW.fecha_fin IS NULL AND NEW.fecha_inicio IS NOT NULL THEN
        SELECT p.duracion_dias INTO v_duracion FROM public.planes p WHERE p.id_plan = NEW.plan_id;
        NEW.fecha_fin := NEW.fecha_inicio + v_duracion * interval '24 hours';
    END IF;

    IF NEW.estado = 'activa' AND NEW.fecha_fin <= now() THEN
        NEW.estado := 'vencida';
    END IF;
    IF NEW.estado = 'vencida' THEN
        NEW.creditos_restantes := 0;
    END IF;
    RETURN NEW;
END;
$func$;

REVOKE ALL ON FUNCTION public.controlar_vigencia_suscripcion() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS controlar_vigencia_suscripcion ON public.user_suscripciones;
CREATE TRIGGER controlar_vigencia_suscripcion BEFORE INSERT OR UPDATE OF estado, fecha_fin, creditos_restantes
    ON public.user_suscripciones FOR EACH ROW EXECUTE FUNCTION public.controlar_vigencia_suscripcion();

CREATE INDEX IF NOT EXISTS user_suscripciones_vigencia_idx
    ON public.user_suscripciones (fecha_fin) WHERE estado = 'activa';

-- Sin argumento se ejecuta para todas las cuentas desde Cron. La API solo llama al envoltorio.
CREATE OR REPLACE FUNCTION public.vencer_suscripciones(p_alumno_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $func$
    UPDATE public.user_suscripciones
    SET estado = 'vencida', creditos_restantes = 0, updated_at = now()
    WHERE estado = 'activa' AND fecha_fin <= now()
      AND (p_alumno_id IS NULL OR user_id = p_alumno_id);
$func$;

REVOKE ALL ON FUNCTION public.vencer_suscripciones(uuid) FROM PUBLIC, anon, authenticated;

-- La bandeja del alumno también actualiza sus planes en caso de retraso del trabajo programado.
CREATE OR REPLACE FUNCTION public.registrar_avisos_vencimiento()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $func$
BEGIN
    IF auth.uid() IS NOT NULL THEN
        PERFORM public.vencer_suscripciones(auth.uid());
    END IF;
END;
$func$;

REVOKE ALL ON FUNCTION public.registrar_avisos_vencimiento() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_avisos_vencimiento() TO authenticated;

-- Normalizar los registros anteriores sin borrar el historial de planes ni pagos.
UPDATE public.user_suscripciones SET creditos_restantes = 0
WHERE estado = 'vencida' AND creditos_restantes <> 0;
SELECT public.vencer_suscripciones();

COMMIT;
