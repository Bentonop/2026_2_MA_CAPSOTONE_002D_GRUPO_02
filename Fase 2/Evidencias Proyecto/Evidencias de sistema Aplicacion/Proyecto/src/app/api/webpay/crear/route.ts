import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createWebpayTransaction } from "@/lib/webpay";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { planId, returnUrl: customReturnUrl } = body;

    if (!planId) {
      return NextResponse.json(
        { ok: false, mensaje: "Debe especificar un planId válido." },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { ok: false, mensaje: "Configuración de Supabase no disponible." },
        { status: 500 }
      );
    }

    // Identificar el usuario
    let userId = body.userId;
    const authHeader = req.headers.get("authorization");

    if (!userId && authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7).trim();
      const authClient = createClient(supabaseUrl, supabaseAnonKey);
      const { data: userData } = await authClient.auth.getUser(token);
      if (userData?.user?.id) {
        userId = userData.user.id;
      }
    }

    if (!userId) {
      return NextResponse.json(
        { ok: false, mensaje: "Debe iniciar sesión para realizar la compra." },
        { status: 401 }
      );
    }

    // Cliente con service role o anon para operaciones
    const dbClient = createClient(
      supabaseUrl,
      serviceRoleKey || supabaseAnonKey,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    // 1. Obtener datos del plan
    const { data: plan, error: planError } = await dbClient
      .from("planes")
      .select("*")
      .eq("id_plan", planId)
      .single();

    if (planError || !plan) {
      return NextResponse.json(
        { ok: false, mensaje: "El plan seleccionado no existe o no está disponible." },
        { status: 404 }
      );
    }

    // 2. Parámetros de Transbank Webpay
    // buy_order debe tener máximo 26 caracteres
    const timestamp = Date.now().toString().slice(-8);
    const rand = Math.floor(Math.random() * 900 + 100);
    const buyOrder = `OC-${timestamp}-${rand}`;
    
    // session_id debe tener máximo 61 caracteres
    const sessionId = `SES-${userId.slice(0, 8)}-${timestamp}`;

    // Obtener la URL de retorno dinámica
    const origin = req.headers.get("origin") || req.nextUrl.origin || "http://localhost:3000";
    const returnUrl = customReturnUrl || `${origin}/api/webpay/retorno`;

    // 3. Iniciar transacción en Webpay Plus
    const webpayRes = await createWebpayTransaction({
      buyOrder,
      sessionId,
      amount: Number(plan.precio),
      returnUrl,
    });

    // 4. Crear registro pendiente de suscripción
    const { data: subData, error: subError } = await dbClient
      .from("user_suscripciones")
      .insert({
        user_id: userId,
        plan_id: plan.id_plan,
        estado: "pendiente",
        creditos_restantes: 0,
        fecha_inicio: null,
        fecha_fin: null,
      })
      .select("id")
      .single();

    if (subError) {
      console.error("Error al registrar suscripción pendiente:", subError);
      return NextResponse.json(
        { ok: false, mensaje: "Error al preparar la suscripción en base de datos." },
        { status: 500 }
      );
    }

    // 5. Crear registro pendiente de pago asociado al token
    const tokenIdentifier = webpayRes.token;
    const { error: pagoError } = await dbClient
      .from("user_pagos")
      .insert({
        suscripcion_id: subData.id,
        user_id: userId,
        monto: plan.precio,
        metodo_pago: "webpay",
        estado: "pendiente",
        comprobante_url: `TBK:${tokenIdentifier}:${buyOrder}`,
      });

    if (pagoError) {
      console.error("Error al registrar pago pendiente:", pagoError);
    }

    return NextResponse.json({
      ok: true,
      token: webpayRes.token,
      url: webpayRes.url,
      buyOrder,
      isSimulated: webpayRes.isSimulated || false,
    });
  } catch (error: any) {
    console.error("Error en /api/webpay/crear:", error);
    return NextResponse.json(
      { ok: false, mensaje: error?.message || "Error interno al iniciar Webpay." },
      { status: 500 }
    );
  }
}
