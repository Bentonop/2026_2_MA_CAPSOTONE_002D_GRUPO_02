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
  const { data, error } = await supabase.rpc("reporte_alumnos_operativo");
  if (error) throw error;

  const fecha = new Date().toISOString().slice(0, 10);
  const alumnos = data ?? [];
  downloadCsv(`Reporte_Alumnos_${fecha}.csv`,
    ["Nombre", "Apellido", "Días desde el registro", "Plan", "Estado del plan", "Vencimiento",
      "Créditos disponibles", "Último pago (CLP)", "Estado del último pago"],
    alumnos.map((alumno: {
      nombre: string; apellido: string | null; dias_registrados: number; plan: string | null;
      estado_plan: string | null; vence: string | null; creditos: number;
      ultimo_monto: number | null; estado_pago: string | null;
    }) => [
      alumno.nombre, alumno.apellido, alumno.dias_registrados, alumno.plan, alumno.estado_plan,
      alumno.vence ? new Date(alumno.vence).toLocaleString("es-CL", { timeZone: "America/Santiago" }) : null,
      alumno.creditos, alumno.ultimo_monto, alumno.estado_pago,
    ]));
  return alumnos.length;
}

export interface ReporteMensualAcademia {
  mes: string | null;
  ingresos: number;
  pagos_aprobados: number;
  bajas: number;
  promedio_dias_registrados: number | null;
}

export async function consultarReporteMensual(supabase: SupabaseClient): Promise<ReporteMensualAcademia[]> {
  const { data, error } = await supabase.rpc("reporte_mensual_academia");
  if (error) throw error;
  return data ?? [];
}

export async function exportFinanzasToExcel(supabase: SupabaseClient): Promise<number> {
  const meses = await consultarReporteMensual(supabase);
  const fecha = new Date().toISOString().slice(0, 10);
  downloadCsv(`Reporte_Finanzas_Mensuales_${fecha}.csv`,
    ["Mes", "Ingresos aprobados (CLP)", "Pagos aprobados", "Bajas de alumnos", "Promedio de días registrados al darse de baja"],
    meses.map(mes => [mes.mes ?? "Sin fecha", mes.ingresos, mes.pagos_aprobados, mes.bajas, mes.promedio_dias_registrados]));
  return meses.length;
}
