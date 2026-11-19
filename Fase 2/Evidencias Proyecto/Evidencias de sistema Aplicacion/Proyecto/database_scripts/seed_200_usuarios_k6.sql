-- =========================================================================
-- SEED DE 200 USUARIOS DE PRUEBA PARA K6 (SOLO ENTORNO STAGING / PRUEBAS)
-- =========================================================================
-- Genera exactamente los 200 UUIDs determinísticos que usa `avalancha-200-usuarios.js`:
--   00000000-0000-4000-8000-000000000001  ..  00000000-0000-4000-8000-000000000200
-- Así los 200 VUs compiten realmente por los 8 cupos de la clase en PostgreSQL.
-- =========================================================================

DO $$
DECLARE
    i INTEGER;
    v_uid UUID;
    v_plan_id UUID;
BEGIN
    SELECT id_plan INTO v_plan_id FROM public.planes ORDER BY created_at ASC LIMIT 1;
    IF v_plan_id IS NULL THEN
        RAISE EXCEPTION 'Debe existir al menos un plan en public.planes antes de ejecutar el seed k6.';
    END IF;

    FOR i IN 1..200 LOOP
        v_uid := ('00000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::UUID;

        INSERT INTO auth.users (
            id, instance_id, aud, role, email, encrypted_password,
            email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
        )
        VALUES (
            v_uid,
            '00000000-0000-0000-0000-000000000000',
            'authenticated',
            'authenticated',
            'k6_test_' || i || '@demo.local',
            crypt('k6test123', gen_salt('bf')),
            NOW(),
            '{"provider":"email","providers":["email"]}',
            '{}',
            NOW(),
            NOW()
        )
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO public.profiles (id, name, last_name, correo, role)
        VALUES (v_uid, 'K6Test', 'User' || i, 'k6_test_' || i || '@demo.local', 'alumno')
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO public.user_suscripciones (user_id, plan_id, creditos_restantes, fecha_inicio, fecha_fin, estado)
        SELECT v_uid, v_plan_id, 5, NOW(), NOW() + interval '30 days', 'activa'
        WHERE NOT EXISTS (
            SELECT 1 FROM public.user_suscripciones WHERE user_id = v_uid AND estado = 'activa'
        );
    END LOOP;
END $$;

-- =========================================================================
-- LIMPIEZA POST-PRUEBA (Ejecutar cuando termines tus tests en Staging):
-- DELETE FROM public.reserva WHERE id_usuario::text LIKE '00000000-0000-4000-8000-%';
-- DELETE FROM public.user_suscripciones WHERE user_id::text LIKE '00000000-0000-4000-8000-%';
-- DELETE FROM public.profiles WHERE id::text LIKE '00000000-0000-4000-8000-%';
-- DELETE FROM auth.users WHERE id::text LIKE '00000000-0000-4000-8000-%';
-- =========================================================================
