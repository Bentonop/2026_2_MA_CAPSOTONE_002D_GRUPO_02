"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { calcularVigenciaPlan } from "@/lib/vigenciaPlan";
import { supabase } from "@/lib/supabase";
import toast from "react-hot-toast";

function formatPlanDate(value: string | null, fallback: string) {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat("es-CL", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Santiago" }).format(date);
}

interface PlanAlumno {
  id: string;
  nombre: string;
  estado: string;
  inicio: string | null;
  fin: string | null;
  duracion: number | null;
  creditos: number;
}

export default function AlumnoPerfilPage() {
  const [profile, setProfile] = useState<any>(null);
  const [planes, setPlanes] = useState<PlanAlumno[]>([]);
  const [planStatus, setPlanStatus] = useState<"loading" | "ready" | "error">("loading");
  const [now, setNow] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    contacto_emergencia: "",
    condicion_medica: "",
    phone: "",
    correo: ""
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function fetchProfile() {
      setIsLoading(true);
      try {
        if (!supabase) throw new Error("No Supabase Client");
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) return;

        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", authUser.id)
          .single();

        if (error && error.code !== 'PGRST116') throw error;
        
        if (data) {
          setProfile(data);
          setFormData({
            contacto_emergencia: data.contacto_emergencia || "",
            condicion_medica: data.condicion_medica || "",
            phone: data.phone || "",
            correo: data.correo || ""
          });

        }
      } catch (error) {
        console.error("Error fetching profile:", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchProfile();
  }, []);

  const profileId = profile?.id;
  useEffect(() => {
    if (!profileId) return;
    let active = true;

    async function loadPlans() {
      const { data, error } = await supabase
        .from("user_suscripciones")
        .select("id, estado, fecha_inicio, fecha_fin, creditos_restantes, planes(nombre_plan, duracion_dias)")
        .eq("user_id", profileId)
        .order("created_at", { ascending: false });
      if (!active) return;
      setNow(Date.now());
      if (error) {
        setPlanStatus("error");
        return;
      }
      setPlanes((data ?? []).map(subscription => {
        const plan = Array.isArray(subscription.planes) ? subscription.planes[0] : subscription.planes;
        return {
          id: subscription.id,
          nombre: plan?.nombre_plan ?? "Plan",
          estado: subscription.estado,
          inicio: subscription.fecha_inicio,
          fin: subscription.fecha_fin,
          duracion: plan?.duracion_dias ?? null,
          creditos: subscription.creditos_restantes,
        };
      }));
      setPlanStatus("ready");
    }

    void loadPlans();
    window.addEventListener("focus", loadPlans);
    const interval = window.setInterval(loadPlans, 60_000);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", loadPlans);
    };
  }, [profileId]);

  const planesConVigencia = planes.map(plan => ({
    ...plan,
    ...calcularVigenciaPlan(plan.estado, plan.inicio, plan.fin, plan.duracion, now),
  }));
  const vigentes = planesConVigencia.filter(plan => plan.estado === "activa");
  const creditosDisponibles = vigentes.reduce((total, plan) => total + plan.creditos, 0);

  const handleSave = async () => {
    if (!profile || !supabase) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update(formData)
        .eq("id", profile.id);
        
      if (error) throw error;
      
      setProfile({ ...profile, ...formData });
      setIsEditing(false);
      toast.success("Perfil actualizado con éxito");
    } catch (err) {
      console.error("Error saving profile", err);
      toast.error("Error al guardar el perfil");
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

  return (
    <div className="flex flex-col w-full pb-bottom-nav-safe">
      <div className="flex items-center px-margin-mobile pt-space-md pb-space-sm gap-3">
        <h1 className="font-headline-md text-[24px] text-on-surface font-bold">Mi Perfil</h1>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-8 mt-10">
          <span className="material-symbols-outlined animate-spin text-primary text-4xl">refresh</span>
        </div>
      ) : profile ? (
        <div className="flex flex-col px-margin-mobile gap-space-lg mt-space-sm">
          {/* Header Card */}
          <section className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm border border-surface-container flex flex-col items-center justify-center relative overflow-hidden">
             <div className="w-24 h-24 rounded-full bg-primary flex items-center justify-center text-on-primary text-4xl font-bold shadow-md mb-4 relative">
                {profile.name?.charAt(0)}{profile.last_name?.charAt(0)}
             </div>
             <h2 className="font-headline-sm text-on-surface text-xl">{profile.name} {profile.last_name}</h2>
             <span className="font-label-md text-secondary mt-1 uppercase tracking-wider">{profile.role}</span>
          </section>

          <section aria-labelledby="mis-planes" className="rounded-2xl bg-surface-container-lowest border border-surface-container p-5">
            <h3 id="mis-planes" className="font-headline-sm text-on-surface">Mis planes</h3>
            {planStatus === "loading" ? <p role="status">Cargando planes…</p> : planStatus === "error" ? (
              <p role="alert">No se pudieron consultar tus planes.</p>
            ) : (
              <>
                <p className="mt-2 font-bold">{vigentes.length ? "Tienes un plan activo" : "Sin plan activo"}</p>
                <p className="text-secondary">{creditosDisponibles} créditos disponibles</p>
                {planesConVigencia.length > 0 && (
                  <ul className="mt-4 space-y-3">
                    {planesConVigencia.map(plan => (
                      <li key={plan.id} className="rounded-xl border border-surface-container p-3">
                        <p className="font-bold">{plan.nombre}</p>
                        <p className="text-sm text-secondary">
                          {plan.estado === "activa" ? "Activo" : plan.estado === "vencida" ? "Vencido" : plan.estado === "pendiente" ? "Pendiente de aprobación" : plan.estado === "sin_vigencia" ? "Vigencia sin confirmar" : "Cancelado"}
                          {plan.duracion !== null && ` · ${plan.duracion} ${plan.duracion === 1 ? "día" : "días"}`}
                        </p>
                        {["activa", "vencida"].includes(plan.estado) && (
                          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                            <dt>Activado</dt><dd>{formatPlanDate(plan.inicio, "Sin fecha registrada")}</dd>
                            <dt>{plan.estado === "vencida" ? "Venció" : "Vence"}</dt><dd>{formatPlanDate(plan.fin, "Sin fecha registrada")}</dd>
                            {plan.estado === "activa" && <><dt>Créditos disponibles</dt><dd>{plan.creditos}</dd></>}
                          </dl>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {!vigentes.length && <Link href="/alumno/tienda" className="inline-block mt-4 font-bold text-primary underline">Ver planes</Link>}
              </>
            )}
          </section>

          {/* Details */}
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-headline-sm text-on-surface">Información Personal</h3>
              {isEditing && (
                <div className="flex gap-2">
                  <button 
                    onClick={() => setIsEditing(false)}
                    className="text-secondary font-label-sm font-bold"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={handleSave}
                    disabled={isSaving}
                    className="text-primary font-label-sm font-bold disabled:opacity-50"
                  >
                    {isSaving ? "Guardando..." : "Guardar"}
                  </button>
                </div>
              )}
            </div>
            
            <div className="bg-surface-container-lowest rounded-xl p-4 shadow-sm border border-surface-container flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center text-secondary shrink-0">
                <span className="material-symbols-outlined text-[20px]">badge</span>
              </div>
              <div className="flex flex-col w-full">
                <span className="font-label-sm text-secondary uppercase">RUT</span>
                <span className="font-body-lg text-on-surface font-medium">{profile.rut || "No registrado"}</span>
              </div>
            </div>

            <div className="bg-surface-container-lowest rounded-xl p-4 shadow-sm border border-surface-container flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center text-secondary shrink-0">
                <span className="material-symbols-outlined text-[20px]">mail</span>
              </div>
              <div className="flex flex-col w-full overflow-hidden">
                <span className="font-label-sm text-secondary uppercase">Correo Electrónico</span>
                {isEditing ? (
                  <input 
                    type="email" 
                    value={formData.correo} 
                    onChange={e => setFormData({...formData, correo: e.target.value})} 
                    className="w-full bg-surface-container p-2 rounded mt-1 font-body-md border border-surface-container-high focus:outline-primary"
                    placeholder="correo@ejemplo.com"
                  />
                ) : (
                  <span className="font-body-lg text-on-surface font-medium truncate">{profile.correo || "No registrado"}</span>
                )}
              </div>
            </div>

            <div className="bg-surface-container-lowest rounded-xl p-4 shadow-sm border border-surface-container flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center text-secondary shrink-0">
                <span className="material-symbols-outlined text-[20px]">call</span>
              </div>
              <div className="flex flex-col w-full">
                <span className="font-label-sm text-secondary uppercase">Teléfono</span>
                {isEditing ? (
                  <input 
                    type="tel" 
                    value={formData.phone} 
                    onChange={e => setFormData({...formData, phone: e.target.value})} 
                    className="w-full bg-surface-container p-2 rounded mt-1 font-body-md border border-surface-container-high focus:outline-primary"
                    placeholder="+56 9..."
                  />
                ) : (
                  <span className="font-body-lg text-on-surface font-medium">{profile.phone || "No registrado"}</span>
                )}
              </div>
            </div>
            
            <div className="bg-surface-container-lowest rounded-xl p-4 shadow-sm border border-surface-container flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-error/10 flex items-center justify-center text-error shrink-0">
                <span className="material-symbols-outlined text-[20px]">medical_information</span>
              </div>
              <div className="flex flex-col w-full">
                <span className="font-label-sm text-secondary uppercase">Condición Médica</span>
                {isEditing ? (
                  <textarea 
                    value={formData.condicion_medica} 
                    onChange={e => setFormData({...formData, condicion_medica: e.target.value})} 
                    className="w-full bg-surface-container p-2 rounded mt-1 font-body-md border border-surface-container-high focus:outline-primary min-h-[60px]"
                    placeholder="Escribe aquí alergias, lesiones, etc."
                  />
                ) : (
                  <span className="font-body-md text-on-surface font-medium">{profile.condicion_medica || "Ninguna (Apto para actividad física)"}</span>
                )}
              </div>
            </div>

            <div className="bg-surface-container-lowest rounded-xl p-4 shadow-sm border border-surface-container flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center text-secondary shrink-0">
                <span className="material-symbols-outlined text-[20px]">emergency_home</span>
              </div>
              <div className="flex flex-col w-full">
                <span className="font-label-sm text-secondary uppercase">Contacto de Emergencia</span>
                {isEditing ? (
                  <input 
                    type="text" 
                    value={formData.contacto_emergencia} 
                    onChange={e => setFormData({...formData, contacto_emergencia: e.target.value})} 
                    className="w-full bg-surface-container p-2 rounded mt-1 font-body-md border border-surface-container-high focus:outline-primary"
                    placeholder="Nombre y Parentesco"
                  />
                ) : (
                  <span className="font-body-md text-on-surface font-medium">{profile.contacto_emergencia || ""}</span>
                )}
              </div>
            </div>

            {!isEditing && (
              <button 
                onClick={() => setIsEditing(true)}
                className="w-full h-12 mt-2 rounded-xl border-2 border-primary text-primary font-label-lg font-bold flex items-center justify-center gap-2 hover:bg-primary/10 transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">edit_note</span>
                Modificar Datos
              </button>
            )}
          </section>
          
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
      ) : (
        <div className="flex flex-col items-center justify-center p-8 bg-surface-container-low rounded-2xl border border-surface-container mt-10 text-center mx-4">
          <span className="material-symbols-outlined text-secondary text-4xl mb-3">person_off</span>
          <h3 className="font-headline-sm text-on-surface">Perfil no encontrado</h3>
          <p className="font-body-sm text-on-surface-variant mt-1">No hay alumnos registrados en la base de datos.</p>
        </div>
      )}
    </div>
  );
}
