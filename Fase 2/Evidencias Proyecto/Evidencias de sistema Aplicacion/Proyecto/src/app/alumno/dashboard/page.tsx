"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

interface ScheduleDay {
  day: string;
  dayNumber: number;
  fullDate: Date;
  times: string[];
  timeDetails: {
    time: string;
    disponibles: number;
    sala: string | null;
    id_clase: number;
    isPast: boolean;
  }[];
}

interface ProgramCard {
  id: string;
  name: string;
  description: string;
  icon: string;
  totalClasses: number;
  cuposDisponibles: number;
  profesores: string[];
  schedules: ScheduleDay[];
}

const DAYS_META = [
  { dayKey: 1, label: "LUN", name: "Lunes" },
  { dayKey: 2, label: "MAR", name: "Martes" },
  { dayKey: 3, label: "MIÉ", name: "Miércoles" },
  { dayKey: 4, label: "JUE", name: "Jueves" },
  { dayKey: 5, label: "VIE", name: "Viernes" },
  { dayKey: 6, label: "SÁB", name: "Sábado" },
  { dayKey: 0, label: "DOM", name: "Domingo" },
];

function getProgramMetadata(name: string, typesData: any[] = []) {
  const normalized = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const matchType = typesData.find(t =>
    normalized.includes(t.nombre?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") || "")
  );

  if (matchType?.icono) {
    return {
      icon: matchType.icono,
      description: matchType.descripcion || `Programa de ${name} con profesores certificados.`
    };
  }

  if (normalized.includes("exotic")) {
    return {
      icon: "styler",
      description: "Fluidez, trabajo coreográfico en barra y líneas con enfoque técnico y sensual."
    };
  }
  if (normalized.includes("flex")) {
    return {
      icon: "self_improvement",
      description: "Apertura de caderas, hombros y elongación profunda para tu entrenamiento."
    };
  }
  if (normalized.includes("twerk") || normalized.includes("dancehall") || normalized.includes("urbano")) {
    return {
      icon: "music_note",
      description: "Técnica de movimiento, disociación pélvica y coreografías de alta energía."
    };
  }
  if (normalized.includes("pole")) {
    return {
      icon: "fitness_center",
      description: "Acondicionamiento físico, figuras estáticas, trepadas y giros dinámicos en barra."
    };
  }

  return {
    icon: "sports_gymnastics",
    description: "Entrenamiento guiado enfocado en técnica, fuerza, flexibilidad y expresión corporal."
  };
}

export default function AlumnoDashboard() {
  const [programs, setPrograms] = useState<ProgramCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [userName, setUserName] = useState<string>("Bailarín/a");
  const [weekOffset, setWeekOffset] = useState<number>(0);

  useEffect(() => {
    async function fetchUserProfile() {
      if (!supabase) return;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase.from("profiles").select("name").eq("id", user.id).maybeSingle();
          if (profile?.name) setUserName(profile.name);
        }
      } catch (err) {
        console.error("Error fetching user profile:", err);
      }
    }
    fetchUserProfile();
  }, []);

  // Calcular fechas de la semana actual según el weekOffset
  const getWeekRange = useCallback((offset: number) => {
    const today = new Date();
    // Lunes de la semana
    const monday = new Date(today);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7 + (offset * 7));

    // Próximo lunes (fin del domingo)
    const nextMonday = new Date(monday);
    nextMonday.setDate(monday.getDate() + 7);
    nextMonday.setHours(0, 0, 0, 0);

    // Domingo de la semana
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    return { monday, nextMonday, sunday };
  }, []);

  const fetchClassesAndPrograms = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      if (!supabase) throw new Error("Supabase client is null");

      const { monday, nextMonday } = getWeekRange(weekOffset);

      // 1. Filtrar ÚNICAMENTE las clases correspondientes a la semana seleccionada
      // Evita mostrar clases antiguas de meses pasados o fuera de esta semana
      const { data: clasesData, error: clasesError } = await supabase
        .from("clase")
        .select(`
          id_clase,
          nombre_clase,
          fecha_hora_inicio,
          fecha_hora_fin,
          cupo_maximo,
          cupos_inscritos,
          sala,
          estado_clase,
          profiles:id_profesor (name)
        `)
        .in("estado_clase", ["programada", "en_curso"])
        .gte("fecha_hora_inicio", monday.toISOString())
        .lt("fecha_hora_inicio", nextMonday.toISOString())
        .order("fecha_hora_inicio", { ascending: true });

      if (clasesError) throw clasesError;

      // 2. Obtener tipos de clase para iconos/metadatos adicionales
      let tiposList: any[] = [];
      try {
        const { data: typesData } = await supabase
          .from("tipos_clase")
          .select("*");
        tiposList = typesData || [];
      } catch {
        tiposList = [];
      }

      const rawClases = clasesData || [];
      const now = new Date();

      // 3. Agrupar por disciplina/programa que tenga clases en esta semana
      const programsMap = new Map<string, {
        name: string;
        clases: any[];
        totalCuposDisponibles: number;
        profesores: Set<string>;
      }>();

      rawClases.forEach((c: any) => {
        const rawName = c.nombre_clase?.trim() || "Clase Especial";
        if (!programsMap.has(rawName)) {
          programsMap.set(rawName, {
            name: rawName,
            clases: [],
            totalCuposDisponibles: 0,
            profesores: new Set()
          });
        }
        const prog = programsMap.get(rawName)!;
        prog.clases.push(c);
        const max = c.cupo_maximo || 8;
        const ins = c.cupos_inscritos || 0;
        prog.totalCuposDisponibles += Math.max(0, max - ins);
        const profName = Array.isArray(c.profiles) ? c.profiles[0]?.name : c.profiles?.name;
        if (profName) prog.profesores.add(profName);
      });

      // 4. Construir la grilla semanal (Lunes a Domingo) para la semana exacta
      const groupedPrograms: ProgramCard[] = Array.from(programsMap.values()).map(prog => {
        const meta = getProgramMetadata(prog.name, tiposList);

        const schedules: ScheduleDay[] = DAYS_META.map((dayMeta, index) => {
          // Fecha exacta del día de la semana
          const dayDate = new Date(monday);
          dayDate.setDate(monday.getDate() + index);

          // Filtrar clases de este día exacto
          const dayClasses = prog.clases.filter((c: any) => {
            const classDate = new Date(c.fecha_hora_inicio);
            return (
              classDate.getFullYear() === dayDate.getFullYear() &&
              classDate.getMonth() === dayDate.getMonth() &&
              classDate.getDate() === dayDate.getDate()
            );
          });

          // Extraer horas de las clases de ese día
          const timesMap = new Map<string, {
            time: string;
            disponibles: number;
            sala: string | null;
            id_clase: number;
            isPast: boolean;
          }>();

          dayClasses.forEach((c: any) => {
            const d = new Date(c.fecha_hora_inicio);
            const timeStr = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
            const max = c.cupo_maximo || 8;
            const ins = c.cupos_inscritos || 0;
            const disponibles = Math.max(0, max - ins);
            const isPast = new Date(c.fecha_hora_fin) < now;

            if (!timesMap.has(timeStr)) {
              timesMap.set(timeStr, {
                time: timeStr,
                disponibles,
                sala: c.sala,
                id_clase: c.id_clase,
                isPast
              });
            } else {
              const current = timesMap.get(timeStr)!;
              current.disponibles = Math.max(current.disponibles, disponibles);
            }
          });

          const timeDetails = Array.from(timesMap.values()).sort((a, b) => a.time.localeCompare(b.time));

          return {
            day: dayMeta.label,
            dayNumber: dayDate.getDate(),
            fullDate: dayDate,
            times: timeDetails.map(t => t.time),
            timeDetails
          };
        });

        return {
          id: prog.name.toLowerCase().replace(/\s+/g, "-"),
          name: prog.name,
          description: meta.description,
          icon: meta.icon,
          totalClasses: prog.clases.length,
          cuposDisponibles: prog.totalCuposDisponibles,
          profesores: Array.from(prog.profesores),
          schedules
        };
      });

      setPrograms(groupedPrograms);
    } catch (err) {
      console.error("Error al cargar programas y clases de la semana:", err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [weekOffset, getWeekRange]);

  useEffect(() => {
    fetchClassesAndPrograms();

    const handleFocus = () => {
      fetchClassesAndPrograms(true);
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [fetchClassesAndPrograms]);

  const { monday, sunday } = getWeekRange(weekOffset);
  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const weekLabel = `${monday.getDate()} al ${sunday.getDate()} de ${monthNames[sunday.getMonth()]} ${sunday.getFullYear()}`;
  const isCurrentWeek = weekOffset === 0;

  const todayDate = new Date();
  const isToday = (date: Date) => {
    return (
      date.getDate() === todayDate.getDate() &&
      date.getMonth() === todayDate.getMonth() &&
      date.getFullYear() === todayDate.getFullYear()
    );
  };

  return (
    <div className="flex flex-col w-full pb-bottom-nav-safe">
      <div className="flex flex-col px-margin-mobile gap-space-lg pt-space-sm">
        
        {/* Banner de Bienvenida y Acceso Rápido Asistencia QR */}
        <section className="bg-gradient-to-br from-surface-container-low via-surface-container-lowest to-surface-container-low p-5 rounded-3xl border border-primary/20 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-col">
            <span className="font-label-caps text-[11px] text-primary font-bold uppercase tracking-wider">¡Hola, {userName}! ✨</span>
            <h2 className="font-headline-sm text-xl text-on-surface font-bold mt-0.5">Pase de Asistencia QR</h2>
            <p className="font-body-sm text-xs text-secondary mt-1">
              Al llegar al estudio, muestra tu Pase QR desde <strong className="text-on-surface">Mis Clases</strong> para registrar tu asistencia.
            </p>
          </div>
          <Link 
            href="/alumno/mis-clases"
            className="h-12 px-5 rounded-2xl bg-primary text-on-primary font-label-md font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-md shadow-primary/20 shrink-0"
          >
            <span className="material-symbols-outlined text-[22px]">qr_code_2</span>
            Ver Mi Pase QR
          </Link>
        </section>

        {/* Encabezado Nuestros Programas y Selector de Semana */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-1">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[24px]">calendar_month</span>
            </div>
            <div>
              <h1 className="font-headline-md text-[22px] text-on-surface font-bold">Nuestros programas</h1>
              <p className="font-body-sm text-xs text-secondary">
                Semana del {weekLabel}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <div className="flex items-center bg-surface-container rounded-xl p-1 border border-surface-container-high/40">
              <button
                onClick={() => setWeekOffset(prev => prev - 1)}
                title="Semana anterior"
                className="w-8 h-8 rounded-lg hover:bg-surface-container-high flex items-center justify-center text-on-surface transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">chevron_left</span>
              </button>

              <button
                onClick={() => setWeekOffset(0)}
                className={`px-2.5 h-8 rounded-lg text-xs font-bold transition-all ${
                  isCurrentWeek 
                    ? 'bg-primary text-on-primary shadow-2xs' 
                    : 'text-secondary hover:text-on-surface'
                }`}
              >
                Esta semana
              </button>

              <button
                onClick={() => setWeekOffset(prev => prev + 1)}
                title="Semana siguiente"
                className="w-8 h-8 rounded-lg hover:bg-surface-container-high flex items-center justify-center text-on-surface transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">chevron_right</span>
              </button>
            </div>

            <button
              onClick={() => fetchClassesAndPrograms(true)}
              disabled={isRefreshing}
              title="Actualizar clases"
              className="p-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-secondary hover:text-primary transition-all active:scale-95 flex items-center justify-center shrink-0 h-10 w-10"
            >
              <span className={`material-symbols-outlined text-[20px] ${isRefreshing ? 'animate-spin text-primary' : ''}`}>
                refresh
              </span>
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col justify-center items-center py-16 gap-3">
            <span className="material-symbols-outlined animate-spin text-primary text-4xl">refresh</span>
            <span className="text-xs text-secondary font-medium">Cargando clases de la semana...</span>
          </div>
        ) : programs.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 bg-surface-container-low rounded-2xl border border-surface-container mt-2 text-center">
            <span className="material-symbols-outlined text-secondary text-4xl mb-3">event_busy</span>
            <h3 className="font-headline-sm text-on-surface font-bold">No hay clases programadas para esta semana</h3>
            <p className="font-body-sm text-on-surface-variant text-xs mt-1 max-w-sm">
              No se han encontrado clases entre el {weekLabel}. Puedes consultar semanas siguientes o ir directamente a Explorar Clases.
            </p>
            <div className="flex items-center gap-2 mt-4">
              <button
                onClick={() => setWeekOffset(prev => prev + 1)}
                className="px-4 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md font-bold text-xs transition-colors"
              >
                Ver semana siguiente
              </button>
              <Link 
                href="/alumno/explorar" 
                className="px-4 py-2 rounded-xl bg-primary text-on-primary font-label-md font-bold text-xs"
              >
                Explorar Clases
              </Link>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-space-lg">
            {programs.map((program) => (
              <article key={program.id} className="flex flex-col bg-surface-container-lowest rounded-2xl border border-surface-container shadow-sm overflow-hidden">
                <div className="flex items-center justify-between gap-3 p-space-md border-b border-surface-container/50">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 shadow-2xs">
                      <span className="material-symbols-outlined text-[22px]">{program.icon}</span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="font-headline-sm text-base text-on-surface font-bold truncate">{program.name}</h2>
                        {program.cuposDisponibles > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                            {program.cuposDisponibles} cupos esta semana
                          </span>
                        )}
                      </div>
                      <p className="font-body-sm text-xs text-secondary truncate mt-0.5">{program.description}</p>
                      {program.profesores.length > 0 && (
                        <p className="text-[11px] text-primary/80 font-medium truncate mt-0.5">
                          Prof: {program.profesores.join(", ")}
                        </p>
                      )}
                    </div>
                  </div>
                  <Link 
                    href={`/alumno/explorar?search=${encodeURIComponent(program.name)}`} 
                    className="flex-shrink-0 px-3.5 py-2 rounded-xl bg-primary/10 hover:bg-primary text-primary hover:text-on-primary font-label-md text-xs font-bold transition-all shadow-2xs active:scale-95"
                  >
                    Ver cupos
                  </Link>
                </div>

                {/* Grilla Semanal: LUN a DOM de la semana exacta */}
                <div className="p-space-md bg-surface-container-low/30 overflow-x-auto">
                  <div className="grid grid-cols-7 gap-1.5 min-w-[540px]">
                    {program.schedules.map((schedule) => {
                      const todayCheck = isToday(schedule.fullDate);
                      return (
                        <div 
                          key={schedule.day} 
                          className={`flex flex-col items-center p-2 rounded-xl border shadow-2xs transition-all ${
                            todayCheck
                              ? 'bg-primary/5 border-primary ring-1 ring-primary/40'
                              : schedule.times.length > 0 
                                ? 'bg-surface-container-lowest border-surface-container/80' 
                                : 'bg-surface-container-lowest/50 border-surface-container/30 opacity-70'
                          }`}
                        >
                          <div className="flex flex-col items-center mb-1.5">
                            <span className={`font-label-caps text-[10px] font-bold ${todayCheck ? 'text-primary' : 'text-secondary'}`}>
                              {schedule.day}
                            </span>
                            <span className={`text-[12px] font-bold leading-tight ${todayCheck ? 'text-primary' : 'text-on-surface'}`}>
                              {schedule.dayNumber}
                            </span>
                          </div>

                          <div className="flex flex-col gap-1.5 w-full">
                            {schedule.timeDetails && schedule.timeDetails.length > 0 ? (
                              schedule.timeDetails.map((td) => {
                                return (
                                  <Link
                                    key={td.time}
                                    href={`/alumno/explorar?search=${encodeURIComponent(program.name)}`}
                                    title={`${program.name} a las ${td.time} (${td.disponibles} cupos disponibles)`}
                                    className={`w-full py-1.5 px-1 text-center rounded-lg font-label-caps text-[11px] transition-all flex flex-col items-center justify-center ${
                                      td.isPast
                                        ? 'bg-surface-container text-on-surface-variant line-through opacity-50'
                                        : td.disponibles > 0
                                          ? 'bg-primary/10 text-primary hover:bg-primary hover:text-on-primary font-bold shadow-2xs active:scale-95'
                                          : 'bg-rose-500/10 text-rose-600 font-semibold'
                                    }`}
                                  >
                                    <span>{td.time}</span>
                                    <span className="text-[9px] font-normal leading-none opacity-85 mt-0.5">
                                      {td.isPast ? 'Pasada' : td.disponibles > 0 ? `${td.disponibles} c.` : 'Lleno'}
                                    </span>
                                  </Link>
                                );
                              })
                            ) : (
                              <div className="flex items-center justify-center py-3 text-secondary/40 select-none text-xs">
                                -
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
