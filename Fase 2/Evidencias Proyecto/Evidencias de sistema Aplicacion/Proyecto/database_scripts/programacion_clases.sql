BEGIN;

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

COMMIT;
