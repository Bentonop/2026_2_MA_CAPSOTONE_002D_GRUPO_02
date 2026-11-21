-- Cuerpo y Alma. Actualización para un proyecto Supabase existente.
-- Ejecutar completo en SQL Editor con el rol postgres.
-- Conserva el historial y no invoca el borrado de cuentas.
-- Pone en cero los créditos de suscripciones vencidas e instala un trabajo cada minuto.
-- Requiere el esquema existente de la academia y pg_cron de Supabase.
-- Si hay duplicados de asistencia por reserva o de avisos por evento, se revierte la actualización.
-- Las fechas históricas conservan el tipo y el valor ya guardados.

BEGIN;

-- === asistencia_qr.sql ===
-- Actualiza una base existente sin ejecutar el script de reinicio de datos.
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

-- === auth_trigger_whitelist.sql ===
-- =======================================================
-- SISTEMA DE INVITACIONES: WHITELIST TRIGGER (APP PRIVADA)
-- =======================================================
-- Este script crea una función y un trigger en Supabase que se
-- ejecuta automáticamente cada vez que alguien intenta crear una cuenta.
--
-- LÓGICA:
-- 1. Verifica si el correo de quien se registra está en `roles_whitelist`.
-- 2. Si no está, cancela el registro y lanza un error.
-- 3. Si está, permite el registro, le crea su perfil en `profiles` con el
--    rol que se le pre-asignó (alumno, profesor o admin).
-- 4. Borra el correo de la lista blanca para que no se re-use.

CREATE OR REPLACE FUNCTION public.check_whitelist_and_assign_role()
RETURNS trigger AS $$
DECLARE
  v_role text;
BEGIN
  -- 1. Verificar si el correo está en la lista blanca
  SELECT rol_asignado INTO v_role
  FROM public.roles_whitelist
  WHERE correo = NEW.email;

  IF NOT FOUND THEN
    -- 2. Bloquear el registro si no está invitado
    RAISE EXCEPTION 'Acceso denegado: El correo % no ha sido invitado a Ritmo Studio.', NEW.email;
  END IF;

  -- 3. Crear el perfil con los datos enviados desde el formulario de registro
  INSERT INTO public.profiles (id, name, last_name, correo, role, rut, phone)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'nombres'), ''),
      CASE WHEN v_role = 'profesor' THEN 'Docente sin nombre registrado' ELSE split_part(NEW.email, '@', 1) END
    ),
    COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'apellidos'), ''), ''),
    NEW.email,
    v_role,
    NULLIF(TRIM(NEW.raw_user_meta_data->>'rut'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'telefono'), '')
  );

  -- 4. Eliminar la invitación consumida para que no vuelva a aparecer como pendiente
  -- ni se pueda reutilizar el código.
  DELETE FROM public.roles_whitelist
  WHERE correo = NEW.email
    AND rol_asignado = v_role;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Crear el Trigger sobre la tabla auth.users (propia de Supabase)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.check_whitelist_and_assign_role();

-- === programacion_clases.sql ===
-- Las plantillas heredadas quedaron guardadas sin una elección explícita de recurrencia.
ALTER TABLE public.plantillas_clase
    ADD COLUMN IF NOT EXISTS recurrencia_confirmada boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.programar_bloques(p_bloques jsonb DEFAULT NULL, p_recurrente boolean DEFAULT false)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
