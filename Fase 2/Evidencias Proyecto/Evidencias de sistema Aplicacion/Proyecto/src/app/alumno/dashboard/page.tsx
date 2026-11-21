"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function AlumnoDashboard() {
  const [programs, setPrograms] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userName, setUserName] = useState<string>("Bailarín/a");

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

  useEffect(() => {
    async function fetchClasses() {
      try {
        if (!supabase) throw new Error("Supabase client is null");
        
        // Fetch class types first
        const { data: typesData, error: typesError } = await supabase
          .from("tipos_clase")
          .select("*")
          .order("created_at", { ascending: true });
          
        if (typesError) throw typesError;

        // Fetch templates
        const { data, error } = await supabase
          .from("plantillas_clase")
          .select("*")
          .order("dia_semana", { ascending: true })
          .order("hora_inicio", { ascending: true });

        if (error) throw error;

        // Group by tipo_clase_id
        if (typesData && data) {
          const daysOrder = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
          
          const grouped = typesData.map((type: any) => {
            const templates = data.filter((t: any) => t.tipo_clase_id === type.id);
            
            // Map schedules for all days
            const schedules = daysOrder.map((dayName) => {
              const dayTemplates = templates.filter((t: any) => t.dia_semana === dayName);
              const times = dayTemplates.map((t: any) => {
                // Formatting "18:00:00" to "18:00"
                return t.hora_inicio ? t.hora_inicio.substring(0, 5) : "";
              }).filter(Boolean);

              return {
                day: dayName.substring(0, 3).toUpperCase(),
                fullDay: dayName,
                times: times
              };
            });

            return {
              id: type.id,
              name: type.nombre,
              description: templates[0]?.descripcion || "Programa enfocado en técnica, fuerza y expresión.",
              icon: type.icono || "fitness_center",
              schedules
            };
          });

          // Only keep programs that actually have classes configured
          const activePrograms = grouped.filter(g => g.schedules.some(s => s.times.length > 0));
          setPrograms(activePrograms.length > 0 ? activePrograms : grouped);
        }
      } catch (err) {
        console.error("Error fetching programs and classes:", err);
        // Fallback mock for UI demo if tables are not seeded
        setPrograms([
          {
            id: "pole",
            name: "Pole Dance & Sport",
            description: "Acondicionamiento físico, figuras estáticas y giros dinámicos en barra.",
            icon: "fitness_center",
            schedules: [
              { day: "LUN", times: ["18:30", "19:45"] },
              { day: "MAR", times: [] },
              { day: "MIÉ", times: ["18:30", "19:45"] },
              { day: "JUE", times: [] },
              { day: "VIE", times: ["17:30", "19:00"] },
              { day: "SÁB", times: ["11:00"] },
              { day: "DOM", times: [] },
            ]
          },
          {
            id: "twerk",
            name: "Twerk & Dancehall",
            description: "Técnica de disociación pélvica, musicalidad y coreografías de alta energía.",
            icon: "music_note",
            schedules: [
              { day: "LUN", times: [] },
              { day: "MAR", times: ["19:00", "20:15"] },
              { day: "MIÉ", times: [] },
              { day: "JUE", times: ["19:00", "20:15"] },
              { day: "VIE", times: [] },
              { day: "SÁB", times: ["12:15"] },
              { day: "DOM", times: [] },
            ]
          },
          {
            id: "heels",
            name: "Exotic Heels",
            description: "Fluidez, líneas corporales y trabajo en tacos con foco en técnica y sensualidad.",
            icon: "styler",
            schedules: [
              { day: "LUN", times: [] },
              { day: "MAR", times: [] },
              { day: "MIÉ", times: ["20:00"] },
              { day: "JUE", times: [] },
              { day: "VIE", times: ["20:15"] },
              { day: "SÁB", times: [] },
              { day: "DOM", times: [] },
            ]
          },
          {
            id: "flex",
            name: "Flexibilidad & Split",
            description: "Apertura de caderas, hombros y elongación profunda para complementar tu entrenamiento.",
            icon: "self_improvement",
            schedules: [
              { day: "LUN", times: ["17:15"] },
              { day: "MAR", times: ["18:00"] },
              { day: "MIÉ", times: ["17:15"] },
              { day: "JUE", times: ["18:00"] },
              { day: "VIE", times: [] },
              { day: "SÁB", times: [] },
              { day: "DOM", times: [] },
            ]
          }
        ]);
      } finally {
        setIsLoading(false);
      }
    }

    fetchClasses();
  }, []);

  return (
    <div className="flex flex-col w-full pb-bottom-nav-safe">
      <div className="flex flex-col px-margin-mobile gap-space-lg pt-space-sm">
        
        {/* Banner de Bienvenida y Acceso Rápido Asistencia QR */}
        <section className="bg-gradient-to-br from-surface-container-low via-surface-container-lowest to-surface-container-low p-5 rounded-3xl border border-primary/20 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-col">
            <span className="font-label-caps text-[11px] text-primary font-bold uppercase tracking-wider">¡Hola, {userName}! ✨</span>
            <h2 className="font-headline-sm text-xl text-on-surface font-bold mt-0.5">Pase de Asistencia QR</h2>
            <p className="font-body-sm text-xs text-secondary mt-1">
              Al llegar al estudio, muestra tu Pase QR desde <strong className="text-on-surface">Mis Clases</strong> para que tu profesor registre tu llegada.
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

        <div className="flex items-center gap-2 mb-1">
          <span className="material-symbols-outlined text-primary text-[28px]">library_books</span>
          <h1 className="font-headline-md text-[24px] text-on-surface font-bold">Nuestros programas</h1>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <span className="material-symbols-outlined animate-spin text-primary text-3xl">refresh</span>
          </div>
        ) : programs.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 bg-surface-container-low rounded-2xl border border-surface-container mt-4 text-center">
            <span className="material-symbols-outlined text-secondary text-4xl mb-3">inventory_2</span>
            <h3 className="font-headline-sm text-on-surface">No hay programas disponibles</h3>
            <p className="font-body-sm text-on-surface-variant mt-2">Próximamente se publicarán nuevas disciplinas.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-space-lg">
            {programs.map((program) => (
              <article key={program.id} className="flex flex-col bg-surface-container-lowest rounded-2xl border border-surface-container shadow-sm overflow-hidden">
                <div className="flex items-center justify-between gap-2 p-space-md border-b border-surface-container/50">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                      <span className="material-symbols-outlined text-[20px]">{program.icon}</span>
                    </div>
                    <div className="min-w-0">
                      <h2 className="font-headline-sm text-headline-sm text-on-surface truncate">{program.name}</h2>
                      <p className="font-body-sm text-body-sm text-secondary truncate">{program.description}</p>
                    </div>
                  </div>
                  <Link 
                    href="/alumno/explorar" 
                    className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-primary font-label-md text-label-md font-bold transition-colors"
                  >
                    Ver cupos
                  </Link>
                </div>

                {/* Schedule horizontally scrollable or grid */}
                <div className="p-space-md bg-surface-container-low/30 overflow-x-auto">
                  <div className="grid grid-cols-7 gap-1.5 min-w-[500px]">
                    {program.schedules.map((schedule: any) => (
                      <div key={schedule.day} className="flex flex-col items-center p-2 rounded-xl bg-surface-container-lowest border border-surface-container/60 shadow-2xs">
                        <span className="font-label-caps text-label-caps text-secondary mb-1.5 font-bold">
                          {schedule.day}
                        </span>
                        <div className="flex flex-col gap-1 w-full">
                          {schedule.times && schedule.times.length > 0 ? (
                            schedule.times.map((time: string) => {
                              return (
                                <Link
                                  key={time}
                                  href="/alumno/explorar"
                                  className="w-full py-1 text-center rounded-md font-label-caps text-label-caps transition-colors bg-primary/10 text-primary hover:bg-primary hover:text-on-primary font-semibold"
                                >
                                  {time}
                                </Link>
                              );
                            })
                          ) : (
                            <div className="flex items-center justify-center py-2 text-transparent select-none">
                              -
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
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
