import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Endpoint transaccional para reservar una clase usando la función atómica
 * `reservar_clase_atomica` en PostgreSQL (evita overbooking y doble canje de créditos).
 *
 * Variables de entorno requeridas en el servidor:
 *  - NEXT_PUBLIC_SUPABASE_URL
 *  - NEXT_PUBLIC_SUPABASE_ANON_KEY
 *  - SUPABASE_SERVICE_ROLE_KEY (recomendado para ejecutar RPC en staging/CI con k6)
 *  - K6_LOAD_TEST_SECRET (opcional: permite pruebas de carga con usuarios de prueba en staging)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const classId = Number(body?.classId ?? body?.id_clase);

    if (!Number.isInteger(classId) || classId <= 0) {
      return NextResponse.json(
        { ok: false, codigo: "CLASE_INVALIDA", mensaje: "Debe indicar un classId numérico válido." },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { ok: false, codigo: "CONFIG_ERROR", mensaje: "Variables de Supabase no configuradas." },
        { status: 500 }
      );
    }

    // Determinar el usuario autenticado:
    // 1) Modo producción/normal: Bearer JWT de Supabase Auth en Authorization header.
    // 2) Modo staging k6 (solo si está configurado K6_LOAD_TEST_SECRET y coincide el header x-load-test-key):
    //    permite probar 200 userId distintos sin generar 200 JWTs por adelantado.
    let userId: string | null = null;
    const authHeader = req.headers.get("authorization");
    const loadTestKey = req.headers.get("x-load-test-key");
    const expectedLoadTestSecret = process.env.K6_LOAD_TEST_SECRET;

    if (
      expectedLoadTestSecret &&
      loadTestKey === expectedLoadTestSecret &&
      typeof body?.userId === "string" &&
      body.userId.trim().length > 0
    ) {
      userId = body.userId.trim();
    } else if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7).trim();
      const authClient = createClient(supabaseUrl, supabaseAnonKey);
      const { data, error } = await authClient.auth.getUser(token);
      if (error || !data?.user?.id) {
        return NextResponse.json(
          { ok: false, codigo: "NO_AUTORIZADO", mensaje: "Token de sesión inválido o expirado." },
          { status: 401 }
        );
      }
      userId = data.user.id;
    } else {
      return NextResponse.json(
        { ok: false, codigo: "NO_AUTORIZADO", mensaje: "Falta token Authorization Bearer." },
        { status: 401 }
      );
    }

    // Cliente para invocar la RPC atómica
    const dbClient = createClient(
      supabaseUrl,
      serviceRoleKey || supabaseAnonKey,
      serviceRoleKey
        ? { auth: { persistSession: false, autoRefreshToken: false } }
        : {
            global: { headers: authHeader ? { Authorization: authHeader } : {} },
            auth: { persistSession: false, autoRefreshToken: false },
          }
    );

    const { data: rpcResult, error: rpcError } = await dbClient.rpc("reservar_clase_atomica", {
      p_id_usuario: userId,
      p_id_clase: classId,
    });

    if (rpcError) {
      return NextResponse.json(
        { ok: false, codigo: "DB_ERROR", mensaje: rpcError.message },
        { status: 500 }
      );
    }

    const httpStatus = Number(rpcResult?.http_status) || (rpcResult?.ok ? 201 : 400);
    return NextResponse.json(rpcResult, { status: httpStatus });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, codigo: "BAD_REQUEST", mensaje: err?.message || "Solicitud JSON inválida." },
      { status: 400 }
    );
  }
}
