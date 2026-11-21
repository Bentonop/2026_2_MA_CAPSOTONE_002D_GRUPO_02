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
    const str = String(val).replace(/"/g, '""');
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

export interface AlumnoExportData {
  rut?: string | null;
  name?: string | null;
  last_name?: string | null;
  correo?: string | null;
  phone?: string | null;
  contacto_emergencia?: string | null;
  condicion_medica?: string | null;
  plan_nombre?: string | null;
  creditos_restantes?: number | null;
  estado_suscripcion?: string | null;
  monto_ultimo_pago?: number | null;
  metodo_pago?: string | null;
  estado_pago?: string | null;
  fecha_pago?: string | null;
  fecha_registro?: string | null;
}

/**
 * Genera y descarga el Reporte Maestro de Alumnos, Planes y Pagos para Administración.
 */
export async function exportAlumnosYPagosToExcel(supabase: SupabaseClient): Promise<number> {
  // 1. Obtener todos los alumnos
  const { data: alumnos, error: alumnosErr } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", "alumno")
    .order("name", { ascending: true });

  if (alumnosErr) throw alumnosErr;

  const alumnosList = alumnos || [];
  if (alumnosList.length === 0) {
    // Si la base estuviese vacía, exportar encabezados con una fila vacía
    const today = new Date().toISOString().split("T")[0];
    downloadCsv(`Reporte_Alumnos_Cuerpo_y_Alma_${today}.csv`, getHeadersReporteAlumnos(), []);
    return 0;
  }

  // 2. Obtener suscripciones y pagos
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

  // Agrupar suscripciones y pagos por usuario (la más reciente primero)
  const suscripcionesByUser = new Map<string, any>();
  (suscripciones || []).forEach((sub) => {
    if (!suscripcionesByUser.has(sub.user_id)) {
      suscripcionesByUser.set(sub.user_id, sub);
    }
  });

  const pagosByUser = new Map<string, any>();
  (pagos || []).forEach((p) => {
    if (!pagosByUser.has(p.user_id)) {
      pagosByUser.set(p.user_id, p);
    }
  });

  // 3. Mapear cada alumno a una fila de Excel
  const rows = alumnosList.map((alumno) => {
    const sub = suscripcionesByUser.get(alumno.id);
    const pago = pagosByUser.get(alumno.id);

    const planNombre = sub?.planes?.nombre_plan || (sub ? "Plan Activo" : "Sin Plan");
    const creditos = sub?.creditos_restantes !== undefined ? sub.creditos_restantes : "0";
    const estadoSub = sub?.estado ? capitalizar(sub.estado) : "Sin Suscripción";

    const montoPago = pago?.monto ? `$${Number(pago.monto).toLocaleString("es-CL")}` : (sub?.planes?.precio ? `$${Number(sub.planes.precio).toLocaleString("es-CL")}` : "No registrado");
    const metodoPago = pago?.metodo_pago ? capitalizar(pago.metodo_pago) : "Transferencia / Manual";
    const estadoPago = pago?.estado ? capitalizar(pago.estado) : (sub?.estado === "activa" ? "Aprobado" : "Pendiente");
    const fechaPago = pago?.fecha_pago ? formatFecha(pago.fecha_pago) : (sub?.created_at ? formatFecha(sub.created_at) : "No registrada");

    const fechaRegistro = alumno.created_at ? formatFecha(alumno.created_at) : "No registrada";

    return [
      alumno.rut || "No registrado",
      alumno.name || "Sin nombre",
      alumno.last_name || "",
      alumno.correo || "Sin correo",
      alumno.phone || "No registrado",
      planNombre,
      creditos,
      estadoSub,
      montoPago,
      metodoPago,
      estadoPago,
      fechaPago,
      alumno.contacto_emergencia || "No registrado",
      alumno.condicion_medica || "Ninguna registrada",
      fechaRegistro,
    ];
  });

  const today = new Date().toISOString().split("T")[0];
  downloadCsv(`Reporte_Alumnos_y_Pagos_Cuerpo_y_Alma_${today}.csv`, getHeadersReporteAlumnos(), rows);

  return alumnosList.length;
}

/**
 * Genera y descarga el Reporte Financiero de Pagos
 */
export async function exportFinanzasToExcel(supabase: SupabaseClient): Promise<number> {
  const { data: pagos, error } = await supabase
    .from("user_pagos")
    .select("*, profiles:user_id(name, last_name, rut, correo), user_suscripciones(planes(nombre_plan))")
    .order("fecha_pago", { ascending: false });

  if (error) throw error;

  const pagosList = pagos || [];
  const rows = pagosList.map((pago: any) => {
    const alumno = pago.profiles;
    const plan = pago.user_suscripciones?.planes;

    return [
      pago.id.substring(0, 8),
      alumno ? `${alumno.name || ""} ${alumno.last_name || ""}`.trim() : "Alumno Desconocido",
      alumno?.rut || "No registrado",
      alumno?.correo || "Sin correo",
      plan?.nombre_plan || "Plan Estándar",
      `$${Number(pago.monto || 0).toLocaleString("es-CL")}`,
      capitalizar(pago.metodo_pago || "Transferencia"),
      capitalizar(pago.estado || "Pendiente"),
      pago.fecha_pago ? formatFecha(pago.fecha_pago) : "No registrada",
      pago.comprobante_url || "Sin comprobante",
    ];
  });

  const headers = [
    "ID Transacción",
    "Alumno",
    "RUT",
    "Correo",
    "Plan Contratado",
    "Monto ($ CLP)",
    "Método de Pago",
    "Estado del Pago",
    "Fecha de Pago",
    "Comprobante / Referencia",
  ];

  const today = new Date().toISOString().split("T")[0];
  downloadCsv(`Reporte_Finanzas_Pagos_Cuerpo_y_Alma_${today}.csv`, headers, rows);

  return pagosList.length;
}

function getHeadersReporteAlumnos(): string[] {
  return [
    "RUT",
    "Nombres",
    "Apellidos",
    "Correo Electrónico",
    "Teléfono",
    "Plan Contratado",
    "Clases / Créditos Restantes",
    "Estado Suscripción",
    "Último Monto Pagado",
    "Método de Pago",
    "Estado de Pago",
    "Fecha de Pago",
    "Contacto de Emergencia",
    "Ficha / Condición Médica",
    "Fecha de Registro en Academia",
  ];
}

function capitalizar(texto: string): string {
  if (!texto) return "";
  return texto.charAt(0).toUpperCase() + texto.slice(1).toLowerCase();
}

function formatFecha(fechaIso: string): string {
  try {
    const d = new Date(fechaIso);
    if (isNaN(d.getTime())) return fechaIso;
    return d.toLocaleString("es-CL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return fechaIso;
  }
}
