"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import QrScanner from "@/components/shared/QrScanner";
import RoleGuard from "@/components/ui/auth/RoleGuard";
import BrandLogo from "@/components/ui/BrandLogo";
import toast from "react-hot-toast";

type StudentStatus = "presente" | "pendiente" | "cancelado";

interface Student {
  id: string | number;
  reserva_id: number;
  name: string;
  plan: string;
  status: StudentStatus;
  time: string | null;
  type: string;
  isNew: boolean;
  emergencyContact: string;
  emergencyPhone: string;
  healthConditions: string | null;
}

export default function ProfesorClasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  // Estados de datos
  const [students, setStudents] = useState<Student[]>([]);
  const [claseDetalle, setClaseDetalle] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Estados para el Escáner de Asistencia (Exclusivo Docente)
  const [isScannerModalOpen, setIsScannerModalOpen] = useState(false);
  const [isScannerLocked, setIsScannerLocked] = useState(false);
  const [isProcessingScan, setIsProcessingScan] = useState(false);
  const [scanFeedback, setScanFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Modales y Alertas
  const [isIncidentModalOpen, setIsIncidentModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  useEffect(() => {
    async function fetchClaseData() {
      if (!supabase) return;
      
      const { data: claseData } = await supabase
        .from('clase')
        .select('*')
        .eq('id_clase', id)
        .single();
        
      if (claseData) setClaseDetalle(claseData);

      const { data: reservas } = await supabase
        .from('reserva')
        .select(`
           *,
           profiles:id_usuario (id, name, last_name, phone, contacto_emergencia, condicion_medica, correo),
           asistencia (*)
        `)
        .eq('id_clase', id);

      if (reservas) {
        // Fetch plans for these students
        const userIds = Array.from(new Set(reservas.map(r => r.id_usuario)));
        let subMap: Record<string, string> = {};
        if (userIds.length > 0) {
          const { data: subs } = await supabase
            .from('user_suscripciones')
            .select('user_id, planes:plan_id(nombre_plan)')
            .in('user_id', userIds)
            .eq('estado', 'activa');

          if (subs) {
            subs.forEach((s: any) => {
              const planName = s.planes?.nombre_plan;
              if (planName) subMap[s.user_id] = planName;
            });
          }
        }

        const mappedStudents: Student[] = reservas.map(r => {
          const profile = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
          const fullName = [profile?.name, profile?.last_name].filter(Boolean).join(' ').trim() || profile?.correo || 'Alumno';
          const tieneAsistencia = r.asistencia && r.asistencia.length > 0 && r.asistencia[0]?.fecha_hora_ingreso;

          return {
            id: r.id_usuario,
            reserva_id: r.id_reserva,
            name: fullName,
            plan: subMap[r.id_usuario] || "Plan Activo", 
            status: tieneAsistencia || r.estado_reserva === "presente" ? "presente" : (r.estado_reserva === "cancelada" ? "cancelado" : "pendiente"),
            time: tieneAsistencia ? new Date(r.asistencia[0].fecha_hora_ingreso).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) : null,
            type: "normal",
            isNew: false,
            emergencyContact: profile?.contacto_emergencia || "No registrado",
            emergencyPhone: profile?.phone || "+56 9 0000 0000",
            healthConditions: profile?.condicion_medica || "Ninguna (Apto para actividad física)"
          };
        });
        setStudents(mappedStudents);
      }
      setIsLoading(false);
    }
    
    fetchClaseData();
  }, [id]);

  const presentCount = students.filter(s => s.status === "presente").length;
  const totalCount = students.filter(s => s.status !== "cancelado").length;
  const progressPercent = totalCount === 0 ? 0 : (presentCount / totalCount) * 100;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2800);
  };

  // Función interna para registrar asistencia en las tablas asistencia y reserva
  const registrarAsistenciaBD = async (reservaId: number, tokenUsado: string) => {
    if (!supabase) return;

    // 1. Guardar o actualizar registro en la tabla asistencia
    await supabase
      .from("asistencia")
      .upsert({
        id_reserva: reservaId,
        fecha_hora_ingreso: new Date().toISOString(),
        metodo_ingreso: "QR_DOCENTE",
        token_qr_usado: tokenUsado
      }, { onConflict: 'id_reserva' });

    // 2. Actualizar estado en reserva
    await supabase
      .from("reserva")
      .update({ estado_reserva: "presente" })
      .eq("id_reserva", reservaId);
  };

  const handleSimulateScan = async () => {
    const pendingStudent = students.find(s => s.status === "pendiente");
    if (pendingStudent) {
      await registrarAsistenciaBD(pendingStudent.reserva_id, `simulacion-${pendingStudent.reserva_id}`);
      
      const horaActual = new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
      const updatedStudent = { ...pendingStudent, status: "presente" as StudentStatus, time: horaActual };
      setStudents(prev => prev.map(s => s.id === pendingStudent.id ? updatedStudent : s));
      setSelectedStudent(updatedStudent);
      toast.success(`✅ ¡Presente! Asistencia confirmada para ${pendingStudent.name}`);
      showToast(`Ingresó: ${pendingStudent.name}`);
    } else {
      toast("No hay alumnos pendientes para escanear");
    }
  };

  // MANEJO PRINCIPAL DE ESCANEO DE QR (ANTI-SATURACIÓN Y CIERRE AUTOMÁTICO)
  const handleScanResult = async (decodedText: string) => {
    // 1. Evitar lecturas múltiples simultáneas que saturen la app
    if (isScannerLocked || isProcessingScan) return;
    setIsScannerLocked(true);
    setIsProcessingScan(true);

    let targetReservaId: number | null = null;
    let targetClaseId: number | null = null;
    let targetUserId: string | null = null;

    try {
      const parsed = JSON.parse(decodedText);
      targetReservaId = Number(parsed.id_reserva) || null;
      targetClaseId = Number(parsed.id_clase) || null;
      targetUserId = parsed.id_usuario || null;
    } catch {
      targetReservaId = Number(decodedText) || null;
    }

    // 2. Validación de Clase: el QR debe pertenecer a esta clase
    if (targetClaseId && String(targetClaseId) !== String(id)) {
      const errorMsg = `Este código QR pertenece a otra clase (#${targetClaseId}). No corresponde a ${claseDetalle?.nombre_clase || "esta sesión"}.`;
      toast.error(errorMsg);
      setScanFeedback({ type: "error", message: errorMsg });
      setIsProcessingScan(false);
      return;
    }

    // 3. Buscar el alumno en la lista de inscritos
    const student = students.find(s => 
      (targetReservaId && s.reserva_id === targetReservaId) || 
      (targetUserId && s.id === targetUserId) ||
      s.id.toString() === decodedText || 
      s.reserva_id.toString() === decodedText || 
      s.name.toLowerCase() === decodedText.toLowerCase()
    );

    if (!student) {
      const errorMsg = "Código QR no válido o el alumno no se encuentra inscrito en esta clase.";
      toast.error(errorMsg);
      setScanFeedback({ type: "error", message: errorMsg });
      setIsProcessingScan(false);
      return;
    }

    // 4. Si el alumno ya está presente
    if (student.status === "presente") {
      const infoMsg = `${student.name} ya tenía su asistencia confirmada previamente.`;
      toast(infoMsg);
      setScanFeedback({ type: "success", message: `${student.name} ya está presente` });
      setIsProcessingScan(false);
      
      // Cerrar escáner tras breve confirmación
      setTimeout(() => {
        setIsScannerModalOpen(false);
        setScanFeedback(null);
        setIsScannerLocked(false);
      }, 1000);
      return;
    }

    // 5. Si la reserva fue cancelada
    if (student.status === "cancelado") {
      const errorMsg = `La reserva de ${student.name} figura como cancelada. No es posible dar acceso.`;
      toast.error(errorMsg);
      setScanFeedback({ type: "error", message: errorMsg });
      setIsProcessingScan(false);
      return;
    }

    // 6. CASO DE ÉXITO: Registrar en base de datos y cerrar escáner automáticamente
    try {
      await registrarAsistenciaBD(student.reserva_id, decodedText);

      const horaActual = new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
      const updatedStudent = { ...student, status: "presente" as StudentStatus, time: horaActual };
      
      setStudents(prev => prev.map(s => s.id === student.id ? updatedStudent : s));
      setSelectedStudent(updatedStudent);

      // Feedback háptico en móviles
      if (typeof window !== "undefined" && window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate([100, 50, 100]);
      }

      toast.success(`✅ ¡Presente! Asistencia confirmada para ${student.name}`);
      setScanFeedback({
        type: "success",
        message: `¡Asistencia confirmada para ${student.name}!`
      });

      // Cerrar el escáner automáticamente tal como pidió el usuario
      setTimeout(() => {
        setIsScannerModalOpen(false);
        setScanFeedback(null);
        setIsScannerLocked(false);
        setIsProcessingScan(false);
      }, 900);
    } catch (err) {
      console.error("Error al registrar asistencia:", err);
      toast.error("Error al conectar con la base de datos.");
      setScanFeedback({ type: "error", message: "Error al guardar asistencia." });
      setIsProcessingScan(false);
    }
  };

  const handleCheckIn = async (studentId: string | number, e: React.MouseEvent) => {
    e.stopPropagation();
    
    const student = students.find(s => s.id === studentId);
    if (!student || !supabase) return;

    await registrarAsistenciaBD(student.reserva_id, `manual-${student.reserva_id}`);

    const horaActual = new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
    const updatedStudent = { ...student, status: "presente" as StudentStatus, time: horaActual };
    setStudents(prev => 
      prev.map(s => s.id === studentId ? updatedStudent : s)
    );
    setSelectedStudent(updatedStudent);
    toast.success(`✅ ¡Presente! ${student.name} marcado manualmente.`);
    showToast(`Ingresó: ${student.name}`);
  };

  const submitIncident = (type: string) => {
    setIsIncidentModalOpen(false);
    showToast(`Aviso enviado: ${type}`);
    toast.success(`Alerta enviada a dirección: ${type}`);
  };

  const handleStartClass = async () => {
    if (!supabase || !claseDetalle) return;
    try {
      const { error: updateError } = await supabase
        .from('clase')
        .update({ estado_clase: 'en_curso' })
        .eq('id_clase', id);

      if (updateError) throw updateError;
      
      setClaseDetalle({ ...claseDetalle, estado_clase: 'en_curso' });

      const tituloNotificacion = `🟢 Clase Iniciada: ${claseDetalle.nombre_clase}`;
      const mensajeNotificacion = `El profesor ha iniciado la sesión. Asistencia confirmada: ${presentCount}/${totalCount} alumnos.`;
      
      const { error: notifError } = await supabase
        .from('notificaciones')
        .insert([{
          tipo: 'operativa',
          titulo: tituloNotificacion,
          mensaje: mensajeNotificacion,
          clase_id: parseInt(id)
        }]);
        
      if (notifError) console.warn("La tabla de notificaciones podría no estar lista aún:", notifError);

      toast.success("✅ Clase iniciada correctamente.");
      showToast("✅ Clase iniciada correctamente.");
    } catch (err) {
      console.error("Error al iniciar clase:", err);
      toast.error("❌ Hubo un error al iniciar la clase");
    }
  };

  return (
    <RoleGuard allowedRole="profesor">
    <div className="bg-surface font-body-md text-body-md text-on-surface flex flex-col min-h-screen">
      <header className="fixed top-0 inset-x-0 z-50 bg-surface/90 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] pt-safe">
        <div className="h-16 max-w-5xl mx-auto px-margin-mobile flex items-center justify-between w-full">
          <div className="flex items-center gap-space-xs">
            <button 
              aria-label="Volver" 
              className="w-11 h-11 -ml-2 flex items-center justify-center rounded-full text-on-surface hover:bg-surface-container-high transition-colors"
              onClick={() => router.back()}
            >
              <span className="material-symbols-outlined text-[24px]">arrow_back</span>
            </button>
            <BrandLogo size="sm" showText={false} />
            <h1 className="font-headline-sm text-headline-sm text-on-surface tracking-tight truncate max-w-[200px] ml-2">Detalle De Clase</h1>
          </div>
          <div className="flex items-center gap-space-xs">
             <div className="w-8 h-8 rounded-full bg-surface-container-high shadow-sm flex items-center justify-center text-primary font-bold text-xs">DOC</div>
          </div>
        </div>
      </header>

      <main className="flex flex-col relative w-full pt-16 pb-safe bg-surface min-h-screen">
        <div className="flex flex-col w-full max-w-5xl mx-auto pb-10">
          
          {/* Tarjeta Resumen de la Clase */}
          <section className="px-margin-mobile pt-space-xs pb-space-sm">
            <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm border border-surface-container/50">
              <div className="flex items-start justify-between gap-space-xs">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-space-2xs mb-1">
                    {claseDetalle?.estado_clase === 'en_curso' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 font-label-caps text-label-caps border border-emerald-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        EN CURSO
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary font-label-caps text-label-caps border border-primary/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                        PROGRAMADA
                      </span>
                    )}
                    <span className="text-secondary font-label-caps text-label-caps uppercase tracking-wider ml-2">{claseDetalle?.sala || "Sala Principal"}</span>
                  </div>
                  <h2 className="font-headline-md text-headline-md text-on-surface truncate">{claseDetalle?.nombre_clase || "Cargando..."}</h2>
                  <p className="font-body-sm text-body-sm text-secondary mt-0.5 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">schedule</span>
                    {claseDetalle ? new Date(claseDetalle.fecha_hora_inicio).toLocaleString('es-CL', { weekday: 'short', hour: '2-digit', minute:'2-digit' }) : ""} hrs
                  </p>
                </div>
              </div>
              
              {/* Barra de Asistencia */}
              <div className="mt-space-md pt-space-sm border-t border-surface-container">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-primary text-[18px]">group_check</span>
                    <span className="font-label-lg text-label-lg text-on-surface">Asistencia</span>
                  </div>
                  <span className="font-headline-sm text-headline-sm text-primary">
                    <span>{presentCount}</span><span className="text-secondary text-body-md font-body-md">/{totalCount}</span>
                  </span>
                </div>
                <div className="w-full h-2.5 bg-surface-container rounded-full overflow-hidden flex">
                  <div className="h-full bg-primary rounded-full transition-all duration-500 ease-out shadow-[0_0_8px_rgba(212,175,55,0.6)]" style={{ width: `${progressPercent}%` }}></div>
                </div>
                <div className="flex items-center justify-between mt-2 font-label-caps text-label-caps text-secondary">
                  <span>{Math.round(progressPercent)}% Completado</span>
                  <span className="text-on-surface-variant">
                    {totalCount - presentCount} pendientes • {students.length - totalCount} cancelados
                  </span>
                </div>
              </div>

              {claseDetalle?.estado_clase !== 'en_curso' && (
                <div className="mt-4 pt-4 border-t border-surface-container">
                  <button 
                    onClick={handleStartClass}
                    className="w-full py-3.5 px-4 rounded-xl bg-primary text-on-primary font-label-lg font-bold flex items-center justify-center gap-2 hover:bg-primary/90 active:scale-[0.98] transition-all shadow-md shadow-primary/20"
                  >
                    <span className="material-symbols-outlined text-[20px]">play_circle</span>
                    Comenzar Clase
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* SECCIÓN EXCLUSIVA DE ESCANEO DE ASISTENCIA QR PARA EL PROFESOR */}
          <section className="px-margin-mobile py-space-xs">
            <div className="premium-card rounded-2xl p-space-md shadow-md flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <span className="material-symbols-outlined text-[24px]">qr_code_scanner</span>
                  </div>
                  <div>
                    <h3 className="font-headline-sm text-base text-on-surface font-bold">Lector de Asistencia QR</h3>
                    <p className="font-body-sm text-xs text-secondary">Solo el profesor escanea los pases de los alumnos</p>
                  </div>
                </div>
              </div>

              {/* Botón Principal para Abrir el Escáner */}
              <div className="flex flex-col gap-2 mt-1">
                <button 
                  onClick={() => {
                    setScanFeedback(null);
                    setIsScannerLocked(false);
                    setIsScannerModalOpen(true);
                  }}
                  className="w-full py-4 px-4 rounded-xl bg-primary text-on-primary font-label-lg font-bold flex items-center justify-center gap-2.5 hover:opacity-90 active:scale-[0.98] transition-all shadow-md shadow-primary/20"
                >
                  <span className="material-symbols-outlined text-[22px]">photo_camera</span>
                  Escanear Pase QR de Alumno
                </button>

                <div className="flex items-center justify-between px-1 pt-1 text-xs text-secondary">
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[15px] text-emerald-500">lock_clock</span>
                    Cierre automático al registrar
                  </span>
                  <button 
                    onClick={handleSimulateScan}
                    className="text-primary hover:underline font-semibold"
                  >
                    Simular Pase (Test)
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* RÓSTER DE ALUMNOS */}
          <section className="px-margin-mobile pt-space-md flex flex-col gap-space-xs">
            <div className="flex items-center justify-between px-1">
              <div>
                <h3 className="font-headline-sm text-headline-sm text-on-surface">Róster de Alumnos</h3>
                <p className="font-body-sm text-body-sm text-secondary">{totalCount}/{claseDetalle?.cupo_maximo || 8} cupos ocupados</p>
              </div>
            </div>

            <div className="flex flex-col gap-space-xs mt-1">
              {students.length === 0 ? (
                <div className="text-center py-8 bg-surface-container-lowest rounded-xl border border-surface-container">
                  <span className="material-symbols-outlined text-secondary text-3xl mb-1">group_off</span>
                  <p className="font-headline-sm text-sm text-on-surface">No hay alumnos inscritos aún</p>
                  <p className="font-body-sm text-xs text-secondary mt-0.5">Los cupos están disponibles para reserva.</p>
                </div>
              ) : (
                students.map((student) => (
                <div 
                  key={student.id} 
                  className={`rounded-xl p-space-sm flex flex-col gap-2 transition-all cursor-pointer ${student.status === 'cancelado' ? 'bg-surface-container/50 opacity-60 border border-transparent' : 'bg-surface-container-lowest border border-surface-container shadow-sm hover:border-primary/30'} ${selectedStudent?.id === student.id ? 'ring-1 ring-primary' : ''}`}
                  onClick={() => setSelectedStudent(selectedStudent?.id === student.id ? null : student)}
                >
                  <div className="flex items-center justify-between gap-space-xs">
                    <div className="flex items-center gap-space-sm min-w-0">
                      <div className={`relative flex-shrink-0 ${student.status === 'cancelado' ? 'filter grayscale' : ''}`}>
                        <div className="w-12 h-12 rounded-full bg-surface-container-highest flex items-center justify-center font-bold text-on-surface-variant">
                          {student.name.charAt(0)}
                        </div>
                        <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-surface-container-lowest flex items-center justify-center text-on-primary ${student.status === 'presente' ? 'bg-emerald-500' : student.status === 'pendiente' ? 'bg-primary' : 'bg-surface-container-highest text-on-surface'}`}>
                          <span className="material-symbols-outlined text-[10px] font-bold">
                            {student.status === 'presente' ? 'check' : student.status === 'pendiente' ? 'schedule' : 'close'}
                          </span>
                        </div>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className={`font-headline-sm text-headline-sm truncate ${student.status === 'cancelado' ? 'text-secondary line-through' : 'text-on-surface'}`}>{student.name}</h4>
                          {student.isNew && student.status !== 'cancelado' && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-primary/20 text-primary border border-primary/30">Nuevo</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="font-body-sm text-body-sm text-secondary truncate">{student.plan}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex-shrink-0">
                      {student.status === "presente" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 font-label-md text-label-md border border-emerald-500/20">
                          <span className="material-symbols-outlined text-[14px]">done_all</span>
                          Presente
                        </span>
                      )}
                      {student.status === "cancelado" && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-surface-container-high text-secondary font-label-caps text-label-caps">
                          Canceló
                        </span>
                      )}
                      {student.status === "pendiente" && (
                        <button 
                          className="px-3 py-1.5 rounded-xl bg-primary text-on-primary font-label-md text-label-md flex items-center gap-1 transition-all active:scale-95 shadow-md shadow-primary/20"
                          onClick={(e) => handleCheckIn(student.id, e)}
                        >
                          <span className="material-symbols-outlined text-[16px]">touch_app</span>
                          <span>Marcar</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {selectedStudent?.id === student.id && student.status !== 'cancelado' && (
                    <div className="mt-2 pt-3 border-t border-surface-container flex flex-col gap-2 animate-in fade-in slide-in-from-top-1">
                      {student.healthConditions && (
                        <div className="flex items-start gap-2 bg-error/10 text-error-container p-2 rounded-lg">
                          <span className="material-symbols-outlined text-[16px] text-error mt-0.5">medical_information</span>
                          <div>
                            <span className="font-label-md text-label-md text-error block">Condición médica indicada:</span>
                            <span className="font-body-sm text-body-sm">{student.healthConditions}</span>
                          </div>
                        </div>
                      )}
                      <div className="flex items-center justify-between bg-surface-container p-2.5 rounded-lg border border-surface-container-high">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-surface-container-highest flex items-center justify-center text-secondary">
                            <span className="material-symbols-outlined text-[16px]">emergency_home</span>
                          </div>
                          <div>
                            <span className="font-label-caps text-label-caps text-secondary block">Contacto Emergencia</span>
                            <span className="font-label-md text-label-md text-on-surface">{student.emergencyContact}</span>
                          </div>
                        </div>
                        <a href={`tel:${student.emergencyPhone}`} className="h-8 px-3 rounded-lg bg-surface-container-high hover:bg-primary/20 text-primary font-label-md text-label-md flex items-center gap-1.5 transition-colors border border-surface-container-highest hover:border-primary/30" onClick={e => e.stopPropagation()}>
                          <span className="material-symbols-outlined text-[16px]">call</span>
                          Llamar
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              )))}
            </div>
          </section>

          {/* GESTIÓN DE INCIDENCIAS */}
          <section className="px-margin-mobile pt-space-lg pb-space-md">
            <div className="bg-surface-container-low border border-surface-container-high rounded-2xl p-space-md flex flex-col gap-space-xs">
              <div className="flex items-start gap-space-sm">
                <div className="w-10 h-10 rounded-xl bg-surface-container-highest text-secondary flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-[24px]">crisis_alert</span>
                </div>
                <div className="flex-1">
                  <h4 className="font-headline-sm text-headline-sm text-on-surface">Gestión de Urgencias</h4>
                  <p className="font-body-sm text-body-sm text-secondary mt-0.5">
                    Comunica cualquier retraso o cambio a recepción central.
                  </p>
                </div>
              </div>
              <button 
                className="mt-space-xs w-full py-3 px-4 rounded-xl border border-surface-container-highest text-secondary font-label-lg text-label-lg flex items-center justify-center gap-2 hover:bg-surface-container active:scale-95 transition-all"
                onClick={() => setIsIncidentModalOpen(true)}
              >
                <span className="material-symbols-outlined text-[20px]">notification_important</span>
                Notificar Incidencia de Sala
              </button>
            </div>
          </section>

        </div>
      </main>

      {/* MODAL ESCÁNER DE ASISTENCIA QR PARA EL PROFESOR */}
      {isScannerModalOpen && (
        <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-sm bg-surface-container-lowest rounded-3xl p-6 shadow-2xl border border-surface-container flex flex-col items-center relative overflow-hidden">
            
            {/* Header Modal */}
            <div className="w-full flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-[22px]">photo_camera</span>
                </div>
                <div>
                  <h3 className="font-headline-sm text-base text-on-surface font-bold">Lector de Asistencia</h3>
                  <p className="font-body-sm text-xs text-secondary truncate max-w-[200px]">
                    {claseDetalle?.nombre_clase || "Clase actual"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsScannerModalOpen(false);
                  setScanFeedback(null);
                  setIsScannerLocked(false);
                }}
                aria-label="Cerrar escáner"
                className="w-9 h-9 rounded-full bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-on-surface-variant transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Contenido / Estado del Escaneo */}
            {scanFeedback?.type === "success" ? (
              <div className="w-full py-8 flex flex-col items-center justify-center text-center gap-3 animate-in zoom-in-95">
                <div className="w-16 h-16 rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[38px]">check_circle</span>
                </div>
                <h4 className="font-headline-sm text-xl font-bold text-on-surface">¡Presente!</h4>
                <p className="font-body-sm text-sm text-emerald-500 font-semibold">{scanFeedback.message}</p>
                <span className="text-xs text-on-surface-variant mt-1">Cerrando escáner...</span>
              </div>
            ) : scanFeedback?.type === "error" ? (
              <div className="w-full py-6 flex flex-col items-center justify-center text-center gap-3 animate-in zoom-in-95">
                <div className="w-14 h-14 rounded-full bg-error/15 text-error border border-error/30 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[32px]">warning</span>
                </div>
                <h4 className="font-headline-sm text-lg font-bold text-error">Atención: Código No Válido</h4>
                <div className="p-3 rounded-xl bg-error/10 border border-error/20 text-xs text-on-surface text-center">
                  {scanFeedback.message}
                </div>
                <div className="flex gap-2 w-full mt-2">
                  <button
                    onClick={() => {
                      setScanFeedback(null);
                      setIsScannerLocked(false);
                    }}
                    className="flex-1 py-3 bg-primary text-on-primary font-label-md font-bold rounded-xl active:scale-95 transition-all text-xs flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[16px]">refresh</span>
                    Escanear Siguiente
                  </button>
                  <button
                    onClick={() => {
                      setIsScannerModalOpen(false);
                      setScanFeedback(null);
                      setIsScannerLocked(false);
                    }}
                    className="py-3 px-4 bg-surface-container text-on-surface font-label-md font-medium rounded-xl active:scale-95 transition-all text-xs"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            ) : (
              <div className="w-full flex flex-col items-center">
                <div className="w-full max-w-[280px]">
                  <QrScanner 
                    onResult={handleScanResult} 
                    isLocked={isScannerLocked} 
                    id="teacher-attendance-scanner" 
                  />
                </div>

                <p className="font-body-sm text-xs text-secondary text-center mt-4">
                  Apunta la cámara al teléfono del alumno (su Pase QR).
                </p>

                {isProcessingScan && (
                  <div className="mt-3 flex items-center gap-2 text-primary font-label-md text-xs">
                    <span className="material-symbols-outlined animate-spin text-[16px]">refresh</span>
                    Validando reserva...
                  </div>
                )}

                <button
                  onClick={() => {
                    setIsScannerModalOpen(false);
                    setScanFeedback(null);
                    setIsScannerLocked(false);
                  }}
                  className="w-full mt-4 py-3 rounded-xl bg-surface-container text-on-surface font-label-md font-medium hover:bg-surface-container-high transition-colors text-sm"
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL DE INCIDENCIAS */}
      {isIncidentModalOpen && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-end justify-center">
          <div className="bg-surface-container-lowest border-t border-surface-container w-full max-w-lg rounded-t-3xl p-space-lg flex flex-col shadow-2xl animate-in slide-in-from-bottom">
            <div className="w-12 h-1.5 bg-surface-container-highest rounded-full mx-auto mb-space-sm"></div>
            <div className="flex items-center justify-between mb-space-sm">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-error text-[24px]">report_problem</span>
                <h3 className="font-headline-sm text-headline-sm text-on-surface">Reportar Incidencia</h3>
              </div>
              <button className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-secondary hover:text-on-surface" onClick={() => setIsIncidentModalOpen(false)}>
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            <p className="font-body-md text-body-md text-secondary mb-space-md">
              Se enviará una alerta prioritaria a Dirección para cubrir o dar aviso a alumnos.
            </p>
            <div className="flex flex-col gap-space-xs mb-space-md">
              <button className="p-3.5 rounded-xl bg-surface-container hover:bg-surface-container-high border border-surface-container-highest text-left flex items-center justify-between transition-colors" onClick={() => submitIncident('Retraso de sala')}>
                <span className="font-label-lg text-label-lg text-on-surface">⏳ Retraso para iniciar (10-15 min)</span>
                <span className="material-symbols-outlined text-secondary text-[18px]">chevron_right</span>
              </button>
              <button className="p-3.5 rounded-xl bg-surface-container hover:bg-surface-container-high border border-surface-container-highest text-left flex items-center justify-between transition-colors" onClick={() => submitIncident('Imprevisto Médico / Lesión')}>
                <span className="font-label-lg text-label-lg text-on-surface">🩹 Lesión de alumno o docente</span>
                <span className="material-symbols-outlined text-secondary text-[18px]">chevron_right</span>
              </button>
              <button className="p-3.5 rounded-xl bg-surface-container hover:bg-surface-container-high border border-surface-container-highest text-left flex items-center justify-between transition-colors" onClick={() => submitIncident('Problema Técnico')}>
                <span className="font-label-lg text-label-lg text-on-surface">🔧 Problema con barra/equipo</span>
                <span className="material-symbols-outlined text-secondary text-[18px]">chevron_right</span>
              </button>
            </div>
            <button className="w-full py-3 rounded-xl bg-transparent border border-surface-container-highest text-secondary font-label-md text-label-md hover:bg-surface-container transition-colors" onClick={() => setIsIncidentModalOpen(false)}>
              Cancelar y volver
            </button>
          </div>
        </div>
      )}

      {/* TOAST FLOTANTE */}
      <div className={`fixed top-20 inset-x-4 z-50 flex items-center justify-center pointer-events-none transition-all duration-300 ${toastMessage ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}`}>
        <div className="bg-surface-container-highest border border-surface-container-high text-on-surface px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 max-w-sm">
          <span className="material-symbols-outlined text-primary text-[20px]">check_circle</span>
          <span className="font-label-md text-label-md">{toastMessage}</span>
        </div>
      </div>
    </div>
    </RoleGuard>
  );
}
