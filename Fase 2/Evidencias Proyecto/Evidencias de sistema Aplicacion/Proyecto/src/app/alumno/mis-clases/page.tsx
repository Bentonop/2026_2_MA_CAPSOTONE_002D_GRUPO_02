"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { crearPaseAlumno } from "@/lib/paseAlumno";
import { QRCodeSVG } from "qrcode.react";
import toast from "react-hot-toast";

export default function MisClasesPage() {
  const [activeTab, setActiveTab] = useState("hoy");
  const [reservas, setReservas] = useState<any[]>([]);
  const [credits, setCredits] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  // Estado para modal de Pase QR del alumno
  const [selectedReserva, setSelectedReserva] = useState<any | null>(null);

  const fetchMyClasses = async () => {
    if (!supabase) return;
    
    let targetUserId: string | null = null;
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser?.id) targetUserId = authUser.id;
    } catch (e) {
      console.error("Error getting auth user:", e);
    }

    if (!targetUserId) {
      setIsLoading(false);
      return;
    }
    
    const { data: subs } = await supabase
      .from("user_suscripciones")
      .select("creditos_restantes")
      .eq("user_id", targetUserId)
      .eq("estado", "activa")
      .gt("creditos_restantes", 0)
      .or(`fecha_fin.is.null,fecha_fin.gt.${new Date().toISOString()}`);
      
    if (subs) {
       const totalCredits = subs.reduce((sum, sub) => sum + sub.creditos_restantes, 0);
       setCredits(totalCredits);
    }

    // Fetch reservations with class details
    const { data, error } = await supabase
      .from('reserva')
      .select(`
         *,
         clase (
            *,
            profiles:id_profesor (name)
         )
      `)
      .eq("id_usuario", targetUserId)
      .order("fecha_operacion", { ascending: false });
      
    if (!error && data) {
      // filter out invalid and cancelled
      const validData = data.filter(r => r.clase && r.estado_reserva !== "cancelada");
      setReservas(validData);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchMyClasses();
  }, []);

  const handleCancelarReserva = async (reserva: any) => {
    const classStartTime = new Date(reserva.clase.fecha_hora_inicio);
    const hoursDifference = (classStartTime.getTime() - Date.now()) / (1000 * 60 * 60);

    // Regla estricta: Solo permitir cancelar con al menos 2 horas de anticipación
    if (hoursDifference < 2) {
      toast.error("No es posible cancelar: las cancelaciones deben realizarse con al menos 2 horas de anticipación al inicio de la clase.");
      return;
    }

    const confirmMessage = `¿Deseas cancelar tu reserva para "${reserva.clase.nombre_clase}"?\n\nAl cancelar con más de 2 horas de anticipación, tu crédito será reembolsado automáticamente a tu cuenta.`;

    if (!window.confirm(confirmMessage)) return;

    setCancellingId(reserva.id_reserva);
    try {
      if (!supabase) throw new Error("No hay cliente Supabase inicializado");

      const { data: { user } } = await supabase.auth.getUser();
      const studentId = reserva.id_usuario || user?.id;

      // 1. Marcar reserva como cancelada
      const { error: cancelError } = await supabase
        .from("reserva")
        .update({ estado_reserva: "cancelada" })
        .eq("id_reserva", reserva.id_reserva);

      if (cancelError) throw cancelError;

      // 2. Decrementar cupos_inscritos en la clase
      const currentEnrolled = reserva.clase.cupos_inscritos || 1;
      await supabase
        .from("clase")
        .update({ cupos_inscritos: Math.max(0, currentEnrolled - 1) })
        .eq("id_clase", reserva.clase.id_clase);

      // 3. Reembolsar 1 crédito a la suscripción activa del alumno
      let reembolsado = false;
      if (studentId) {
        const { data: sub } = await supabase
          .from("user_suscripciones")
          .select("id, creditos_restantes")
          .eq("user_id", studentId)
          .eq("estado", "activa")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (sub) {
          const { error: subUpdateError } = await supabase
            .from("user_suscripciones")
            .update({ 
              creditos_restantes: (sub.creditos_restantes || 0) + 1,
              updated_at: new Date().toISOString()
            })
            .eq("id", sub.id);

          if (!subUpdateError) {
            reembolsado = true;
            setCredits(prev => prev + 1);
          }
        }
      }

      // 4. Actualizar lista local de reservas
      setReservas(prev => prev.filter(r => r.id_reserva !== reserva.id_reserva));

      toast.success(
        reembolsado
          ? "Clase cancelada exitosamente. Se ha reembolsado 1 crédito a tu cuenta."
          : "Clase cancelada exitosamente. Tu cupo ha sido liberado."
      );
    } catch (err: any) {
      console.error("Error al cancelar reserva:", err);
      toast.error("Hubo un error al cancelar la clase. Intenta nuevamente.");
    } finally {
      setCancellingId(null);
    }
  };

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  
  const pasadas = reservas.filter(r => new Date(r.clase.fecha_hora_fin) < startOfToday).reverse();
  const hoy = reservas.filter(r => {
    const start = new Date(r.clase.fecha_hora_inicio);
    return start >= startOfToday && start <= endOfToday;
  });
  const futuras = reservas.filter(r => new Date(r.clase.fecha_hora_inicio) > endOfToday);
  
  let displayedReservas: any[] = [];
  if (activeTab === "pasadas") displayedReservas = pasadas;
  if (activeTab === "hoy") displayedReservas = hoy;
  if (activeTab === "futuras") displayedReservas = futuras;

  return (
    <div className="flex flex-col w-full pb-bottom-nav-safe">

      {/* Main Content */}
      <div className="flex flex-col px-margin-mobile gap-space-lg pt-space-sm">
        
        {/* Tu Ritmo Activo */}
        <section className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div className="flex flex-col">
            <span className="font-label-caps text-[11px] text-primary font-bold uppercase tracking-wider mb-1">TU RITMO ACTIVO</span>
            <h1 className="font-headline-md text-[24px] text-on-surface font-bold leading-none">{reservas.length} Clases Reservadas</h1>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3.5 py-2 bg-surface-container-high rounded-xl border border-primary/20">
              <span className="material-symbols-outlined text-primary text-[18px]">local_activity</span>
              <span className="font-label-md text-label-md text-on-surface font-bold">{credits} créditos</span>
            </div>
          </div>
        </section>

        {/* Tabs - Underline Style */}
        <section className="flex items-center border-b border-surface-container">
          <button 
            onClick={() => setActiveTab("pasadas")}
            className={`flex-1 flex items-center justify-center gap-1.5 pb-3 pt-2 font-label-md text-label-md transition-all border-b-2 ${
              activeTab === "pasadas" ? "border-primary text-primary font-bold" : "border-transparent text-on-surface-variant hover:text-on-surface"
            }`}
          >
            Pasadas <span className="text-[13px]">{pasadas.length}</span>
          </button>
          
          <button 
            onClick={() => setActiveTab("hoy")}
            className={`flex-1 flex items-center justify-center gap-1.5 pb-3 pt-2 font-label-md text-label-md transition-all border-b-2 ${
              activeTab === "hoy" ? "border-primary text-primary font-bold" : "border-transparent text-on-surface-variant hover:text-on-surface"
            }`}
          >
            Hoy <span className="text-[13px]">{hoy.length}</span>
          </button>

          <button 
            onClick={() => setActiveTab("futuras")}
            className={`flex-1 flex items-center justify-center gap-1.5 pb-3 pt-2 font-label-md text-label-md transition-all border-b-2 ${
              activeTab === "futuras" ? "border-primary text-primary font-bold" : "border-transparent text-on-surface-variant hover:text-on-surface"
            }`}
          >
            Futuras <span className="text-[13px]">{futuras.length}</span>
          </button>
        </section>

        {/* Cancelación Consciente Policy */}
        <section className="flex items-start gap-3 bg-surface-container-lowest p-space-md rounded-2xl border border-surface-container shadow-sm">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary flex-shrink-0 mt-0.5">
            <span className="material-symbols-outlined text-[18px]">rule</span>
          </div>
          <div className="flex flex-col">
            <span className="font-label-md text-label-md text-on-surface font-bold">Cancelación Consciente <span className="text-primary">•</span></span>
            <p className="font-body-sm text-[13px] text-on-surface-variant leading-relaxed mt-1">
              Recuerda: Las cancelaciones se permiten hasta con un mínimo de <strong className="text-on-surface">2 horas de anticipación</strong>. Al cancelar a tiempo, tu crédito se reembolsa automáticamente a tu cuenta.
            </p>
          </div>
        </section>

        {/* Classes List */}
        <div className="flex flex-col gap-space-md pb-space-xl">
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <span className="material-symbols-outlined animate-spin text-primary text-3xl">refresh</span>
            </div>
          ) : displayedReservas.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 bg-surface-container-low rounded-2xl border border-surface-container mt-4 text-center">
              <span className="material-symbols-outlined text-secondary text-4xl mb-3">calendar_month</span>
              <h3 className="font-headline-sm text-on-surface">No hay clases en esta sección</h3>
            </div>
          ) : displayedReservas.map((cls) => {
            const startDate = new Date(cls.clase.fecha_hora_inicio);
            const endDate = new Date(cls.clase.fecha_hora_fin);
            const durationMs = endDate.getTime() - startDate.getTime();
            const durationMins = Math.round(durationMs / 60000);
            
            const isToday = startDate.toDateString() === now.toDateString();
            const isPresente = cls.estado_reserva === "presente";
            
            const days = ["DOMINGO", "LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO"];
            const months = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
            const dateStr = isToday ? "HOY" : `${days[startDate.getDay()]} ${startDate.getDate()} ${months[startDate.getMonth()]}`;
            
            let h = startDate.getHours();
            const m = startDate.getMinutes().toString().padStart(2, '0');
            h = h % 12;
            h = h ? h : 12; 
            const timeStr = `${h}:${m}`;
            
            let profName = "Profesor";
            if (cls.clase.profiles) {
               profName = Array.isArray(cls.clase.profiles) ? cls.clase.profiles[0]?.name : cls.clase.profiles.name;
            }

            return (
              <article key={cls.id_reserva} className="flex flex-col bg-surface-container-lowest rounded-2xl border border-surface-container overflow-hidden shadow-md">
                {/* Header info */}
                <div className="flex items-center justify-between p-space-md border-b border-surface-container/50">
                  <div className="flex items-center gap-2">
                    <span className={`font-label-caps text-[11px] font-bold tracking-widest uppercase ${isToday ? 'text-primary' : 'text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full'}`}>
                      {isToday && <span className="inline-block w-2 h-2 rounded-full bg-primary animate-pulse mr-1.5 align-middle"></span>}
                      {dateStr}
                    </span>
                    <span className="font-headline-sm text-headline-sm text-on-surface">{timeStr} hrs</span>
                    <span className="font-body-sm text-[12px] text-on-surface-variant ml-1">- {durationMins} min</span>
                  </div>

                  {isPresente ? (
                    <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-500 rounded-full font-label-md text-[11px] font-bold border border-emerald-500/20 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      Presente
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 bg-surface-container rounded-full font-label-md text-[11px] text-on-surface font-medium border border-surface-container-high">
                      Confirmada
                    </span>
                  )}
                </div>

                {/* Class info */}
                <div className="flex gap-space-md p-space-md">
                  <div className="w-14 h-14 rounded-xl bg-surface-container-high flex-shrink-0 border border-surface-container overflow-hidden flex items-center justify-center text-primary font-bold text-lg">
                    CA
                  </div>
                  <div className="flex flex-col justify-center">
                    <h3 className="font-headline-sm text-[18px] text-on-surface font-bold mb-1 leading-tight">{cls.clase.nombre_clase}</h3>
                    <div className="flex items-center gap-1.5 text-on-surface-variant">
                      <span className="material-symbols-outlined text-[16px]">person</span>
                      <span className="font-body-sm text-[13px]">{profName} <span className="mx-1">•</span> {cls.clase.sala || "Sala Principal"}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                {(isToday || activeTab === 'futuras') && (
                  <div className="flex gap-2.5 p-space-md pt-0">
                    {isPresente ? (
                      <div className="flex-1 h-14 bg-emerald-500/10 border border-emerald-500/20 rounded-xl font-label-lg font-bold flex items-center justify-center gap-2 text-emerald-500">
                        <span className="material-symbols-outlined text-[20px]">check_circle</span>
                        Asistencia Confirmada
                      </div>
                    ) : (() => {
                      const classStartTime = new Date(cls.clase.fecha_hora_inicio);
                      const hoursDifference = (classStartTime.getTime() - Date.now()) / (1000 * 60 * 60);
                      const canCancel = hoursDifference >= 2;

                      return (
                        <>
                          <button 
                            onClick={() => setSelectedReserva(cls)}
                            className="flex-1 h-14 bg-primary text-on-primary rounded-xl font-label-lg font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-md shadow-primary/20"
                          >
                            <span className="material-symbols-outlined text-[20px]">qr_code_2</span>
                            {isToday ? "Mi Pase QR" : "Ver Pase QR"}
                          </button>

                          <button 
                            onClick={() => {
                              if (!canCancel) {
                                toast.error("No es posible cancelar: faltan menos de 2 horas para el inicio de la clase.");
                                return;
                              }
                              handleCancelarReserva(cls);
                            }}
                            disabled={cancellingId === cls.id_reserva || !canCancel}
                            title={!canCancel ? "Solo se puede cancelar hasta 2 horas antes de la clase" : "Cancelar reserva y recuperar crédito"}
                            className={`h-14 px-4 rounded-xl font-label-lg font-bold flex items-center justify-center gap-1.5 transition-all ${
                              canCancel 
                                ? "bg-surface-container-high hover:bg-rose-500/10 text-rose-500 dark:text-rose-400 border border-rose-500/20 hover:border-rose-500/40 active:scale-95" 
                                : "bg-surface-container text-on-surface-variant/40 border border-surface-container cursor-not-allowed"
                            }`}
                          >
                            {cancellingId === cls.id_reserva ? (
                              <span className="material-symbols-outlined animate-spin text-[18px]">refresh</span>
                            ) : (
                              <span className="material-symbols-outlined text-[18px]">
                                {canCancel ? "close" : "lock_clock"}
                              </span>
                            )}
                            <span>{canCancel ? "Cancelar" : "Bloqueado (<2h)"}</span>
                          </button>
                        </>
                      );
                    })()}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </div>

      {/* Modal Pase de Entrada QR (El alumno muestra su código al profesor) */}
      {selectedReserva && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-surface-container-lowest p-6 rounded-3xl max-w-sm w-full text-center shadow-2xl border border-surface-container flex flex-col items-center">
            
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-2">
              <span className="material-symbols-outlined text-[26px]">qr_code_2</span>
            </div>

            <h2 className="font-headline-sm text-xl text-on-surface font-bold">Pase de Ingreso</h2>
            <p className="font-body-sm text-xs text-secondary mt-0.5 mb-1 font-semibold">
              {selectedReserva.clase.nombre_clase}
            </p>
            <p className="font-body-sm text-xs text-on-surface-variant mb-4">
              Muestra este código al profesor para que registre tu asistencia a la sala.
            </p>

            <div className="p-4 bg-white rounded-2xl border border-surface-container shadow-md flex justify-center items-center">
              <QRCodeSVG 
                value={crearPaseAlumno(selectedReserva.id_reserva, selectedReserva.clase.id_clase)}
                size={210} 
                level="H" 
                includeMargin={true} 
              />
            </div>

            <div className="mt-3 text-[11px] text-on-surface-variant font-mono bg-surface-container-high/40 px-3 py-1 rounded-full">
              Reserva #{selectedReserva.id_reserva} • {selectedReserva.clase.sala || "Sala Principal"}
            </div>

            <button
              onClick={() => setSelectedReserva(null)}
              className="mt-5 w-full py-3.5 bg-surface-container-high text-on-surface font-label-lg font-bold rounded-xl hover:bg-surface-container-highest active:scale-95 transition-all text-sm"
            >
              Cerrar Pase
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
