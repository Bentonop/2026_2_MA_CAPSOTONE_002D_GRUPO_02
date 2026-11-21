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
