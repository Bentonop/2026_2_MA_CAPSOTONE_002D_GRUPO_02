"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { identidadDocente, nombreDocenteRegistrado } from "@/lib/identidadDocente";
import { supabase } from "@/lib/supabase";
import toast from "react-hot-toast";

export default function PerfilProfesorPage() {
  const [profile, setProfile] = useState<any>(null);
  const [clases, setClases] = useState<any[]>([]);
  const [monthlyClassCount, setMonthlyClassCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    last_name: "",
    bio: "",
    especialidad: ""
  });

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      if (!supabase) return;
      // Get authenticated user
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;

      const { data: user } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", authUser.id)
        .single();
        
      if (user) {
        const docente = { ...user, correo: user.correo || authUser.email };
        setProfile(docente);
        setFormData({
          name: nombreDocenteRegistrado(docente),
          last_name: docente.last_name ?? "",
          bio: user.bio || "",
          especialidad: user.especialidad || ""
        });

        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const { count, error: countError } = await supabase
          .from("clase")
          .select("id_clase", { count: "exact", head: true })
          .eq("id_profesor", user.id)
          .neq("estado_clase", "cancelada")
          .gte("fecha_hora_inicio", monthStart.toISOString())
          .lt("fecha_hora_inicio", nextMonth.toISOString());
        if (!countError) setMonthlyClassCount(count);

        // Fetch their classes
        const { data: susClases } = await supabase
          .from("clase")
          .select("*")
          .eq("id_profesor", user.id)
          .gte("fecha_hora_inicio", new Date().toISOString())
          .order("fecha_hora_inicio", { ascending: true });
          
        if (susClases) setClases(susClases);
      }
    } catch (err) {
      console.error("Error fetching", err);
    } finally {
      setIsLoading(false);
    }
  }

  const handleSave = async () => {
    if (!profile) return;
    const updates = { ...formData, name: formData.name.trim(), last_name: formData.last_name.trim() };
    if (!nombreDocenteRegistrado({ ...updates, correo: profile.correo }) || !updates.last_name) {
      toast.error("Ingresa tu nombre y apellido.");
      return;
    }
    setIsSaving(true);
    try {
      const { error } = await supabase!
        .from("profiles")
        .update(updates)
        .eq("id", profile.id);
        
      if (error) throw error;
      setProfile({ ...profile, ...updates });
      setIsEditing(false);
      toast.success("Perfil docente actualizado con éxito");
    } catch (err) {
      console.error("Error saving", err);
      toast.error("Error al guardar perfil");
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  const [eliminandoCuenta, setEliminandoCuenta] = useState(false);

  const handleDeleteAccount = async () => {
    if (eliminandoCuenta || !window.confirm("¿Eliminar tu cuenta? Se eliminarán tu perfil y tus datos operativos. Los respaldos contables se conservan con acceso restringido. Esta acción es irreversible.")) return;
    setEliminandoCuenta(true);
    try {
      const { error } = await supabase.rpc("eliminar_mi_cuenta");
      if (error) throw error;
      await supabase.auth.signOut({ scope: "local" });
      window.location.replace("/");
    } catch (error) {
      console.error("No se pudo eliminar la cuenta:", error);
      toast.error("No se pudo eliminar tu cuenta. Contacta a administración si el problema continúa.");
      setEliminandoCuenta(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
        <p className="font-label-md text-primary animate-pulse">Cargando tu perfil...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="bg-surface-container-low p-8 rounded-3xl text-center flex flex-col items-center gap-4 border border-surface-container">
          <span className="material-symbols-outlined text-5xl text-secondary">person_off</span>
          <h2 className="font-headline-sm text-on-surface">Perfil no encontrado</h2>
          <p className="font-body-md text-on-surface-variant">No pudimos cargar tus datos de docente.</p>
        </div>
      </div>
    );
  }

  const identidad = identidadDocente(profile);

  return (
    <div className="flex-1 flex flex-col w-full min-h-screen bg-background animate-in fade-in duration-500 pb-20">
      
      {/* Header Premium con Gradiente y Glassmorphism */}
      <div className="relative h-48 sm:h-64 w-full overflow-hidden">
         {/* Fondo animado */}
         <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary-container to-tertiary-container opacity-90"></div>
         <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] mix-blend-overlay opacity-30"></div>
         <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-white/20 rounded-full blur-3xl"></div>
         <div className="absolute top-[-50px] left-[-50px] w-48 h-48 bg-primary/40 rounded-full blur-2xl"></div>
         
         {/* Botón de configuración flotante */}
         <button
           type="button"
           onClick={() => setIsEditing((prev) => !prev)}
           aria-label={isEditing ? "Cerrar edición de perfil" : "Editar perfil"}
           title={isEditing ? "Cerrar edición" : "Editar perfil"}
           className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/20 backdrop-blur-md text-white flex items-center justify-center hover:bg-black/30 transition-all active:scale-95 border border-white/10 shadow-lg"
         >
            <span className="material-symbols-outlined text-[20px]">settings</span>
         </button>
      </div>

      <div className="px-gutter-mobile -mt-16 sm:-mt-20 relative z-10">
        <div className="flex flex-col gap-6">
          
          {/* Tarjeta Principal de Identidad */}
          <div className="bg-surface-container-lowest rounded-3xl p-6 sm:p-8 shadow-xl shadow-black/5 border border-surface-container flex flex-col relative overflow-hidden">
             
             {/* Círculos decorativos en la tarjeta */}
             <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full pointer-events-none"></div>
             
             <div className="flex flex-col sm:flex-row sm:items-end gap-5">
                <div className="relative">
                  <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-3xl bg-gradient-to-tr from-primary to-tertiary flex items-center justify-center text-on-primary text-5xl font-bold shadow-lg shadow-primary/30 border-4 border-background ring-4 ring-primary/10 rotate-3 transition-transform hover:rotate-0 duration-300">
                     <span className="-rotate-3 inline-block">{identidad.iniciales}</span>
                  </div>
                  <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-emerald-500 rounded-full border-4 border-background flex items-center justify-center shadow-sm">
                     <span className="material-symbols-outlined text-white text-[14px] font-bold">check</span>
                  </div>
                </div>
                
                <div className="flex-1 flex flex-col gap-1 pb-2">
                   <h1 className="font-display-sm text-on-surface font-bold tracking-tight">
                     {identidad.nombre}
                   </h1>
                   <div className="flex items-center gap-2 text-primary font-label-lg font-semibold">
                      <span className="material-symbols-outlined text-[18px]">verified</span>
                      <span>{profile.especialidad || "Coach Elite"}</span>
                   </div>
                </div>

                {!isEditing && (
                  <button onClick={() => setIsEditing(true)} className="mt-4 sm:mt-0 w-full sm:w-auto px-6 py-3 rounded-xl bg-surface-container-high text-on-surface font-label-lg font-bold flex items-center justify-center gap-2 hover:bg-surface-container-highest transition-colors active:scale-95 shadow-sm border border-surface-container">
                    <span className="material-symbols-outlined text-[20px]">edit_square</span>
                    Editar Perfil
                  </button>
                )}
             </div>

             {/* Zona de Edición con micro-animación */}
             {isEditing && (
                <div className="mt-6 pt-6 border-t border-surface-container-high animate-in slide-in-from-top-4 fade-in duration-300 flex flex-col gap-5">
                  
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="flex flex-col gap-1 font-label-sm text-primary font-bold">
                      Nombre
                      <input autoComplete="given-name" value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        className="w-full rounded-xl border border-surface-container-highest bg-background p-4 text-on-surface" />
                    </label>
                    <label className="flex flex-col gap-1 font-label-sm text-primary font-bold">
                      Apellido
                      <input autoComplete="family-name" value={formData.last_name}
                        onChange={e => setFormData({ ...formData, last_name: e.target.value })}
                        className="w-full rounded-xl border border-surface-container-highest bg-background p-4 text-on-surface" />
                    </label>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="font-label-sm text-primary font-bold ml-1">Tu Especialidad</label>
                    <input
                      type="text"
                      placeholder="Ej: Yoga Avanzado & Meditación"
                      value={formData.especialidad}
                      onChange={e => setFormData({...formData, especialidad: e.target.value})}
                      className="w-full bg-background p-4 rounded-xl font-body-lg text-on-surface border border-surface-container-highest focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="font-label-sm text-primary font-bold ml-1">Sobre Ti (Biografía)</label>
                    <textarea
                      rows={4}
                      placeholder="Inspira a tus alumnos contando tu historia..."
                      value={formData.bio}
                      onChange={e => setFormData({...formData, bio: e.target.value})}
                      className="w-full bg-background p-4 rounded-xl font-body-lg text-on-surface border border-surface-container-highest focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none resize-none leading-relaxed"
                    />
                  </div>
                  
                  <div className="flex items-center justify-end gap-3 mt-2">
                    <button 
                      onClick={() => {
                        setIsEditing(false);
                        setFormData({ name: nombreDocenteRegistrado(profile), last_name: profile.last_name ?? "", bio: profile.bio || "", especialidad: profile.especialidad || "" });
                      }}
                      className="px-6 py-3 rounded-xl text-secondary font-label-lg font-bold hover:bg-surface-container transition-colors"
                    >
                      Cancelar
                    </button>
                    <button 
                      onClick={handleSave} 
                      disabled={isSaving} 
                      className="px-8 py-3 rounded-xl bg-primary text-on-primary font-label-lg font-bold shadow-lg shadow-primary/30 disabled:opacity-50 flex items-center gap-2 hover:bg-primary/90 transition-all active:scale-95"
                    >
                      {isSaving ? (
                        <span className="material-symbols-outlined animate-spin text-[20px]">refresh</span>
                      ) : (
                        <span className="material-symbols-outlined text-[20px]">check_circle</span>
                      )}
                      Guardar Cambios
                    </button>
                  </div>
                </div>
             )}
          </div>

          {/* Estadísticas Rápidas */}
          <div className="flex flex-col gap-4">
             <div className="bg-surface-container-lowest p-5 rounded-3xl border border-surface-container flex flex-col gap-2 shadow-sm relative overflow-hidden group hover:border-primary/30 transition-colors">
                <div className="w-12 h-12 rounded-full bg-secondary-container text-secondary flex items-center justify-center mb-1 group-hover:scale-110 transition-transform">
                   <span className="material-symbols-outlined text-[24px]">local_fire_department</span>
                </div>
                <span className="font-display-md text-on-surface font-bold">{monthlyClassCount ?? "—"}</span>
                <span className="font-label-sm text-on-surface-variant uppercase tracking-wider">Clases asignadas este mes</span>
             </div>
          </div>

          {/* Biografía en modo lectura */}
          {!isEditing && (
            <div className="bg-surface-container-lowest rounded-3xl p-6 sm:p-8 shadow-sm border border-surface-container">
               <h2 className="font-headline-sm text-on-surface mb-4 flex items-center gap-2">
                 <span className="material-symbols-outlined text-primary">auto_awesome</span>
                 Mi Historia
               </h2>
               <p className="font-body-lg text-on-surface-variant leading-relaxed whitespace-pre-wrap">
                 {profile.bio || "Aún no has escrito una biografía. Cuéntales a tus alumnos sobre ti, tu experiencia y tu estilo de enseñanza para inspirarlos a reservar tus clases."}
               </p>
            </div>
          )}

           {/* Panel de Especialidades Impartidas */}
          <div className="mb-6">
             <h2 className="font-headline-sm text-on-surface mb-4 px-2 flex items-center gap-2">
               <span className="material-symbols-outlined text-secondary">collections_bookmark</span>
               Mis Especialidades
             </h2>
             
             {clases.length === 0 ? (
               <div className="p-8 bg-surface-container-low rounded-3xl text-center flex flex-col items-center gap-3 border border-surface-container border-dashed">
                  <span className="material-symbols-outlined text-4xl text-secondary opacity-50">fitness_center</span>
                  <p className="text-on-surface-variant font-body-lg">No has publicado clases aún. Ve a tu Agenda para comenzar.</p>
               </div>
             ) : (
               <div className="flex flex-wrap gap-3">
                 {Array.from(new Set(clases.map(c => c.nombre_clase))).map(clsName => {
                   return (
                     <div 
                       key={clsName} 
                       className="px-5 py-3 premium-card p-4 rounded-2xl font-label-lg font-bold text-on-surface flex items-center gap-2"
                     >
                        <div className="w-2 h-2 rounded-full bg-primary"></div>
                        {clsName}
                     </div>
                   );
                 })}
               </div>
             )}
          </div>

          <div className="pt-4 pb-8 flex flex-col gap-3">
            <button className="w-full h-12 rounded-xl bg-surface-container-high text-on-surface font-label-lg font-bold flex items-center justify-center gap-2 hover:bg-surface-container-highest transition-colors">
              <span className="material-symbols-outlined text-[20px]">settings</span>
              Configuración de la cuenta
            </button>
            <button 
              onClick={handleDeleteAccount}
              disabled={eliminandoCuenta}
              className="w-full h-12 rounded-xl bg-error text-on-error font-label-lg font-bold flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">delete_forever</span>
              {eliminandoCuenta ? "Eliminando…" : "Borrar cuenta"}
            </button>
            <button 
              onClick={handleLogout}
              disabled={eliminandoCuenta}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-surface-container-high text-on-surface hover:bg-surface-container-highest active:scale-[0.98] transition-all font-label-lg font-bold"
            >
              <span className="material-symbols-outlined text-[20px]">logout</span>
              Cerrar Sesión
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
