"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import toast from "react-hot-toast";
import { consultarReporteMensual, exportAlumnosYPagosToExcel } from "@/lib/exportExcel";

interface UrgencyClass {
  id: string;
  name: string;
  timeRange: string;
  room: string;
  reason: string;
  enrolled: number;
  maxCapacity: number;
}

interface Professor {
  id: string;
  name: string;
  last_name: string | null;
  especialidad: string | null;
}

interface PlanPopular {
  nombre: string;
  alumnos: number;
  porcentaje: number;
  color: string;
}

interface PagoReciente {
  id: string;
  alumnoNombre: string;
  planNombre: string;
  monto: number;
  metodo: string;
  estado: string;
  fecha: string;
}

interface DashboardMetrics {
  gananciasMes: number | null;
  gananciasPendientes: number;
  totalAlumnos: number;
  alumnosActivos: number;
  alumnosNuevosMes: number;
  pagosPendientesCount: number;
  tasaAsistencia: number | null;
  planesPopulares: PlanPopular[];
  ultimosPagos: PagoReciente[];
}

export default function AdminDashboardPage() {
  const [urgencies, setUrgencies] = useState<UrgencyClass[]>([]);
  const [profesores, setProfesores] = useState<Professor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isReassignModalOpen, setIsReassignModalOpen] = useState(false);
  const [selectedUrgency, setSelectedUrgency] = useState<UrgencyClass | null>(null);
  const [selectedSubstitute, setSelectedSubstitute] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [metrics, setMetrics] = useState<DashboardMetrics>({
    gananciasMes: null,
    gananciasPendientes: 0,
    totalAlumnos: 0,
    alumnosActivos: 0,
    alumnosNuevosMes: 0,
    pagosPendientesCount: 0,
    tasaAsistencia: null,
    planesPopulares: [],
    ultimosPagos: [],
  });

  useEffect(() => {
    loadAllDashboardData();
  }, []);

  async function loadAllDashboardData() {
    setIsLoading(true);
    await Promise.allSettled([
      fetchMetrics(),
      fetchUrgencies(),
      fetchProfesores(),
    ]);
    setIsLoading(false);
  }

  const showToast = (msg: string) => {
    setToastMessage(msg);
    toast.success(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  async function fetchProfesores() {
    try {
      if (!supabase) return;
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, last_name, especialidad")
        .eq("role", "profesor")
        .order("name", { ascending: true });

      if (error) throw error;
      if (data && data.length > 0) setProfesores(data);
    } catch (err) {
      console.error("Error al cargar profesores:", err);
    }
  }

  async function fetchUrgencies() {
    try {
      if (!supabase) throw new Error("No Supabase");

      const { data, error } = await supabase
        .from("clase")
        .select("*")
        .eq("estado_clase", "cancelada")
        .order("fecha_hora_inicio", { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        const mapped: UrgencyClass[] = data.map((c: any) => {
          const start = new Date(c.fecha_hora_inicio);
          const end = new Date(c.fecha_hora_fin);
          return {
            id: c.id_clase.toString(),
            name: c.nombre_clase,
            timeRange: `${start.getHours().toString().padStart(2, '0')}:${start.getMinutes().toString().padStart(2, '0')} - ${end.getHours().toString().padStart(2, '0')}:${end.getMinutes().toString().padStart(2, '0')}`,
            room: c.sala || "Sala Principal",
            reason: c.descripcion || "Sin motivo especificado",
            enrolled: c.cupos_inscritos || 0,
            maxCapacity: c.cupo_maximo || 8,
          };
        });
        setUrgencies(mapped);
      } else {
        setUrgencies([]);
      }
    } catch (err) {
      console.error("Error cargando urgencias:", err);
      // Fallback data para demo si no hay conexión
      setUrgencies([
        {
          id: "demo-urg",
          name: "Pole Exotic & Choreo",
          timeRange: "18:30 - 19:45",
          room: "Sala Pole 1",
          reason: "[CANCELADA] Motivo: Me doblé el tobillo en el ensayo.",
          enrolled: 6,
          maxCapacity: 8
        }
      ]);
    }
  }

  async function fetchMetrics() {
    try {
      if (!supabase) return;

      // 1. Alumnos
      const { data: alumnosData } = await supabase
        .from("profiles")
        .select("id, name, last_name, role, created_at, active")
        .eq("role", "alumno");

      // 2. Suscripciones con planes
      const { data: subsData } = await supabase
        .from("user_suscripciones")
        .select("id, user_id, plan_id, estado, creditos_restantes, created_at, planes(id_plan, nombre_plan, precio)");

      // 3. Pagos
      const { data: pagosData } = await supabase
        .from("user_pagos")
        .select("id, user_id, suscripcion_id, monto, metodo_pago, estado, fecha_pago, created_at")
        .order("fecha_pago", { ascending: false });

      const mesActual = new Intl.DateTimeFormat("sv-SE", {
        timeZone: "America/Santiago", year: "numeric", month: "2-digit",
      }).format(new Date());
      const ingresosMes = await consultarReporteMensual(supabase)
        .then(filas => Number(filas.find(fila => fila.mes?.startsWith(mesActual))?.ingresos ?? 0))
        .catch(error => {
          console.error("No se pudo obtener el total mensual:", error);
          return null;
        });

      if (alumnosData) {
        const totalAlumnos = alumnosData.length;
        
        // Alumnos nuevos últimos 30 días
        const treintaDiasAtras = new Date();
        treintaDiasAtras.setDate(treintaDiasAtras.getDate() - 30);
        const alumnosNuevos = alumnosData.filter(a => a.created_at && new Date(a.created_at) >= treintaDiasAtras).length;

        // Suscripciones activas
        const activeSubs = (subsData || []).filter(s => s.estado === "activa");
        const uniqueActiveUsers = new Set(activeSubs.map(s => s.user_id)).size;

        // Finanzas
        let totalPendiente = 0;
        let countPendientes = 0;

        (pagosData || []).forEach(p => {
          const montoNum = Number(p.monto) || 0;
          if (p.estado === "pendiente") {
            totalPendiente += montoNum;
            countPendientes++;
          }
        });

        // Distribución de Planes
        const planCounts: Record<string, number> = {};
        (subsData || []).forEach(s => {
          const pName = (s as any)?.planes?.nombre_plan || "Plan Estándar";
          planCounts[pName] = (planCounts[pName] || 0) + 1;
        });

        const totalSubs = Object.values(planCounts).reduce((a, b) => a + b, 0) || 1;
        const colorPalette = ["bg-primary", "bg-secondary", "bg-emerald-500", "bg-amber-500", "bg-sky-500"];
        
        const planesPopulares: PlanPopular[] = Object.entries(planCounts).map(([nombre, count], idx) => ({
          nombre,
          alumnos: count,
          porcentaje: Math.round((count / totalSubs) * 100),
          color: colorPalette[idx % colorPalette.length],
        })).sort((a, b) => b.alumnos - a.alumnos);

        // Mapear últimos 5 pagos
        const profilesMap = new Map(alumnosData.map(a => [a.id, `${a.name || "Alumno"} ${a.last_name || ""}`.trim()]));
        const subsMap = new Map((subsData || []).map(s => [s.id, (s as any)?.planes?.nombre_plan || "Plan General"]));

        const ultimosPagos: PagoReciente[] = (pagosData || []).slice(0, 5).map(p => {
          const alumnoName = profilesMap.get(p.user_id) || "Alumno Registrado";
          const planName = subsMap.get(p.suscripcion_id) || "Plan Mensual";
          const dateObj = p.fecha_pago ? new Date(p.fecha_pago) : new Date(p.created_at || Date.now());
          const dateStr = dateObj.toLocaleDateString("es-CL", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

          return {
            id: p.id,
            alumnoNombre: alumnoName,
            planNombre: planName,
            monto: Number(p.monto) || 0,
            metodo: p.metodo_pago ? (p.metodo_pago.charAt(0).toUpperCase() + p.metodo_pago.slice(1)) : "Transferencia",
            estado: p.estado || "aprobado",
            fecha: dateStr,
          };
        });

        setMetrics({
          gananciasMes: ingresosMes,
          gananciasPendientes: totalPendiente,
          totalAlumnos,
          alumnosActivos: uniqueActiveUsers,
          alumnosNuevosMes: alumnosNuevos,
          pagosPendientesCount: countPendientes,
          tasaAsistencia: null,
          planesPopulares,
          ultimosPagos,
        });
      }
    } catch (err) {
      console.error("Error al calcular métricas del dashboard:", err);
    }
  }

  const handleDescargarExcel = async () => {
    if (!supabase) return;
    try {
      setIsExporting(true);
      const count = await exportAlumnosYPagosToExcel(supabase);
      toast.success(`Planilla Excel descargada con éxito (${count} alumnos procesados).`);
    } catch (err) {
      console.error(err);
      toast.error("Error al exportar planilla Excel.");
    } finally {
      setIsExporting(false);
    }
  };

  const openReassignModal = (urgency: UrgencyClass) => {
    setSelectedUrgency(urgency);
    setIsReassignModalOpen(true);
  };

  const handleReassign = async () => {
    if (!selectedUrgency || !selectedSubstitute) return;

    const profObj = profesores.find(p => p.id === selectedSubstitute);
    const profNombre = profObj ? `${profObj.name} ${profObj.last_name || ''}`.trim() : "Docente Suplente";

    setUrgencies(prev => prev.filter(u => u.id !== selectedUrgency.id));
    
    try {
      if (supabase && selectedUrgency.id !== "demo-urg") {
        await supabase
          .from("clase")
          .update({ 
            estado_clase: 'programada',
            id_profesor: selectedSubstitute,
            descripcion: `Reasignada a suplente: ${profNombre}` 
          })
          .eq("id_clase", parseInt(selectedUrgency.id));
      }
      showToast(`Clase reasignada a ${profNombre} exitosamente.`);
    } catch (err) {
      console.error(err);
      showToast(`Clase reasignada a ${profNombre} (Demo)`);
    }

    setIsReassignModalOpen(false);
    setSelectedUrgency(null);
    setSelectedSubstitute("");
  };

  const formatCLP = (val: number) => {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="flex flex-col w-full pb-16">
      {/* HEADER PRINCIPAL */}
      <header className="pt-safe pb-4 px-margin-mobile flex flex-col sm:flex-row sm:items-center justify-between gap-4 sticky top-0 z-10 glass-panel border-x-0 border-t-0 rounded-none border-b border-surface-container shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[28px]">dashboard</span>
            <h1 className="font-headline-md text-headline-md gradient-text font-bold">
              Panel de Control
            </h1>
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
            Resumen ejecutivo del estudio: ganancias, inscripciones y operación diaria.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* BOTÓN EXCEL DIRECTO */}
          <button
            onClick={handleDescargarExcel}
            disabled={isExporting}
            title="Descargar lista completa de alumnos, planes y pagos en Excel"
            className="px-4 h-10 rounded-full border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 flex items-center gap-2 shadow-sm active:scale-95 transition-all font-bold text-xs disabled:opacity-50"
          >
            <span className={`material-symbols-outlined text-[18px] ${isExporting ? 'animate-spin' : ''}`}>
              {isExporting ? 'refresh' : 'download'}
            </span>
            <span>{isExporting ? 'Generando...' : 'Descargar Excel'}</span>
          </button>

          {/* BOTÓN ACTUALIZAR */}
          <button
            type="button"
            onClick={loadAllDashboardData}
            disabled={isLoading}
            aria-label="Actualizar métricas"
            className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-surface-container-low hover:bg-surface-container-high border border-surface-container text-on-surface transition-all active:scale-95 disabled:opacity-50"
          >
            <span className={`material-symbols-outlined text-[20px] ${isLoading ? "animate-spin" : ""}`}>
              refresh
            </span>
          </button>
        </div>
      </header>

      <div className="px-margin-mobile pt-space-md flex flex-col gap-6">
        {/* BANNER DINÁMICO DE URGENCIAS / REEMPLAZOS */}
        {urgencies.length > 0 ? (
          <section className="p-4 sm:p-5 rounded-2xl bg-error-container/15 border border-error/30 shadow-sm flex flex-col gap-3 animate-in fade-in">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-error animate-ping"></span>
                <span className="px-2.5 py-0.5 rounded-full bg-error text-on-error font-label-caps text-label-caps font-bold text-xs">
                  URGENCIA DOCENTE PENDIENTE
                </span>
                <span className="text-xs font-bold text-error">
                  {urgencies.length} clase{urgencies.length > 1 ? 's' : ''} requiere{urgencies.length > 1 ? 'n' : ''} reemplazo
                </span>
              </div>
            </div>

            {urgencies.map(urg => (
              <div key={urg.id} className="p-3.5 rounded-xl bg-surface-container-lowest/80 border border-error/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-title-md font-bold text-on-surface">{urg.name}</h3>
                    <span className="text-xs px-2 py-0.5 rounded bg-surface-container font-mono text-on-surface-variant font-bold">{urg.timeRange}</span>
                  </div>
                  <p className="font-body-sm text-on-surface-variant text-xs mt-1">
                    {urg.room} • {urg.enrolled}/{urg.maxCapacity} Alumnos inscritos • <span className="italic text-error">{urg.reason}</span>
                  </p>
                </div>
                <button 
                  onClick={() => openReassignModal(urg)}
                  className="px-4 py-2 rounded-xl bg-secondary text-on-secondary font-label-md text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-transform shrink-0"
                >
                  <span className="material-symbols-outlined text-[18px]">group_add</span>
                  Asignar Suplente
                </button>
              </div>
            ))}
          </section>
        ) : (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-emerald-500 text-[22px]">check_circle</span>
              <span className="font-label-md text-xs text-on-surface font-semibold">
                Operación al día: Sin urgencias docentes ni clases canceladas sin cubrir.
              </span>
            </div>
            <span className="text-xs text-emerald-600 font-bold bg-emerald-500/15 px-2.5 py-1 rounded-full">
              100% Cubierto
            </span>
          </div>
        )}

        {/* TARJETAS DE KPIS PRINCIPALES (GRID 4 COLUMNAS) */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* KPI 1: Ingresos aprobados del mes */}
          <article className="p-5 rounded-2xl glass-panel border border-surface-container hover:border-emerald-500/30 transition-all flex flex-col justify-between shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-15 group-hover:opacity-25 transition-opacity text-emerald-500">
              <span className="material-symbols-outlined text-[64px]">payments</span>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-label-sm uppercase tracking-wider text-xs font-bold text-on-surface-variant">
                  Ingresos aprobados del mes
                </span>
                <span className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px]">attach_money</span>
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-emerald-500 tracking-tight">
                {metrics.gananciasMes === null ? "Sin datos" : formatCLP(metrics.gananciasMes)}
              </h2>
            </div>
            <div className="mt-3 pt-3 border-t border-surface-container flex items-center justify-between text-xs">
              <span className="text-on-surface-variant flex items-center gap-1">
                <span className="material-symbols-outlined text-emerald-500 text-[14px]">trending_up</span>
                Pagos Aprobados
              </span>
              <span className="font-bold text-emerald-600">Al día</span>
            </div>
          </article>

          {/* KPI 2: Total Alumnos & Activos */}
          <article className="p-5 rounded-2xl glass-panel border border-surface-container hover:border-primary/30 transition-all flex flex-col justify-between shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-15 group-hover:opacity-25 transition-opacity text-primary">
              <span className="material-symbols-outlined text-[64px]">group</span>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-label-sm uppercase tracking-wider text-xs font-bold text-on-surface-variant">
                  Alumnos Inscritos
                </span>
                <span className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px]">group</span>
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-on-surface tracking-tight">
                {metrics.totalAlumnos}{" "}
                <span className="text-sm font-normal text-on-surface-variant">alumnos</span>
              </h2>
            </div>
            <div className="mt-3 pt-3 border-t border-surface-container flex items-center justify-between text-xs">
              <span className="text-on-surface-variant">
                <strong className="text-primary">{metrics.alumnosActivos}</strong> con plan activo
              </span>
              <span className="font-bold text-primary">+{metrics.alumnosNuevosMes} este mes</span>
            </div>
          </article>

          {/* KPI 3: Pagos Pendientes de Validar */}
          <article className="p-5 rounded-2xl glass-panel border border-surface-container hover:border-amber-500/30 transition-all flex flex-col justify-between shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-15 group-hover:opacity-25 transition-opacity text-amber-500">
              <span className="material-symbols-outlined text-[64px]">pending_actions</span>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-label-sm uppercase tracking-wider text-xs font-bold text-on-surface-variant">
                  Por Aprobar
                </span>
                <span className="w-8 h-8 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px]">hourglass_top</span>
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-amber-500 tracking-tight">
                {formatCLP(metrics.gananciasPendientes)}
              </h2>
            </div>
            <div className="mt-3 pt-3 border-t border-surface-container flex items-center justify-between text-xs">
              <span className="text-on-surface-variant">
                {metrics.pagosPendientesCount} transferencias por validar
              </span>
              <Link 
                href="/admin/alumnos"
                className="font-bold text-amber-600 hover:underline flex items-center gap-0.5"
              >
                Revisar
                <span className="material-symbols-outlined text-[12px]">chevron_right</span>
              </Link>
            </div>
          </article>

          {/* KPI 4: Tasa de Asistencia / Ocupación */}
          <article className="p-5 rounded-2xl glass-panel border border-surface-container hover:border-secondary/30 transition-all flex flex-col justify-between shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-15 group-hover:opacity-25 transition-opacity text-secondary">
              <span className="material-symbols-outlined text-[64px]">analytics</span>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-label-sm uppercase tracking-wider text-xs font-bold text-on-surface-variant">
                  Asistencia & Cupos
                </span>
                <span className="w-8 h-8 rounded-full bg-secondary/10 text-secondary flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px]">qr_code_scanner</span>
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-secondary tracking-tight">
                {metrics.tasaAsistencia === null ? "Sin datos" : `${metrics.tasaAsistencia}%`}
              </h2>
            </div>
            <div className="mt-3 pt-3 border-t border-surface-container flex items-center justify-between text-xs">
              <span className="text-on-surface-variant">Asistencia QR en sala</span>
              <span className="font-bold text-secondary">Óptimo</span>
            </div>
          </article>
        </section>

        {/* SECCIÓN INTERMEDIA: GRÁFICO DE PLANES Y TABLA DE ÚLTIMOS PAGOS */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* DISTRIBUCIÓN DE PLANES (5 Cols) */}
          <section className="lg:col-span-5 p-5 rounded-2xl glass-panel border border-surface-container flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-title-md font-bold text-on-surface">Planes más Populares</h3>
                  <p className="font-body-sm text-xs text-on-surface-variant">Distribución de alumnos por plan activo</p>
                </div>
                <Link 
                  href="/admin/planes"
                  className="text-xs font-bold text-primary hover:underline flex items-center gap-0.5"
                >
                  Gestionar
                  <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </Link>
              </div>

              <div className="flex flex-col gap-3.5 mt-2">
                {metrics.planesPopulares.map((plan, i) => (
                  <div key={i} className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-on-surface">{plan.nombre}</span>
                      <span className="text-on-surface-variant">
                        <strong className="text-on-surface">{plan.alumnos}</strong> alumnos ({plan.porcentaje}%)
                      </span>
                    </div>
                    {/* Barra de Progreso */}
                    <div className="w-full h-2.5 rounded-full bg-surface-container-highest overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${plan.color} transition-all duration-500`}
                        style={{ width: `${Math.min(plan.porcentaje, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 p-3 rounded-xl bg-surface-container-low border border-surface-container text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[18px]">verified</span>
                <span className="text-on-surface-variant">Total matriculados con plan</span>
              </div>
              <strong className="text-on-surface">{metrics.alumnosActivos} activos</strong>
            </div>
          </section>

          {/* ÚLTIMOS PAGOS RECIBIDOS (7 Cols) */}
          <section className="lg:col-span-7 p-5 rounded-2xl glass-panel border border-surface-container flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-title-md font-bold text-on-surface">Últimos Pagos Registrados</h3>
                  <p className="font-body-sm text-xs text-on-surface-variant">Transacciones y transferencias recientes</p>
                </div>
                <Link 
                  href="/admin/alumnos"
                  className="text-xs font-bold text-primary hover:underline flex items-center gap-0.5"
                >
                  Ver todos
                  <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </Link>
              </div>

              <div className="flex flex-col gap-2.5">
                {metrics.ultimosPagos.map((pago) => (
                  <div 
                    key={pago.id}
                    className="p-3 rounded-xl bg-surface-container-low hover:bg-surface-container-high transition-colors border border-surface-container flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                        pago.estado === 'aprobado' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'
                      }`}>
                        <span className="material-symbols-outlined text-[18px]">
                          {pago.estado === 'aprobado' ? 'check' : 'hourglass_empty'}
                        </span>
                      </div>
                      <div>
                        <div className="font-bold text-xs text-on-surface">{pago.alumnoNombre}</div>
                        <div className="text-[11px] text-on-surface-variant">
                          {pago.planNombre} • {pago.metodo}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end shrink-0">
                      <span className="font-bold text-xs text-on-surface">
                        {formatCLP(pago.monto)}
                      </span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                          pago.estado === 'aprobado' 
                            ? 'bg-emerald-500/15 text-emerald-600' 
                            : 'bg-amber-500/15 text-amber-600'
                        }`}>
                          {pago.estado === 'aprobado' ? 'Aprobado' : 'Pendiente'}
                        </span>
                        <span className="text-[10px] text-on-surface-variant">{pago.fecha}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-surface-container flex items-center justify-between">
              <span className="text-xs text-on-surface-variant">
                Descarga el histórico completo con 1 clic:
              </span>
              <button
                onClick={handleDescargarExcel}
                className="text-xs font-bold text-emerald-600 hover:text-emerald-500 flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[16px]">file_download</span>
                Descargar en Excel
              </button>
            </div>
          </section>
        </div>

        {/* ACCESOS RÁPIDOS PARA LA ADMINISTRADORA */}
        <section className="mt-2">
          <h3 className="font-title-sm font-bold text-on-surface-variant uppercase tracking-wider text-xs mb-3 px-1">
            Accesos Rápidos de Administración
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <button
              onClick={handleDescargarExcel}
              className="p-4 rounded-2xl glass-panel border border-surface-container hover:border-emerald-500/40 text-left transition-all active:scale-95 group flex items-start gap-3"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-[22px]">table_view</span>
              </div>
              <div>
                <div className="font-bold text-xs text-on-surface">Descargar Planilla</div>
                <p className="text-[11px] text-on-surface-variant mt-0.5">Reporte Alumnos y Pagos</p>
              </div>
            </button>

            <Link
              href="/admin/alumnos"
              className="p-4 rounded-2xl glass-panel border border-surface-container hover:border-primary/40 text-left transition-all active:scale-95 group flex items-start gap-3"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-[22px]">badge</span>
              </div>
              <div>
                <div className="font-bold text-xs text-on-surface">Directorio Alumnos</div>
                <p className="text-[11px] text-on-surface-variant mt-0.5">Matrículas e invitaciones</p>
              </div>
            </Link>

            <Link
              href="/admin/planes"
              className="p-4 rounded-2xl glass-panel border border-surface-container hover:border-secondary/40 text-left transition-all active:scale-95 group flex items-start gap-3"
            >
              <div className="w-10 h-10 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-[22px]">loyalty</span>
              </div>
              <div>
                <div className="font-bold text-xs text-on-surface">Planes & Tarifas</div>
                <p className="text-[11px] text-on-surface-variant mt-0.5">Crear o ajustar precios</p>
              </div>
            </Link>

            <Link
              href="/admin/clases"
              className="p-4 rounded-2xl glass-panel border border-surface-container hover:border-amber-500/40 text-left transition-all active:scale-95 group flex items-start gap-3"
            >
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-[22px]">calendar_month</span>
              </div>
              <div>
                <div className="font-bold text-xs text-on-surface">Agenda de Clases</div>
                <p className="text-[11px] text-on-surface-variant mt-0.5">Horarios y asistencia QR</p>
              </div>
            </Link>
          </div>
        </section>
      </div>

      {/* MODAL REASIGNAR PROFESOR SUPLENTE */}
      {isReassignModalOpen && selectedUrgency && (
        <div className="fixed inset-0 z-[60] bg-inverse-surface/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
          <div className="w-full bg-surface-container-lowest rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl flex flex-col gap-4 max-w-lg animate-in slide-in-from-bottom">
            <div className="w-12 h-1.5 rounded-full bg-surface-variant mx-auto mb-1 sm:hidden"></div>
            
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[24px]">assignment_ind</span>
              </div>
              <div>
                <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">Reasignar Clase Urgente</h3>
                <p className="font-body-sm text-body-sm text-secondary font-semibold">{selectedUrgency.name}</p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container text-xs text-on-surface-variant">
              <strong>Motivo de ausencia:</strong> {selectedUrgency.reason}
            </div>

            <div className="flex flex-col gap-1.5 mt-2">
              <label className="font-label-sm text-label-sm text-on-surface font-bold">
                Seleccionar Profesor Suplente:
              </label>
              <select 
                value={selectedSubstitute}
                onChange={(e) => setSelectedSubstitute(e.target.value)}
                className="w-full h-12 bg-surface-container-high border border-surface-container-highest rounded-xl px-4 font-body-md text-sm text-on-surface focus:outline-none focus:border-secondary"
              >
                <option value="" disabled>Elige un profesor del equipo...</option>
                {profesores.length > 0 ? (
                  profesores.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.last_name || ''} {p.especialidad ? `(${p.especialidad})` : ''}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="Camila Rivas">Camila Rivas (Urbano/Flow)</option>
                    <option value="Carlos Vega">Carlos 'Che' Vega (Pole Dance)</option>
                    <option value="Lucía Ferrer">Lucía Ferrer (Heels/Pole)</option>
                    <option value="Andrea Montes">Andrea Montes (Flex & Yoga)</option>
                  </>
                )}
              </select>
            </div>

            <div className="flex items-center justify-end gap-3 mt-4">
              <button 
                type="button"
                onClick={() => setIsReassignModalOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-surface-container text-on-surface font-label-md text-sm font-bold hover:bg-surface-container"
              >
                Cancelar
              </button>
              <button 
                type="button"
                onClick={handleReassign}
                disabled={!selectedSubstitute}
                className="px-5 py-2.5 rounded-xl bg-secondary text-on-secondary font-label-md text-sm font-bold shadow-md disabled:opacity-50 flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">check</span>
                Confirmar Reasignación
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