SET TimeZone = 'America/Santiago'
AS $func$
DECLARE
    v_bloque record;
    v_ahora timestamp := now() AT TIME ZONE 'America/Santiago';
    v_dia date;
    v_inicio timestamptz;
    v_fin timestamptz;
    v_total integer := 0;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'administrador') THEN
        RAISE EXCEPTION 'Solo administración puede programar clases.' USING ERRCODE = '42501';
    END IF;

    -- Serializa la comprobación e inserción cuando dos administradores programan a la vez.
    PERFORM pg_advisory_xact_lock(50137, 1);

    IF p_bloques IS NULL THEN
        SELECT COALESCE(jsonb_agg(to_jsonb(p)), '[]'::jsonb) INTO p_bloques
        FROM public.plantillas_clase p WHERE p.recurrencia_confirmada;
        p_recurrente := false;
    END IF;

    FOR v_bloque IN
        SELECT * FROM jsonb_to_recordset(p_bloques) AS b(
            dia_semana integer, hora_inicio time, hora_fin time, nombre_clase text,
            id_profesor uuid, sala text, cupo_maximo integer
        )
    LOOP
        IF v_bloque.dia_semana IS NULL OR v_bloque.dia_semana NOT BETWEEN 0 AND 6
           OR v_bloque.hora_inicio IS NULL OR v_bloque.hora_fin IS NULL
           OR v_bloque.hora_fin <= v_bloque.hora_inicio
           OR NULLIF(btrim(v_bloque.nombre_clase), '') IS NULL
           OR COALESCE(v_bloque.cupo_maximo, 0) <= 0 THEN
            RAISE EXCEPTION 'Revisa los días, horarios y cupos del bloque.';
        END IF;

        IF p_recurrente AND NOT EXISTS (
            SELECT 1 FROM public.plantillas_clase p WHERE p.recurrencia_confirmada
            AND p.dia_semana = v_bloque.dia_semana AND p.hora_inicio = v_bloque.hora_inicio
            AND p.hora_fin = v_bloque.hora_fin AND p.nombre_clase = v_bloque.nombre_clase
            AND p.id_profesor IS NOT DISTINCT FROM v_bloque.id_profesor
            AND p.sala IS NOT DISTINCT FROM v_bloque.sala
        ) THEN
            INSERT INTO public.plantillas_clase
                (dia_semana, hora_inicio, hora_fin, nombre_clase, id_profesor, sala, cupo_maximo, recurrencia_confirmada)
            VALUES (v_bloque.dia_semana, v_bloque.hora_inicio, v_bloque.hora_fin, v_bloque.nombre_clase,
                    v_bloque.id_profesor, v_bloque.sala, v_bloque.cupo_maximo, true);
        END IF;

        v_dia := v_ahora::date + ((v_bloque.dia_semana - extract(dow FROM v_ahora)::integer + 7) % 7);
        IF v_dia + v_bloque.hora_inicio <= v_ahora THEN
            v_dia := v_dia + 7;
        END IF;
        v_inicio := (v_dia + v_bloque.hora_inicio) AT TIME ZONE 'America/Santiago';
        v_fin := (v_dia + v_bloque.hora_fin) AT TIME ZONE 'America/Santiago';

        IF NOT EXISTS (
            SELECT 1 FROM public.clase c WHERE c.fecha_hora_inicio = v_inicio
              AND c.nombre_clase = v_bloque.nombre_clase
              AND c.id_profesor IS NOT DISTINCT FROM v_bloque.id_profesor
              AND c.sala IS NOT DISTINCT FROM v_bloque.sala
        ) THEN
            INSERT INTO public.clase
                (nombre_clase, fecha_hora_inicio, fecha_hora_fin, id_profesor, sala, cupo_maximo, cupos_inscritos, estado_clase)
            VALUES (v_bloque.nombre_clase, v_inicio, v_fin, v_bloque.id_profesor, v_bloque.sala, v_bloque.cupo_maximo, 0, 'programada');
            v_total := v_total + 1;
        END IF;
    END LOOP;

    RETURN v_total;
END;
$func$;

