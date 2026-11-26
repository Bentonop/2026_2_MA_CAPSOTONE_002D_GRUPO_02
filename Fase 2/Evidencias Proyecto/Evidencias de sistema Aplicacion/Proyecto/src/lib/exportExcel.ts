import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Utilidades para exportación de datos a hojas de cálculo compatibles con Microsoft Excel y Google Sheets.
 * Utiliza codificación UTF-8 con BOM (\uFEFF) y directiva 'sep=;' para que Excel en Windows
 * abra el archivo automáticamente en columnas separadas y con todos los acentos y 'ñ' legibles.
 */

export function downloadCsv(filename: string, headers: string[], rows: (string | number | null | undefined)[][]): void {
  // Directiva para forzar a Excel en Windows a usar punto y coma como separador de columnas
  const separatorDirective = "sep=;\n";

  const escapeCell = (val: string | number | null | undefined): string => {
    if (val === null || val === undefined) return '""';
    const celda = typeof val === "string" && /^[\s\uFEFF]*[=+@-]|^[\t\r\n]/.test(val) ? "'" + val : String(val);
    const str = celda.replace(/"/g, '""');
    // Envolver siempre en comillas para proteger comas, saltos de línea y puntos y coma
    return `"${str}"`;
  };

  const headerLine = headers.map(escapeCell).join(";");
  const dataLines = rows.map((row) => row.map(escapeCell).join(";")).join("\n");

  const fullContent = "\uFEFF" + separatorDirective + headerLine + "\n" + dataLines;

  const blob = new Blob([fullContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Extrae y formatea metadatos de Webpay Plus y transferencias desde comprobante_url
 */
export function parseComprobanteInfo(comprobanteUrl: string | null | undefined, metodoPago?: string | null) {
  let authCode = "N/A";
  let buyOrder = "N/A";
  let cardNumber = "N/A";
  let paymentType = "N/A";
  let voucherRef = comprobanteUrl || "Sin comprobante";

  if (!comprobanteUrl) {
    return { authCode, buyOrder, cardNumber, paymentType, voucherRef };
  }

  const trimmed = comprobanteUrl.trim();
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      authCode = parsed.auth_code ? String(parsed.auth_code) : "N/A";
      buyOrder = parsed.buy_order ? String(parsed.buy_order) : "N/A";
      cardNumber = parsed.card_number ? `**** ${parsed.card_number}` : "N/A";
      paymentType = parsed.payment_type === "VN" 
        ? "Venta Normal (Débito/Crédito)" 
        : (parsed.payment_type || "Webpay Plus");
      voucherRef = buyOrder !== "N/A" ? `Webpay: ${buyOrder}` : "Webpay Aprobado";
    } catch {
      // Ignorar parse error
    }
  } else if (trimmed.startsWith("TBK:")) {
    const parts = trimmed.split(":");
    if (parts.length >= 3) {
      buyOrder = parts[2] || "N/A";
      voucherRef = `Webpay: ${buyOrder}`;
    }
  } else if (trimmed.startsWith("http")) {
    voucherRef = trimmed;
  }

  return { authCode, buyOrder, cardNumber, paymentType, voucherRef };
}

/**
 * Formato de fecha en zona horaria Chile (es-CL)
 */
function formatDateCL(dateVal: string | null | undefined, includeTime = false): string {
  if (!dateVal) return "No registrada";
  try {
    const d = new Date(dateVal);
    if (Number.isNaN(d.getTime())) return "No registrada";
    return includeTime 
      ? d.toLocaleString("es-CL", { timeZone: "America/Santiago" }) 
      : d.toLocaleDateString("es-CL", { timeZone: "America/Santiago" });
  } catch {
    return "No registrada";
  }
}

/**
 * Exporta la lista detallada y completa de Alumnos, Suscripciones y Pagos
 */
export async function exportAlumnosYPagosToExcel(supabase: SupabaseClient): Promise<number> {
  const fecha = new Date().toISOString().slice(0, 10);

  // 1. Obtener todos los alumnos registrados en el sistema
  const { data: alumnos, error: alumnosErr } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", "alumno")
    .order("name", { ascending: true });

  if (alumnosErr) throw alumnosErr;

  const alumnosList = alumnos || [];
  if (alumnosList.length === 0) {
    downloadCsv(
      `Reporte_Alumnos_${fecha}.csv`,
      [
        "RUT", "Nombre Completo", "Nombres", "Apellidos", "Correo Electrónico", "Teléfono",
        "Plan Actual", "Créditos Restantes", "Estado Suscripción", "Fecha Inicio Plan", "Fecha Vencimiento Plan",
        "Monto Último Pago (CLP)", "Método Último Pago", "Estado Último Pago",
        "Código Autorización Webpay", "N° Orden de Compra", "Tarjeta", "Fecha y Hora Último Pago",
        "Total Reservas Históricas", "Contacto de Emergencia", "Condición Médica / Salud", "Fecha Registro Alumno"
      ],
      []
    );
    return 0;
  }

  const userIds = alumnosList.map((a) => a.id);

  // 2. Consultar suscripciones, pagos y reservas en paralelo
  const [subsRes, pagosRes, reservasRes] = await Promise.all([
    supabase
      .from("user_suscripciones")
      .select("*, planes(nombre_plan, precio, creditos_clases)")
      .in("user_id", userIds)
      .order("created_at", { ascending: false }),
    supabase
      .from("user_pagos")
      .select("*")
      .in("user_id", userIds)
      .order("created_at", { ascending: false }),
    supabase
      .from("reserva")
      .select("id_reserva, id_usuario, estado_reserva")
      .in("id_usuario", userIds)
  ]);

  const suscripciones = subsRes.data || [];
  const pagos = pagosRes.data || [];
  const reservas = (reservasRes as any)?.data || [];

  // Mapear por alumno
  const subsByAlumno = new Map<string, any[]>();
  suscripciones.forEach((s: any) => {
    if (!subsByAlumno.has(s.user_id)) subsByAlumno.set(s.user_id, []);
    subsByAlumno.get(s.user_id)!.push(s);
  });

  const pagosByAlumno = new Map<string, any[]>();
  pagos.forEach((p: any) => {
    if (!pagosByAlumno.has(p.user_id)) pagosByAlumno.set(p.user_id, []);
    pagosByAlumno.get(p.user_id)!.push(p);
  });

  const reservasCountByAlumno = new Map<string, number>();
  reservas.forEach((r: any) => {
    if (r.id_usuario && r.estado_reserva !== "cancelada") {
      reservasCountByAlumno.set(r.id_usuario, (reservasCountByAlumno.get(r.id_usuario) || 0) + 1);
    }
  });

  const rows = alumnosList.map((alumno) => {
    const userSubs = subsByAlumno.get(alumno.id) || [];
    const userPagos = pagosByAlumno.get(alumno.id) || [];
    const totalReservas = reservasCountByAlumno.get(alumno.id) || 0;

    // Preferir suscripción activa o la más reciente
    const sub = userSubs.find((s: any) => s.estado === "activa") || userSubs[0];

    // Preferir pago aprobado más reciente o el último registrado
    const pagoAprobado = userPagos.find((p: any) => p.estado === "aprobado");
    const pago = pagoAprobado || userPagos[0];

    // Datos del plan
    const plan = sub?.planes?.nombre_plan || (sub ? "Plan Activo" : "Sin Plan");
    const creditos = sub?.creditos_restantes !== undefined ? sub.creditos_restantes : 0;
    const estadoSub = sub?.estado
      ? (sub.estado.charAt(0).toUpperCase() + sub.estado.slice(1))
      : "Sin Suscripción";

    const fechaInicioPlan = formatDateCL(sub?.fecha_inicio);
    const fechaVencePlan = formatDateCL(sub?.fecha_fin);

    // Datos del pago
    const monto = pago?.monto
      ? `$${Number(pago.monto).toLocaleString("es-CL")}`
      : (sub?.planes?.precio ? `$${Number(sub.planes.precio).toLocaleString("es-CL")}` : "$0");

    let metodo = "No registrado";
    if (pago?.metodo_pago) {
      const m = pago.metodo_pago.toLowerCase();
      if (m.includes("webpay") || m.includes("integrado") || m.includes("transbank")) {
        metodo = "Webpay Plus (Transbank)";
      } else if (m.includes("transferencia")) {
        metodo = "Transferencia Bancaria";
      } else {
        metodo = pago.metodo_pago.charAt(0).toUpperCase() + pago.metodo_pago.slice(1);
      }
    }

    const estadoPago = pago?.estado
      ? (pago.estado.charAt(0).toUpperCase() + pago.estado.slice(1))
      : (sub?.estado === "activa" ? "Aprobado" : "Pendiente");

    const fechaPago = formatDateCL(pago?.fecha_pago || pago?.created_at, true);

    // Parsear Webpay info
    const tbk = parseComprobanteInfo(pago?.comprobante_url, pago?.metodo_pago);

    const nombreCompleto = `${alumno.name || ""} ${alumno.last_name || ""}`.trim() || "Sin nombre";

    return [
      alumno.rut || "No registrado",
      nombreCompleto,
      alumno.name || "Sin nombre",
      alumno.last_name || "",
      alumno.correo || "Sin correo",
      alumno.phone || "No registrado",
      plan,
      creditos,
      estadoSub,
      fechaInicioPlan,
      fechaVencePlan,
      monto,
      metodo,
      estadoPago,
      tbk.authCode,
      tbk.buyOrder,
      tbk.cardNumber,
      fechaPago,
      totalReservas,
      alumno.contacto_emergencia || "No registrado",
      alumno.condicion_medica || "Ninguna registrada",
      formatDateCL(alumno.created_at)
    ];
  });

  downloadCsv(
    `Reporte_Alumnos_Detallado_${fecha}.csv`,
    [
      "RUT",
      "Nombre Completo",
      "Nombres",
      "Apellidos",
      "Correo Electrónico",
      "Teléfono",
      "Plan Actual",
      "Créditos Restantes",
      "Estado Suscripción",
      "Fecha Inicio Plan",
      "Fecha Vencimiento Plan",
      "Monto Último Pago (CLP)",
      "Método Último Pago",
      "Estado Último Pago",
      "Código Autorización Webpay",
      "N° Orden de Compra",
      "Tarjeta",
      "Fecha y Hora Último Pago",
      "Total Reservas Históricas",
      "Contacto de Emergencia",
      "Condición Médica / Salud",
      "Fecha Registro Alumno"
    ],
    rows
  );

  return rows.length;
}

/**
 * Exporta el historial detallado de todas las transacciones y pagos (Webpay y Transferencias)
 */
export async function exportHistorialPagosToExcel(supabase: SupabaseClient): Promise<number> {
  const fecha = new Date().toISOString().slice(0, 10);

  // 1. Consultar todos los pagos registrados
  const { data: pagos, error: pagosErr } = await supabase
    .from("user_pagos")
    .select(`
      id,
      user_id,
      suscripcion_id,
      monto,
      metodo_pago,
      estado,
      comprobante_url,
      fecha_pago,
      created_at
    `)
    .order("created_at", { ascending: false });

  if (pagosErr) throw pagosErr;

  const pagosList = pagos || [];
  if (pagosList.length === 0) {
    downloadCsv(
      `Historial_Pagos_${fecha}.csv`,
      [
        "ID Transacción", "Fecha y Hora Pago", "RUT Alumno", "Nombre Alumno", "Correo Electrónico", "Teléfono",
        "Plan", "Monto (CLP)", "Método de Pago", "Estado Pago",
        "Código Autorización Transbank", "N° Orden de Compra", "Tarjeta", "Tipo de Pago", "Referencia / Voucher"
      ],
      []
    );
    return 0;
  }

  // 2. Obtener los perfiles de los usuarios involucrados
  const userIds = Array.from(new Set(pagosList.map((p) => p.user_id).filter(Boolean)));
  const subIds = Array.from(new Set(pagosList.map((p) => p.suscripcion_id).filter(Boolean)));

  const [profilesRes, subsRes] = await Promise.all([
    supabase.from("profiles").select("id, rut, name, last_name, correo, phone").in("id", userIds),
    supabase.from("user_suscripciones").select("id, planes(nombre_plan, precio)").in("id", subIds)
  ]);

  const profilesMap = new Map<string, any>();
  (profilesRes.data || []).forEach((p: any) => profilesMap.set(p.id, p));

  const subsMap = new Map<string, any>();
  (subsRes.data || []).forEach((s: any) => subsMap.set(s.id, s));

  const rows = pagosList.map((pago: any) => {
    const profile = profilesMap.get(pago.user_id);
    const sub = subsMap.get(pago.suscripcion_id);
    const planName = sub?.planes?.nombre_plan || "Plan Estudio";

    const nombreAlumno = profile
      ? `${profile.name || ""} ${profile.last_name || ""}`.trim()
      : "Usuario no identificado";

    const rut = profile?.rut || "No registrado";
    const correo = profile?.correo || "Sin correo";
    const phone = profile?.phone || "No registrado";

    const fechaPago = formatDateCL(pago.fecha_pago || pago.created_at, true);
    const monto = `$${Number(pago.monto || 0).toLocaleString("es-CL")}`;

    let metodo = "Desconocido";
    if (pago.metodo_pago) {
      const m = pago.metodo_pago.toLowerCase();
      if (m.includes("webpay") || m.includes("integrado") || m.includes("transbank")) {
        metodo = "Webpay Plus";
      } else if (m.includes("transferencia")) {
        metodo = "Transferencia";
      } else {
        metodo = pago.metodo_pago.charAt(0).toUpperCase() + pago.metodo_pago.slice(1);
      }
    }

    const estado = pago.estado
      ? (pago.estado.charAt(0).toUpperCase() + pago.estado.slice(1))
      : "Pendiente";

    const tbk = parseComprobanteInfo(pago.comprobante_url, pago.metodo_pago);

    return [
      pago.id,
      fechaPago,
      rut,
      nombreAlumno,
      correo,
      phone,
      planName,
      monto,
      metodo,
      estado,
      tbk.authCode,
      tbk.buyOrder,
      tbk.cardNumber,
      tbk.paymentType,
      tbk.voucherRef
    ];
  });

  downloadCsv(
    `Historial_Transacciones_Pagos_${fecha}.csv`,
    [
      "ID Transacción",
      "Fecha y Hora Pago",
      "RUT Alumno",
      "Nombre Alumno",
      "Correo Electrónico",
      "Teléfono",
      "Plan",
      "Monto (CLP)",
      "Método de Pago",
      "Estado Pago",
      "Código Autorización Transbank",
      "N° Orden de Compra",
      "Tarjeta",
      "Tipo de Pago",
      "Referencia / Voucher"
    ],
    rows
  );

  return rows.length;
}

export interface ReporteMensualAcademia {
  mes: string | null;
  ingresos: number;
  pagos_aprobados: number;
  ticket_promedio: number;
  pagos_webpay: number;
  pagos_transferencia: number;
}

/**
 * Consulta el resumen financiero mensual agrupado por mes
 */
export async function consultarReporteMensual(supabase: SupabaseClient): Promise<ReporteMensualAcademia[]> {
  try {
    const { data: pagos } = await supabase
      .from("user_pagos")
      .select("monto, metodo_pago, estado, fecha_pago, created_at")
      .eq("estado", "aprobado");

    if (pagos && pagos.length > 0) {
      const mesesMap: Record<string, { ingresos: number; count: number; webpay: number; transferencia: number }> = {};

      pagos.forEach((p) => {
        const fechaStr = p.fecha_pago || p.created_at;
        if (!fechaStr) return;
        const d = new Date(fechaStr);
        const mesKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

        if (!mesesMap[mesKey]) {
          mesesMap[mesKey] = { ingresos: 0, count: 0, webpay: 0, transferencia: 0 };
        }

        const monto = Number(p.monto) || 0;
        mesesMap[mesKey].ingresos += monto;
        mesesMap[mesKey].count++;

        const m = (p.metodo_pago || "").toLowerCase();
        if (m.includes("webpay") || m.includes("integrado") || m.includes("transbank")) {
          mesesMap[mesKey].webpay++;
        } else {
          mesesMap[mesKey].transferencia++;
        }
      });

      return Object.entries(mesesMap)
        .sort(([mesA], [mesB]) => mesB.localeCompare(mesA))
        .map(([mes, info]) => ({
          mes,
          ingresos: info.ingresos,
          pagos_aprobados: info.count,
          ticket_promedio: info.count > 0 ? Math.round(info.ingresos / info.count) : 0,
          pagos_webpay: info.webpay,
          pagos_transferencia: info.transferencia
        }));
    }
  } catch (err) {
    console.warn("Error calculando reporte financiero mensual:", err);
  }

  return [];
}

/**
 * Exporta el reporte financiero mensual a Excel
 */
export async function exportFinanzasToExcel(supabase: SupabaseClient): Promise<number> {
  const meses = await consultarReporteMensual(supabase);
  const fecha = new Date().toISOString().slice(0, 10);

  downloadCsv(
    `Reporte_Finanzas_Mensuales_${fecha}.csv`,
    [
      "Período (Año-Mes)",
      "Ingresos Totales Aprobados (CLP)",
      "Transacciones Aprobadas",
      "Ticket Promedio (CLP)",
      "Transacciones Webpay Plus",
      "Transacciones Transferencia"
    ],
    meses.map((m) => [
      m.mes ?? "Sin fecha",
      `$${m.ingresos.toLocaleString("es-CL")}`,
      m.pagos_aprobados,
      `$${m.ticket_promedio.toLocaleString("es-CL")}`,
      m.pagos_webpay,
      m.pagos_transferencia
    ])
  );

  return meses.length;
}
