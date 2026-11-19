-- =========================================================================
-- PROYECTO CUERPO Y ALMA — FUNCIÓN ATÓMICA DE RESERVA Y CANJE DE CRÉDITOS
-- =========================================================================
-- Propósito:
--   Evitar condiciones de carrera (overbooking > 8 cupos y doble gasto de
--   créditos) cuando múltiples usuarios intentan reservar la misma clase
--   al mismo tiempo, o cuando un mismo usuario envía múltiples peticiones
--   simultáneas con 1 solo crédito.
--
-- Nota de compatibilidad con rls_politicas_seguridad.sql:
--   Este script asume que el trigger `tr_actualizar_cupos_clase` está activo
--   sobre `public.reserva` (AFTER INSERT incrementa `cupos_inscritos`).
--   Por eso esta función bloquea la fila de `public.clase` con FOR UPDATE
--   antes de insertar en `public.reserva`, y NO suma +1 manualmente para
--   no duplicar el conteo del trigger.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.reservar_clase_atomica(
    p_id_usuario UUID,
    p_id_clase INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_cupo_max INTEGER;
    v_cupos_actuales INTEGER;
    v_estado_clase TEXT;
    v_suscripcion_id UUID;
    v_creditos_actuales INTEGER;
    v_id_reserva INTEGER;
    v_ya_reservado BOOLEAN;
BEGIN
    -- 1. Bloqueo pesimista (Row-Level Lock) sobre la clase:
    --    Si 200 peticiones llegan al mismo milisegundo, PostgreSQL las serializa
    --    aquí en orden de llegada.
    SELECT cupo_maximo, cupos_inscritos, estado_clase
      INTO v_cupo_max, v_cupos_actuales, v_estado_clase
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

    IF v_estado_clase <> 'programada' THEN
        RETURN jsonb_build_object(
            'ok', false,
            'codigo', 'CLASE_NO_DISPONIBLE',
            'http_status', 409,
            'mensaje', 'La clase no está disponible para reservas (' || v_estado_clase || ').'
        );
    END IF;

    -- 2. Verificar si el usuario ya tiene reserva confirmada en esta clase
    SELECT EXISTS (
        SELECT 1
          FROM public.reserva
         WHERE id_usuario = p_id_usuario
           AND id_clase = p_id_clase
           AND estado_reserva = 'confirmada'
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
       AND (fecha_fin IS NULL OR fecha_fin > NOW())
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

    -- 5. Insertar reserva (el trigger tr_actualizar_cupos_clase actualiza cupos_inscritos)
    INSERT INTO public.reserva (id_usuario, id_clase, estado_reserva, fecha_operacion)
    VALUES (p_id_usuario, p_id_clase, 'confirmada', NOW())
    RETURNING id_reserva INTO v_id_reserva;

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
            'mensaje', SQLERRM
        );
END;
$$;