REVOKE ALL ON FUNCTION public.programar_bloques(jsonb, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.programar_bloques(jsonb, boolean) TO authenticated;

-- === vigencia_planes.sql ===
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

-- === reservar_clase_atomica.sql ===
-- =========================================================================
-- PROYECTO CUERPO Y ALMA — FUNCIÓN ATÓMICA DE RESERVA Y CANJE DE CRÉDITOS
-- =========================================================================
-- Propósito:
--   Evitar condiciones de carrera (overbooking > 8 cupos y doble gasto de
--   créditos) cuando múltiples usuarios intentan reservar la misma clase
--   al mismo tiempo, o cuando un mismo usuario envía múltiples peticiones
--   simultáneas con 1 solo crédito.
--
CREATE OR REPLACE FUNCTION public.reservar_clase_atomica(
    p_id_usuario UUID,
    p_id_clase INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
SET TimeZone = 'America/Santiago'
AS $$
DECLARE
    v_cupo_max INTEGER;
    v_cupos_actuales INTEGER;
    v_estado_clase TEXT;
    v_inicio_clase public.clase.fecha_hora_inicio%TYPE;
    v_suscripcion_id UUID;
    v_creditos_actuales INTEGER;
    v_id_reserva INTEGER;
    v_ya_reservado BOOLEAN;
BEGIN
    IF auth.role() IS DISTINCT FROM 'service_role' AND
       (auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_id_usuario) THEN
        RETURN jsonb_build_object('ok', false, 'codigo', 'NO_AUTORIZADO',
            'http_status', 403, 'mensaje', 'Solo puedes reservar para tu propia cuenta.');
    END IF;

    -- 1. Bloqueo pesimista (Row-Level Lock) sobre la clase:
    --    Si 200 peticiones llegan al mismo milisegundo, PostgreSQL las serializa
    --    aquí en orden de llegada.
    SELECT COALESCE(cupo_maximo, 8), COALESCE(cupos_inscritos, 0), estado_clase, fecha_hora_inicio
      INTO v_cupo_max, v_cupos_actuales, v_estado_clase, v_inicio_clase
      FROM public.clase
     WHERE id_clase = p_id_clase
       FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'ok', false,
            'codigo', 'CLASE_NO_EXISTE',
            'http_status', 404,
            'mensaje', 'La clase solicitada no existe.'
        );
    END IF;

    IF v_estado_clase IS DISTINCT FROM 'programada' OR v_inicio_clase <= now() THEN
        RETURN jsonb_build_object(
            'ok', false,
            'codigo', 'CLASE_NO_DISPONIBLE',
            'http_status', 409,
            'mensaje', 'La clase ya comenzó o no está disponible para reservas.'
        );
    END IF;

    -- 2. Verificar si el usuario ya tiene reserva confirmada en esta clase
    SELECT EXISTS (
        SELECT 1
          FROM public.reserva
         WHERE id_usuario = p_id_usuario
           AND id_clase = p_id_clase
           AND estado_reserva IN ('confirmada', 'presente')
    ) INTO v_ya_reservado;

    IF v_ya_reservado THEN
        RETURN jsonb_build_object(
            'ok', false,
            'codigo', 'RESERVA_DUPLICADA',
            'http_status', 409,
            'mensaje', 'El usuario ya tiene una reserva confirmada en esta clase.'
        );
    END IF;

    -- 3. Verificar cupo disponible (Regla RN-01: máximo 8 cupos)
    IF v_cupos_actuales >= v_cupo_max THEN
        RETURN jsonb_build_object(
            'ok', false,
            'codigo', 'CUPO_AGOTADO',
            'http_status', 409,
            'cupos_inscritos', v_cupos_actuales,
            'cupo_maximo', v_cupo_max,
            'mensaje', 'Capacidad máxima alcanzada (' || v_cupos_actuales || '/' || v_cupo_max || ').'
        );
    END IF;

    -- 4. Bloquear la suscripción activa del usuario para evitar doble canje de créditos
    SELECT id, creditos_restantes
      INTO v_suscripcion_id, v_creditos_actuales
      FROM public.user_suscripciones
     WHERE user_id = p_id_usuario
       AND estado = 'activa'
       AND creditos_restantes > 0
       AND fecha_fin > NOW()
     ORDER BY created_at DESC
     LIMIT 1
       FOR UPDATE;

    IF NOT FOUND OR v_creditos_actuales <= 0 THEN
        RETURN jsonb_build_object(
            'ok', false,
            'codigo', 'SIN_CREDITOS',
            'http_status', 409,
            'mensaje', 'El usuario no posee créditos disponibles o suscripción activa.'
        );
    END IF;

    -- 5. Insertar reserva y actualizar el contador desde el valor bloqueado.
    INSERT INTO public.reserva (id_usuario, id_clase, estado_reserva, fecha_operacion)
    VALUES (p_id_usuario, p_id_clase, 'confirmada', NOW())
    RETURNING id_reserva INTO v_id_reserva;

    UPDATE public.clase SET cupos_inscritos = v_cupos_actuales + 1
    WHERE id_clase = p_id_clase;

    -- 6. Descontar 1 crédito de forma atómica
    UPDATE public.user_suscripciones
       SET creditos_restantes = creditos_restantes - 1,
           updated_at = NOW()
     WHERE id = v_suscripcion_id;

    RETURN jsonb_build_object(
        'ok', true,
        'codigo', 'RESERVA_CONFIRMADA',
        'http_status', 201,
        'id_reserva', v_id_reserva,
        'id_clase', p_id_clase,
        'id_usuario', p_id_usuario,
        'cupos_inscritos', v_cupos_actuales + 1,
        'cupo_maximo', v_cupo_max,
        'creditos_restantes', v_creditos_actuales - 1,
        'timestamp_servidor', NOW()
    );

EXCEPTION
    WHEN unique_violation THEN
        RETURN jsonb_build_object(
            'ok', false,
            'codigo', 'RESERVA_DUPLICADA',
            'http_status', 409,
            'mensaje', 'Conflicto de unicidad: el usuario ya reservó esta clase.'
        );
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'ok', false,
            'codigo', 'ERROR_INTERNO',
            'http_status', 500,
            'mensaje', 'No se pudo completar la reserva.'
        );
