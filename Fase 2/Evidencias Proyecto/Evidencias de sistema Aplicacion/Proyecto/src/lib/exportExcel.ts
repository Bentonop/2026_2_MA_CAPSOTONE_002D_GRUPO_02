import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Utilidades para exportación de datos a hojas de cálculo compatibles con Microsoft Excel y Google Sheets.
 * Utiliza codificación UTF-8 con BOM (\uFEFF) y directiva 'sep=;' para que Excel en Windows
 * abra el archivo automáticamente en columnas separadas y con todos los acentos y 'ñ' legibles.
 */

export function downloadCsv(filename: string, headers: string[], rows: (string | number | null | undefined)[][]): void {
  // Directiva para forzar a Excel a usar punto y coma como separador de columnas
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

export async function exportAlumnosYPagosToExcel(supabase: SupabaseClient): Promise<number> {
  const fecha = new Date().toISOString().slice(0, 10);

  // 1. Intentar procedimiento RPC si está disponible en la base de datos
  try {
    const { data, error } = await supabase.rpc("reporte_alumnos_operativo");
    if (!error && data && data.length > 0) {
      downloadCsv(
        `Reporte_Alumnos_${fecha}.csv`,
        ["Nombre", "Apellido", "Días desde el registro", "Plan", "Estado del plan", "Vencimiento", "Créditos disponibles", "Último pago (CLP)", "Estado del último pago"],
        data.map((alumno: {
          nombre: string; apellido: string | null; dias_registrados: number; plan: string | null;
          estado_plan: string | null; vence: string | null; creditos: number;
          ultimo_monto: number | null; estado_pago: string | null;
        }) => [
          alumno.nombre, alumno.apellido, alumno.dias_registrados, alumno.plan, alumno.estado_plan,
          alumno.vence ? new Date(alumno.vence).toLocaleString("es-CL", { timeZone: "America/Santiago" }) : null,
          alumno.creditos, alumno.ultimo_monto, alumno.estado_pago,
        ])
      );
      return data.length;
    }
  } catch (rpcErr) {
    console.warn("RPC reporte_alumnos_operativo no disponible, usando fallback relacional:", rpcErr);
  }

  // 2. Fallback relacional directo y robusto (profiles + user_suscripciones + user_pagos)
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
      ["RUT", "Nombre", "Apellido", "Correo", "Teléfono", "Plan", "Créditos", "Estado Suscripción", "Último Pago", "Método", "Estado Pago", "Fecha Pago"],
      []
    );
    return 0;
  }

  const userIds = alumnosList.map((a) => a.id);
  const { data: suscripciones } = await supabase
    .from("user_suscripciones")
    .select("*, planes(nombre_plan, precio, creditos_clases)")
    .in("user_id", userIds)
    .order("created_at", { ascending: false });

  const { data: pagos } = await supabase
    .from("user_pagos")
    .select("*")
    .in("user_id", userIds)
    .order("fecha_pago", { ascending: false });

  const subsMap = new Map<string, any>();
  (suscripciones || []).forEach(s => { if (!subsMap.has(s.user_id)) subsMap.set(s.user_id, s); });

  const pagosMap = new Map<string, any>();
  (pagos || []).forEach(p => { if (!pagosMap.has(p.user_id)) pagosMap.set(p.user_id, p); });

  const rows = alumnosList.map(alumno => {
    const sub = subsMap.get(alumno.id);
    const pago = pagosMap.get(alumno.id);
    const plan = sub?.planes?.nombre_plan || (sub ? "Plan Activo" : "Sin Plan");
    const creditos = sub?.creditos_restantes ?? 0;
    const estadoSub = sub?.estado ? (sub.estado.charAt(0).toUpperCase() + sub.estado.slice(1)) : "Sin Suscripción";
    const monto = pago?.monto ? `$${Number(pago.monto).toLocaleString("es-CL")}` : (sub?.planes?.precio ? `$${Number(sub.planes.precio).toLocaleString("es-CL")}` : "$0");
    const metodo = pago?.metodo_pago ? (pago.metodo_pago.charAt(0).toUpperCase() + pago.metodo_pago.slice(1)) : "Transferencia";
    const estadoPago = pago?.estado ? (pago.estado.charAt(0).toUpperCase() + pago.estado.slice(1)) : (sub?.estado === "activa" ? "Aprobado" : "Pendiente");
    const fechaPago = pago?.fecha_pago ? new Date(pago.fecha_pago).toLocaleDateString("es-CL") : "No registrada";

    return [
      alumno.rut || "No registrado",
      alumno.name || "Sin nombre",
      alumno.last_name || "",
      alumno.correo || "Sin correo",
      alumno.phone || "No registrado",
      plan,
      creditos,
      estadoSub,
      monto,
      metodo,
      estadoPago,
      fechaPago,
      alumno.contacto_emergencia || "No registrado",
      alumno.condicion_medica || "Ninguna registrada"
    ];
  });

  downloadCsv(
    `Reporte_Alumnos_${fecha}.csv`,
    ["RUT", "Nombre", "Apellido", "Correo", "Teléfono", "Plan", "Créditos", "Estado Suscripción", "Último Pago", "Método", "Estado Pago", "Fecha Pago", "Contacto Emergencia", "Condición Médica"],
    rows
  );
  return rows.length;
}

export interface ReporteMensualAcademia {
  mes: string | null;
  ingresos: number;
  pagos_aprobados: number;
  bajas: number;
  promedio_dias_registrados: number | null;
}

export async function consultarReporteMensual(supabase: SupabaseClient): Promise<ReporteMensualAcademia[]> {
  try {
    const { data, error } = await supabase.rpc("reporte_mensual_academia");
    if (!error && data && data.length > 0) return data;
  } catch (rpcErr) {
    console.warn("RPC reporte_mensual_academia no disponible, usando fallback relacional:", rpcErr);
  }

  // Fallback: calcular directamente desde user_pagos
  try {
    const { data: pagos } = await supabase
      .from("user_pagos")
      .select("monto, estado, fecha_pago, created_at")
      .eq("estado", "aprobado");

    if (pagos && pagos.length > 0) {
      const mesesMap: Record<string, { ingresos: number; count: number }> = {};
      pagos.forEach(p => {
        const fechaStr = p.fecha_pago || p.created_at;
        if (!fechaStr) return;
        const d = new Date(fechaStr);
        const mesKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (!mesesMap[mesKey]) mesesMap[mesKey] = { ingresos: 0, count: 0 };
        mesesMap[mesKey].ingresos += Number(p.monto) || 0;
        mesesMap[mesKey].count++;
      });

      return Object.entries(mesesMap).map(([mes, info]) => ({
        mes,
        ingresos: info.ingresos,
        pagos_aprobados: info.count,
        bajas: 0,
        promedio_dias_registrados: null
      }));
    }
  } catch (err) {
    console.warn("Error en fallback de pagos:", err);
  }

  return [];
}

export async function exportFinanzasToExcel(supabase: SupabaseClient): Promise<number> {
  const meses = await consultarReporteMensual(supabase);
  const fecha = new Date().toISOString().slice(0, 10);
  downloadCsv(`Reporte_Finanzas_Mensuales_${fecha}.csv`,
    ["Mes", "Ingresos aprobados (CLP)", "Pagos aprobados", "Bajas de alumnos", "Promedio de días registrados al darse de baja"],
    meses.map(mes => [mes.mes ?? "Sin fecha", mes.ingresos, mes.pagos_aprobados, mes.bajas, mes.promedio_dias_registrados]));
  return meses.length;
}
