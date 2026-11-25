import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { commitWebpayTransaction } from "@/lib/webpay";

async function handleWebpayReturn(req: NextRequest) {
  const origin = req.headers.get("origin") || req.nextUrl.origin || "http://localhost:3000";

  let tokenWs: string | null = null;
  let tbkToken: string | null = null;
  let tbkOrdenCompra: string | null = null;

  // Extraer parámetros según método GET o POST
  if (req.method === "POST") {
    try {
      const formData = await req.formData();
      tokenWs = formData.get("token_ws") as string;
      tbkToken = formData.get("TBK_TOKEN") as string;
      tbkOrdenCompra = formData.get("TBK_ORDEN_COMPRA") as string;
    } catch {
      // Si el POST no es multipart o formData
      const body = await req.json().catch(() => ({}));
      tokenWs = body.token_ws;
      tbkToken = body.TBK_TOKEN;
      tbkOrdenCompra = body.TBK_ORDEN_COMPRA;
    }
  }

  // Si no vinieron en el cuerpo, revisar query params
  if (!tokenWs && !tbkToken) {
    const url = new URL(req.url);
    tokenWs = url.searchParams.get("token_ws");
    tbkToken = url.searchParams.get("TBK_TOKEN");
    tbkOrdenCompra = url.searchParams.get("TBK_ORDEN_COMPRA");
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseKey = serviceRoleKey || supabaseAnonKey;

  const dbClient = (supabaseUrl && supabaseKey)
    ? createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false, autoRefreshToken: false }
      })
    : null;

  // 1. CASO ANULACIÓN POR EL USUARIO (TBK_TOKEN)
  if (tbkToken || (!tokenWs && tbkOrdenCompra)) {
    console.log("Transacción Webpay anulada por el usuario");

    if (dbClient) {
      const tokenToSearch = tbkToken || tbkOrdenCompra;
      // Actualizar pago pendiente a rechazado/anulado
      const { data: pagoPendiente } = await dbClient
        .from("user_pagos")
        .select("id, suscripcion_id")
        .ilike("comprobante_url", `%${tokenToSearch}%`)
        .maybeSingle();

      if (pagoPendiente) {
        await dbClient
          .from("user_pagos")
          .update({ estado: "rechazado" })
          .eq("id", pagoPendiente.id);

        if (pagoPendiente.suscripcion_id) {
          await dbClient
            .from("user_suscripciones")
            .update({ estado: "cancelada" })
            .eq("id", pagoPendiente.suscripcion_id);
        }
      }
    }

    return NextResponse.redirect(new URL("/alumno/tienda/retorno?status=anulado", origin));
  }

  // Si no hay token de ninguna forma
  if (!tokenWs) {
    return NextResponse.redirect(new URL("/alumno/tienda/retorno?status=error&mensaje=Falta+token+de+pago", origin));
  }

  // 2. CASO NORMAL: CONFIRMAR CON TRANSBANK
  try {
    const commitResult = await commitWebpayTransaction(tokenWs);

    const isApproved =
      commitResult.response_code === 0 && commitResult.status === "AUTHORIZED";

    if (!dbClient) {
      // Si no hay base de datos conectada en local
      if (isApproved) {
        return NextResponse.redirect(
          new URL(
            `/alumno/tienda/retorno?status=exito&buy_order=${commitResult.buy_order}&auth=${commitResult.authorization_code || '123456'}&card=${commitResult.card_detail?.card_number || '6623'}&type=${commitResult.payment_type_code || 'VD'}&amount=${commitResult.amount || 0}`,
            origin
          )
        );
      } else {
        return NextResponse.redirect(
          new URL(
            `/alumno/tienda/retorno?status=rechazado&code=${commitResult.response_code}&buy_order=${commitResult.buy_order}`,
            origin
          )
        );
      }
    }

    // Buscar el pago y suscripción asociada al token
    const { data: pagoRecord } = await dbClient
      .from("user_pagos")
      .select("id, user_id, suscripcion_id, monto, comprobante_url")
      .ilike("comprobante_url", `%${tokenWs}%`)
      .maybeSingle();

    if (!pagoRecord) {
      console.warn("No se encontró registro de pago con token:", tokenWs);
      // Aún así permitimos mostrar el voucher si Transbank aprobó
      if (isApproved) {
        return NextResponse.redirect(
          new URL(
            `/alumno/tienda/retorno?status=exito&buy_order=${commitResult.buy_order}&auth=${commitResult.authorization_code}&card=${commitResult.card_detail?.card_number || '6623'}&type=${commitResult.payment_type_code || 'VD'}&amount=${commitResult.amount}`,
            origin
          )
        );
      }
    }

    // Obtener la suscripción y el plan
    const { data: subRecord } = await dbClient
      .from("user_suscripciones")
      .select("id, plan_id, planes(id_plan, nombre_plan, duracion_dias, creditos_clases, ventas)")
      .eq("id", pagoRecord?.suscripcion_id)
      .maybeSingle();

    const planData = Array.isArray(subRecord?.planes) ? subRecord?.planes[0] : subRecord?.planes;
    const duracionDias = planData?.duracion_dias || 30;
    const creditosClases = planData?.creditos_clases || 8;
    const nombrePlan = planData?.nombre_plan || "Plan Gimnasio";

    if (isApproved) {
      const now = new Date();
      const fechaFin = new Date(now.getTime() + duracionDias * 86_400_000);

      // 1. Activar suscripción y asignar créditos
      if (pagoRecord?.suscripcion_id) {
        await dbClient
          .from("user_suscripciones")
          .update({
            estado: "activa",
            fecha_inicio: now.toISOString(),
            fecha_fin: fechaFin.toISOString(),
            creditos_restantes: creditosClases,
          })
          .eq("id", pagoRecord.suscripcion_id);
      }

      // 2. Aprobar pago y guardar datos del voucher
      const voucherData = JSON.stringify({
        token: tokenWs,
        auth_code: commitResult.authorization_code,
        card_number: commitResult.card_detail?.card_number || "6623",
        payment_type: commitResult.payment_type_code || "VD",
        buy_order: commitResult.buy_order,
        date: commitResult.transaction_date,
      });

      if (pagoRecord?.id) {
        await dbClient
          .from("user_pagos")
          .update({
            estado: "aprobado",
            monto: commitResult.amount || pagoRecord.monto,
            fecha_pago: commitResult.transaction_date || now.toISOString(),
            comprobante_url: voucherData,
          })
          .eq("id", pagoRecord.id);
      }

      // 3. Incrementar contador de ventas del plan
      if (planData?.id_plan) {
        const ventasActuales = planData.ventas || 0;
        await dbClient
          .from("planes")
          .update({ ventas: ventasActuales + 1 })
          .eq("id_plan", planData.id_plan);
      }

      // Redirigir a página de comprobante con todos los datos
      const successUrl = new URL("/alumno/tienda/retorno", origin);
      successUrl.searchParams.set("status", "exito");
      successUrl.searchParams.set("buy_order", commitResult.buy_order);
      successUrl.searchParams.set("auth", commitResult.authorization_code || "123456");
      successUrl.searchParams.set("card", commitResult.card_detail?.card_number || "6623");
      successUrl.searchParams.set("type", commitResult.payment_type_code || "VD");
      successUrl.searchParams.set("amount", String(commitResult.amount || pagoRecord?.monto || 0));
      successUrl.searchParams.set("plan", nombrePlan);
      successUrl.searchParams.set("creditos", String(creditosClases));
      successUrl.searchParams.set("dias", String(duracionDias));
      return NextResponse.redirect(successUrl);
    } else {
      // Transacción rechazada por el banco
      if (pagoRecord?.id) {
        await dbClient
          .from("user_pagos")
          .update({ estado: "rechazado" })
          .eq("id", pagoRecord.id);
      }
      if (pagoRecord?.suscripcion_id) {
        await dbClient
          .from("user_suscripciones")
          .update({ estado: "cancelada" })
          .eq("id", pagoRecord.suscripcion_id);
      }

      const rejectUrl = new URL("/alumno/tienda/retorno", origin);
      rejectUrl.searchParams.set("status", "rechazado");
      rejectUrl.searchParams.set("code", String(commitResult.response_code));
      rejectUrl.searchParams.set("buy_order", commitResult.buy_order);
      return NextResponse.redirect(rejectUrl);
    }
  } catch (error: any) {
    console.error("Error al procesar retorno de Webpay:", error);
    const errorUrl = new URL("/alumno/tienda/retorno", origin);
    errorUrl.searchParams.set("status", "error");
    errorUrl.searchParams.set("mensaje", error?.message || "Error al confirmar la transacción");
    return NextResponse.redirect(errorUrl);
  }
}

export async function GET(req: NextRequest) {
  return handleWebpayReturn(req);
}

export async function POST(req: NextRequest) {
  return handleWebpayReturn(req);
}