END;
$$;

REVOKE ALL ON FUNCTION public.reservar_clase_atomica(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reservar_clase_atomica(uuid, integer) TO authenticated, service_role;

-- === eliminar_cuenta_alumno.sql ===
-- Una edición de perfil desde la API no debe permitir adquirir permisos de administración.
CREATE OR REPLACE FUNCTION public.proteger_rol_perfil()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $func$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF NEW.role IS NOT DISTINCT FROM OLD.role THEN
            RETURN NEW;
        END IF;
    ELSIF NEW.role IS NOT DISTINCT FROM 'alumno' THEN
        RETURN NEW;
    END IF;

    IF (auth.uid() IS NOT NULL OR auth.role() = 'anon') AND NOT EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid()
        AND role = 'administrador' AND active IS TRUE
    ) THEN
        RAISE EXCEPTION 'Solo administración puede asignar roles.' USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
END;
$func$;

REVOKE ALL ON FUNCTION public.proteger_rol_perfil() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS proteger_rol_perfil ON public.profiles;
CREATE TRIGGER proteger_rol_perfil BEFORE INSERT OR UPDATE OF role ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.proteger_rol_perfil();

-- El archivo contable puede contener comprobantes con datos personales.
-- Solo el propietario de la base puede acceder a los comprobantes archivados.
CREATE SCHEMA IF NOT EXISTS capstone_privado;
REVOKE ALL ON SCHEMA capstone_privado FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS capstone_privado.pagos_archivados (
    id_pago uuid PRIMARY KEY,
    fecha_pago timestamptz,
    monto numeric NOT NULL,
    metodo_pago text NOT NULL,
    comprobante_url text,
    archivado_en timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS capstone_privado.bajas_mensuales (
    mes date PRIMARY KEY,
    cuentas bigint NOT NULL,
    dias_registrados bigint NOT NULL
);

REVOKE ALL ON ALL TABLES IN SCHEMA capstone_privado FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.reporte_mensual_academia()
RETURNS TABLE (mes date, ingresos numeric, pagos_aprobados bigint, bajas bigint, promedio_dias_registrados numeric)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $func$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'administrador' AND active IS TRUE) THEN
        RAISE EXCEPTION 'Solo administración puede consultar el reporte.' USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
        WITH pagos AS (
            SELECT p.fecha_pago, p.monto FROM public.user_pagos p WHERE p.estado = 'aprobado'
              AND p.comprobante_url IS DISTINCT FROM 'TRANSACCION_WEBPAY_12345'
            UNION ALL
            SELECT a.fecha_pago, a.monto FROM capstone_privado.pagos_archivados a
            WHERE a.comprobante_url IS DISTINCT FROM 'TRANSACCION_WEBPAY_12345'
        ), resumen AS (
            SELECT date_trunc('month', p.fecha_pago AT TIME ZONE 'America/Santiago')::date AS periodo,
                   SUM(p.monto) AS monto, COUNT(*) AS cantidad
            FROM pagos p
            GROUP BY 1
        )
        SELECT COALESCE(r.periodo, b.mes), COALESCE(r.monto, 0), COALESCE(r.cantidad, 0),
               COALESCE(b.cuentas, 0), CASE WHEN b.cuentas >= 5 THEN round(b.dias_registrados::numeric / b.cuentas, 1) END
        FROM resumen r FULL JOIN capstone_privado.bajas_mensuales b ON b.mes = r.periodo
        ORDER BY 1 DESC NULLS LAST;
