BEGIN;

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

COMMIT;