END;
$func$;

REVOKE ALL ON FUNCTION public.reporte_mensual_academia() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reporte_mensual_academia() TO authenticated;

-- Operación interna, invocada solo por los dos puntos de entrada autorizados.
CREATE OR REPLACE FUNCTION capstone_privado.suprimir_cuenta(p_usuario_id uuid, p_solo_alumno boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $func$
DECLARE
    v_perfil public.profiles%ROWTYPE;
    v_hoy date := (now() AT TIME ZONE 'America/Santiago')::date;
BEGIN
    PERFORM 1 FROM auth.users WHERE id = p_usuario_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'La cuenta de autenticación no existe.';
    END IF;

    SELECT * INTO v_perfil FROM public.profiles WHERE id = p_usuario_id FOR UPDATE;
    IF NOT FOUND OR v_perfil.role IS NULL OR v_perfil.role NOT IN ('alumno', 'profesor')
       OR (p_solo_alumno AND v_perfil.role <> 'alumno') THEN
        RAISE EXCEPTION 'El tipo de cuenta no permite esta operación.';
    END IF;

    -- Bloquea los pagos antes de separar sus respaldos del perfil operativo.
    PERFORM 1 FROM public.user_pagos WHERE user_id = p_usuario_id FOR UPDATE;
    INSERT INTO capstone_privado.pagos_archivados (id_pago, fecha_pago, monto, metodo_pago, comprobante_url)
    SELECT id, fecha_pago, monto, metodo_pago, comprobante_url
    FROM public.user_pagos WHERE user_id = p_usuario_id AND estado = 'aprobado';

    IF v_perfil.role = 'alumno' THEN
        INSERT INTO capstone_privado.bajas_mensuales AS b (mes, cuentas, dias_registrados)
        VALUES (date_trunc('month', v_hoy::timestamp)::date, 1,
                GREATEST(0, v_hoy - (v_perfil.created_at AT TIME ZONE 'America/Santiago')::date))
        ON CONFLICT (mes) DO UPDATE SET cuentas = b.cuentas + EXCLUDED.cuentas,
            dias_registrados = b.dias_registrados + EXCLUDED.dias_registrados;
    END IF;

    DELETE FROM public.asistencia a USING public.reserva r
    WHERE a.id_reserva = r.id_reserva AND r.id_usuario = p_usuario_id;
    DELETE FROM public.reserva WHERE id_usuario = p_usuario_id;
    DELETE FROM public.user_pagos WHERE user_id = p_usuario_id;
    DELETE FROM public.user_suscripciones WHERE user_id = p_usuario_id;
    UPDATE public.clase SET id_profesor = NULL WHERE id_profesor = p_usuario_id;
    UPDATE public.plantillas_clase SET id_profesor = NULL WHERE id_profesor = p_usuario_id;
    DELETE FROM public.roles_whitelist WHERE correo = v_perfil.correo;
    -- Algunas instalaciones tienen esta referencia sin ON DELETE CASCADE.
    IF to_regclass('public.notificaciones_alumno') IS NOT NULL THEN
        DELETE FROM public.notificaciones_alumno WHERE alumno_id = p_usuario_id;
    END IF;
    DELETE FROM public.profiles WHERE id = p_usuario_id;
    DELETE FROM auth.users WHERE id = p_usuario_id;
END;
$func$;

REVOKE ALL ON FUNCTION capstone_privado.suprimir_cuenta(uuid, boolean) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.eliminar_cuenta_alumno(p_alumno_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $func$
BEGIN
    PERFORM 1 FROM public.profiles WHERE id = auth.uid()
        AND role = 'administrador' AND active IS TRUE FOR SHARE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Solo administración puede eliminar cuentas de alumnos.' USING ERRCODE = '42501';
    END IF;

    PERFORM capstone_privado.suprimir_cuenta(p_alumno_id, true);
END;
$func$;

REVOKE ALL ON FUNCTION public.eliminar_cuenta_alumno(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.eliminar_cuenta_alumno(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.eliminar_mi_cuenta()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $func$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Inicia sesión para eliminar tu cuenta.' USING ERRCODE = '42501';
    END IF;
    PERFORM capstone_privado.suprimir_cuenta(auth.uid(), false);
END;
$func$;

REVOKE ALL ON FUNCTION public.eliminar_mi_cuenta() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.eliminar_mi_cuenta() TO authenticated;

CREATE OR REPLACE FUNCTION public.reporte_alumnos_operativo()
RETURNS TABLE (nombre text, apellido text, dias_registrados integer, plan text,
               estado_plan text, vence timestamptz, creditos integer, ultimo_monto numeric, estado_pago text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $func$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'administrador' AND active IS TRUE) THEN
        RAISE EXCEPTION 'Solo administración puede consultar el reporte.' USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
        SELECT a.name::text, a.last_name::text,
               GREATEST(0, (now() AT TIME ZONE 'America/Santiago')::date -
                           (a.created_at AT TIME ZONE 'America/Santiago')::date),
               p.nombre_plan::text,
               CASE WHEN s.estado = 'activa' AND s.fecha_fin <= now() THEN 'vencida' ELSE s.estado END,
               s.fecha_fin,
               CASE WHEN s.estado = 'activa' AND s.fecha_fin > now() THEN s.creditos_restantes ELSE 0 END,
               pago.monto, pago.estado::text
        FROM public.profiles a
        LEFT JOIN LATERAL (
            SELECT s0.* FROM public.user_suscripciones s0 WHERE s0.user_id = a.id
            ORDER BY (s0.estado = 'activa' AND COALESCE(s0.fecha_fin > now(), false)) DESC,
                     s0.created_at DESC NULLS LAST, s0.id LIMIT 1
        ) s ON true
        LEFT JOIN public.planes p ON p.id_plan = s.plan_id
        LEFT JOIN LATERAL (
            SELECT p0.monto, p0.estado FROM public.user_pagos p0 WHERE p0.user_id = a.id
            ORDER BY p0.fecha_pago DESC NULLS LAST, p0.id LIMIT 1
        ) pago ON true
        WHERE a.role = 'alumno'
        ORDER BY a.name, a.last_name;
END;
$func$;

REVOKE ALL ON FUNCTION public.reporte_alumnos_operativo() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reporte_alumnos_operativo() TO authenticated;

-- === cron_vencimiento_planes.sql ===
-- Aplicar después de vigencia_planes.sql desde el editor SQL de Supabase.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

SELECT cron.schedule(
    'capstone-vencer-suscripciones',
    '* * * * *',
    'SELECT public.vencer_suscripciones();'
);

NOTIFY pgrst, 'reload schema';

COMMIT;
