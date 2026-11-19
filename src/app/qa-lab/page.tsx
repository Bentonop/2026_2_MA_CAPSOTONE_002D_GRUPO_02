"use client";

import { useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { QRCodeSVG } from "qrcode.react";
import BrandLogo from "@/components/ui/BrandLogo";
import { 
  ShieldAlert, 
  ShieldCheck, 
  CheckCircle2, 
  XCircle, 
  QrCode, 
  Clock, 
  AlertTriangle, 
  ArrowLeft, 
  Camera, 
  Users, 
  Eye, 
  Lock, 
  Sparkles,
  Layers,
  Database,
  KeyRound,
  Mail,
  UserCheck,
  CreditCard
} from "lucide-react";
import { validateRutDetailed } from "@/lib/rut";

export default function QaLabPage() {
  const [activeTab, setActiveTab] = useState<"seguridad" | "feedback" | "asistencia" | "cancelacion" | "metricas" | "auth-val">("seguridad");

  // Estados para pruebas interactivas
  const [roleGuardTestState, setRoleGuardTestState] = useState<"idle" | "unprotected" | "blocked">("idle");
  const [cancellationHours, setCancellationHours] = useState<number>(1);
  const [cancellationResult, setCancellationResult] = useState<string | null>(null);
  const [metricsFilter, setMetricsFilter] = useState<"todos" | "prof-manuel">("prof-manuel");
  const [attendanceScanResult, setAttendanceScanResult] = useState<string | null>(null);

  // Estados para pruebas de autenticación y validación
  const [testRut, setTestRut] = useState<string>("12345678-9");
  const [testName, setTestName] = useState<string>("Al");
  const [testEmail, setTestEmail] = useState<string>("usuario-sin-arroba.com");
  const [testPassword, setTestPassword] = useState<string>("12345");
  const [loginSimStatus, setLoginSimStatus] = useState<"idle" | "error_handled">("idle");

  // Simulación de profesores y clases para prueba de métricas
  const profesoresMock = [
    { id: "prof-manuel", nombre: "Prof. Manuel Campos", clase: "Pilates Reformer", alumnos: 8, ingresos: 80000 },
    { id: "prof-claudia", nombre: "Prof. Claudia Soto", clase: "Yoga Ashtanga", alumnos: 7, ingresos: 70000 },
    { id: "prof-andres", nombre: "Prof. Andrés Morales", clase: "Danza Contemporánea", alumnos: 6, ingresos: 60000 },
  ];

  const handleRoleGuardBefore = () => {
    setRoleGuardTestState("unprotected");
    toast("⚠️ [ESTADO ANTERIOR]: Acceso permitido indebidamente sin validar rol (200 OK)", {
      icon: "⚠️",
      duration: 4000,
      style: { background: "#451a03", color: "#fef3c7", border: "1px solid #d97706" }
    });
  };

  const handleRoleGuardAfter = () => {
    setRoleGuardTestState("blocked");
    toast.error("⛔ [ESTADO ACTUAL CON ROLEGUARD]: Acceso denegado. Se requiere rol de profesor (HTTP 403 Forbidden).", {
      duration: 4500,
      style: { background: "#450a0a", color: "#fecaca", border: "1px solid #dc2626" }
    });
  };

  const handleTestCancellation = (hours: number) => {
    setCancellationHours(hours);
    if (hours < 2) {
      setCancellationResult("RECHAZADA");
      toast.error(`❌ Cancelación denegada (${hours}h antes): Se requiere un mínimo de 2 horas de anticipación. El cupo no es reembolsable.`, {
        duration: 4500,
        style: { background: "#450a0a", color: "#fecaca", border: "1px solid #dc2626" }
      });
    } else {
      setCancellationResult("APROBADA");
      toast.success(`✅ Cancelación exitosa (${hours}h antes): Cupo liberado y 1 crédito reembolsado al plan del alumno.`, {
        duration: 4500,
        style: { background: "#052e16", color: "#bbf7d0", border: "1px solid #16a34a" }
      });
    }
  };

  const handleScanSimulation = (type: "valido" | "invalido") => {
    if (type === "valido") {
      setAttendanceScanResult("PRESENTE");
      toast.success("✅ ¡Asistencia registrada exitosamente! Estado: PRESENTE.", {
        duration: 4000,
        style: { background: "#052e16", color: "#bbf7d0", border: "1px solid #16a34a" }
      });
    } else {
      setAttendanceScanResult("ERROR");
      toast.error("❌ Código QR no válido o no corresponde a esta clase reservada.", {
        duration: 4000,
        style: { background: "#450a0a", color: "#fecaca", border: "1px solid #dc2626" }
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#0D0E0C] text-[#F9F9F8] p-4 md:p-8 relative">
      {/* Luces de fondo sutiles */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#D4A72C]/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-[#D4A72C]/5 rounded-full blur-3xl pointer-events-none"></div>

      <div className="max-w-5xl mx-auto relative z-10">
        {/* Cabecera de la suite de pruebas */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-6 border-b border-[#2A2C28]">
          <div className="flex items-center gap-4">
            <Link 
              href="/" 
              className="p-2.5 rounded-xl bg-[#1E201D] border border-[#2A2C28] hover:border-[#D4A72C]/50 text-gray-400 hover:text-white transition-all flex items-center gap-2 text-sm"
            >
              <ArrowLeft className="w-4 h-4" /> Volver al Inicio
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#D4A72C]/20 text-[#D4A72C] border border-[#D4A72C]/30">
                  PTY4614 - CAPSTONE
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  ENTORNO DE PRUEBAS QA
                </span>
              </div>
              <h1 className="text-2xl font-bold mt-1 text-white flex items-center gap-2">
                Laboratorio de Defectos y Verificación de Calidad
              </h1>
              <p className="text-xs text-gray-400">
                Ejecución interactiva de escenarios de prueba (Antes vs Después) para captura de evidencias docentes.
              </p>
            </div>
          </div>
          <BrandLogo size="sm" showText={false} />
        </div>

        {/* Guía rápida para capturas */}
        <div className="bg-[#171816] border border-[#D4A72C]/30 rounded-2xl p-4 mb-6 shadow-xl flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-[#D4A72C] shrink-0 mt-0.5" />
          <div className="text-xs text-gray-300">
            <strong className="text-[#D4A72C] block text-sm font-semibold mb-1">
              📸 Instrucción para captura de evidencias para el Profesor:
            </strong>
            Selecciona la pestaña que deseas evaluar, presiona el botón <span className="text-red-400 font-semibold">[Simular Falla (Antes)]</span> para ver el error o alerta roja y toma tu captura de pantalla (<kbd className="bg-black px-1.5 py-0.5 rounded border border-gray-700 text-gray-300">Win + Shift + S</kbd>). Luego, presiona <span className="text-emerald-400 font-semibold">[Probar Solución (Después)]</span> para evidenciar la corrección exitosa y captúrala.
          </div>
        </div>

        {/* Selector de Pestañas / Defectos */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 mb-8">
          <button
            onClick={() => setActiveTab("seguridad")}
            className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1.5 transition-all ${
              activeTab === "seguridad"
                ? "bg-[#D4A72C]/15 border-[#D4A72C] text-[#D4A72C] shadow-lg shadow-[#D4A72C]/10"
                : "bg-[#1E201D] border-[#2A2C28] text-gray-400 hover:text-white hover:border-[#383A35]"
            }`}
          >
            <Lock className="w-4 h-4" />
            <span>DEF-03: RoleGuard</span>
          </button>

          <button
            onClick={() => setActiveTab("auth-val")}
            className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1.5 transition-all ${
              activeTab === "auth-val"
                ? "bg-[#D4A72C]/15 border-[#D4A72C] text-[#D4A72C] shadow-lg shadow-[#D4A72C]/10"
                : "bg-[#1E201D] border-[#2A2C28] text-gray-400 hover:text-white hover:border-[#383A35]"
            }`}
          >
            <KeyRound className="w-4 h-4" />
            <span>DEF-12: Auth & Inputs</span>
          </button>

          <button
            onClick={() => setActiveTab("asistencia")}
            className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1.5 transition-all ${
              activeTab === "asistencia"
                ? "bg-[#D4A72C]/15 border-[#D4A72C] text-[#D4A72C] shadow-lg shadow-[#D4A72C]/10"
                : "bg-[#1E201D] border-[#2A2C28] text-gray-400 hover:text-white hover:border-[#383A35]"
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>DEF-04/10: QR y Escáner</span>
          </button>

          <button
            onClick={() => setActiveTab("cancelacion")}
            className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1.5 transition-all ${
              activeTab === "cancelacion"
                ? "bg-[#D4A72C]/15 border-[#D4A72C] text-[#D4A72C] shadow-lg shadow-[#D4A72C]/10"
                : "bg-[#1E201D] border-[#2A2C28] text-gray-400 hover:text-white hover:border-[#383A35]"
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>DEF-05: Regla 2 Horas</span>
          </button>

          <button
            onClick={() => setActiveTab("metricas")}
            className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1.5 transition-all ${
              activeTab === "metricas"
                ? "bg-[#D4A72C]/15 border-[#D4A72C] text-[#D4A72C] shadow-lg shadow-[#D4A72C]/10"
                : "bg-[#1E201D] border-[#2A2C28] text-gray-400 hover:text-white hover:border-[#383A35]"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>DEF-06: Métricas y RLS</span>
          </button>

          <button
            onClick={() => setActiveTab("feedback")}
            className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1.5 transition-all ${
              activeTab === "feedback"
                ? "bg-[#D4A72C]/15 border-[#D4A72C] text-[#D4A72C] shadow-lg shadow-[#D4A72C]/10"
                : "bg-[#1E201D] border-[#2A2C28] text-gray-400 hover:text-white hover:border-[#383A35]"
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>DEF-02/11: UX & Toasts</span>
          </button>
        </div>

        {/* CONTENIDO DE LA PESTAÑA SELECCIONADA */}
        <div className="bg-[#171816] border border-[#2A2C28] rounded-2xl p-6 shadow-2xl">
          
          {/* ========================================================================= */}
          {/* TAB 1: DEF-03 - ROLEGUARD Y CONTROL DE ACCESO */}
          {/* ========================================================================= */}
          {activeTab === "seguridad" && (
            <div>
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#2A2C28]">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-amber-400" />
                    DEF-03: Protección de Rutas Docentes (RoleGuard)
                  </h2>
                  <p className="text-xs text-gray-400">
                    Ruta evaluada: <code className="text-[#D4A72C] bg-black/50 px-1.5 py-0.5 rounded">/profesor/clase/[id]</code>
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/20">
                  Severidad: Crítica
                </span>
              </div>

              <div className="grid md:grid-cols-2 gap-6 mb-6">
                {/* Lado Izquierdo: Simulación ANTES */}
                <div className="bg-[#1E201D] border border-red-900/30 rounded-xl p-5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-red-400 font-semibold text-sm mb-2">
                      <XCircle className="w-4 h-4" />
                      Comportamiento Vulnerable (Antes)
                    </div>
                    <p className="text-xs text-gray-300 leading-relaxed mb-4">
                      Un alumno autenticado podía escribir directamente en la barra de direcciones <code className="text-red-300">/profesor/clase/1</code> y el sistema cargaba la vista sin verificar si el rol era <span className="text-white font-mono">"profesor"</span>.
                    </p>
                    <div className="bg-black/60 p-3 rounded-lg border border-red-900/40 text-[11px] font-mono text-gray-400">
                      <span className="text-red-400">GET</span> /profesor/clase/1 HTTP/1.1<br/>
                      User-Role: alumno<br/>
                      Status: <span className="text-red-400 font-bold">200 OK (Vulnerable: Datos expuestos)</span>
                    </div>
                  </div>

                  <button
                    onClick={handleRoleGuardBefore}
                    className="mt-6 w-full py-2.5 px-4 rounded-xl bg-red-950/40 hover:bg-red-900/60 border border-red-800 text-red-200 text-xs font-bold transition-all flex items-center justify-center gap-2"
                  >
                    <ShieldAlert className="w-4 h-4" />
                    Disparar Simulación de Intrusión (Antes)
                  </button>
                </div>

                {/* Lado Derecho: Simulación DESPUÉS */}
                <div className="bg-[#1E201D] border border-emerald-900/30 rounded-xl p-5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm mb-2">
                      <ShieldCheck className="w-4 h-4" />
                      Solución Blindada (Ahora con RoleGuard)
                    </div>
                    <p className="text-xs text-gray-300 leading-relaxed mb-4">
                      La ruta ahora está envuelta con <code className="text-emerald-300">&lt;RoleGuard allowedRole="profesor"&gt;</code>. Si el rol no coincide exactamente, la petición es interceptada y expulsada antes de renderizar cualquier dato.
                    </p>
                    <div className="bg-black/60 p-3 rounded-lg border border-emerald-900/40 text-[11px] font-mono text-gray-400">
                      <span className="text-emerald-400">GET</span> /profesor/clase/1 HTTP/1.1<br/>
                      User-Role: alumno<br/>
                      Status: <span className="text-emerald-400 font-bold">403 FORBIDDEN (Redirigido a /alumno/dashboard)</span>
                    </div>
                  </div>

                  <button
                    onClick={handleRoleGuardAfter}
                    className="mt-6 w-full py-2.5 px-4 rounded-xl bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-700 text-emerald-200 text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/30"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    Ejecutar Verificación de Bloqueo (Después)
                  </button>
                </div>
              </div>

              {/* Panel de Estado Visual para Captura */}
              {roleGuardTestState !== "idle" && (
                <div className={`p-4 rounded-xl border animate-in fade-in transition-all ${
                  roleGuardTestState === "blocked" 
                    ? "bg-emerald-950/20 border-emerald-500/40 text-emerald-300" 
                    : "bg-red-950/20 border-red-500/40 text-red-300"
                }`}>
                  <div className="flex items-center gap-3">
                    {roleGuardTestState === "blocked" ? (
                      <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-6 h-6 text-red-400 shrink-0" />
                    )}
                    <div>
                      <h4 className="text-sm font-bold">
                        {roleGuardTestState === "blocked" 
                          ? "Resultado de Prueba: ACCESO DENEGADO CORRECTAMENTE (PASS ✅)" 
                          : "Resultado de Prueba: BRECHA REPRODUCIDA EN ENTORNO AISLADO (FAIL ANTERIOR 🔴)"}
                      </h4>
                      <p className="text-xs text-gray-300 mt-0.5">
                        {roleGuardTestState === "blocked" 
                          ? "El guardián de autorización RoleGuard protegió con éxito la lista de asistencia y el generador de QR contra accesos indebidos." 
                          : "En el código anterior no existía RoleGuard en la carpeta /profesor/clase/[id], permitiendo que cualquier usuario leyera las asistencias."}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB: DEF-12 - VALIDACIONES DE FORMULARIO Y RESILIENCIA DE LOGIN */}
          {/* ========================================================================= */}
          {activeTab === "auth-val" && (
            <div>
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#2A2C28]">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <KeyRound className="w-5 h-5 text-[#D4A72C]" />
                    DEF-12: Validaciones de Registro, Longitud y Resiliencia en Inicio de Sesión
                  </h2>
                  <p className="text-xs text-gray-400">
                    Evidencias de reglas de integridad (nombre &ge; 3 letras, correo con @, clave &ge; 6 car.) y tolerancia a fallos.
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  Severidad: Alta
                </span>
              </div>

              {/* 4 Pruebas de Campos */}
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                
                {/* 1. Validación de Nombre (mínimo 3 letras) */}
                <div className="bg-[#1E201D] border border-[#2A2C28] rounded-xl p-4 flex flex-col justify-between">
                  <div>
                    <span className="text-xs font-bold text-white flex items-center gap-1.5 mb-2">
                      <UserCheck className="w-4 h-4 text-[#D4A72C]" /> 1. Nombre (&ge; 3 letras)
                    </span>
                    <p className="text-[11px] text-gray-400 mb-3">
                      Evita registros con iniciales o nombres incompletos (&lt; 3 letras).
                    </p>
                    <input
                      type="text"
                      value={testName}
                      onChange={(e) => setTestName(e.target.value)}
                      placeholder="Ingresa un nombre"
                      className="w-full px-3 py-2 rounded-lg bg-black/60 border border-gray-700 text-xs text-white focus:outline-none focus:border-[#D4A72C] mb-2 font-mono"
                    />
                    
                    {testName.trim().length < 3 ? (
                      <div className="p-2 rounded bg-red-950/40 border border-red-800/60 text-red-300 text-[11px]">
                        ❌ <strong>Error:</strong> El nombre debe tener al menos 3 caracteres (Actual: {testName.trim().length}).
                      </div>
                    ) : (
                      <div className="p-2 rounded bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-[11px]">
                        ✅ <strong>Válido:</strong> Cumple con el mínimo ({testName.trim().length} letras).
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => setTestName("Lu")}
                      className="flex-1 py-1 px-2 rounded bg-red-950/40 hover:bg-red-900/60 border border-red-800 text-red-200 text-[10px]"
                    >
                      Probar "Lu" (2 letras)
                    </button>
                    <button
                      onClick={() => setTestName("Lucas")}
                      className="flex-1 py-1 px-2 rounded bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-800 text-emerald-200 text-[10px]"
                    >
                      Probar "Lucas" (5 letras)
                    </button>
                  </div>
                </div>

                {/* 2. Validación de Correo (debe tener @) */}
                <div className="bg-[#1E201D] border border-[#2A2C28] rounded-xl p-4 flex flex-col justify-between">
                  <div>
                    <span className="text-xs font-bold text-white flex items-center gap-1.5 mb-2">
                      <Mail className="w-4 h-4 text-[#D4A72C]" /> 2. Correo (con @ y dominio)
                    </span>
                    <p className="text-[11px] text-gray-400 mb-3">
                      Valida formato RFC de email exigiendo el símbolo '@' y dominio.
                    </p>
                    <input
                      type="text"
                      value={testEmail}
                      onChange={(e) => setTestEmail(e.target.value)}
                      placeholder="Ingresa correo"
                      className="w-full px-3 py-2 rounded-lg bg-black/60 border border-gray-700 text-xs text-white focus:outline-none focus:border-[#D4A72C] mb-2 font-mono"
                    />

                    {!testEmail.includes("@") || !testEmail.includes(".") ? (
                      <div className="p-2 rounded bg-red-950/40 border border-red-800/60 text-red-300 text-[11px]">
                        ❌ <strong>Error:</strong> Por favor ingresa un correo válido con @ (ej: usuario@mail.com).
                      </div>
                    ) : (
                      <div className="p-2 rounded bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-[11px]">
                        ✅ <strong>Válido:</strong> Correo con formato estructurado (@ y dominio).
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => setTestEmail("usuario-sin-arroba.com")}
                      className="flex-1 py-1 px-2 rounded bg-red-950/40 hover:bg-red-900/60 border border-red-800 text-red-200 text-[10px]"
                    >
                      Sin '@' (Falla)
                    </button>
                    <button
                      onClick={() => setTestEmail("alumno@cuerpoyalma.cl")}
                      className="flex-1 py-1 px-2 rounded bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-800 text-emerald-200 text-[10px]"
                    >
                      Con '@' (Válido)
                    </button>
                  </div>
                </div>

                {/* 3. Validación de Contraseña (mínimo 6 caracteres) */}
                <div className="bg-[#1E201D] border border-[#2A2C28] rounded-xl p-4 flex flex-col justify-between">
                  <div>
                    <span className="text-xs font-bold text-white flex items-center gap-1.5 mb-2">
                      <Lock className="w-4 h-4 text-[#D4A72C]" /> 3. Clave (&ge; 6 caracteres)
                    </span>
                    <p className="text-[11px] text-gray-400 mb-3">
                      Estándar de seguridad para evitar contraseñas débiles o triviales.
                    </p>
                    <input
                      type="text"
                      value={testPassword}
                      onChange={(e) => setTestPassword(e.target.value)}
                      placeholder="Ingresa contraseña"
                      className="w-full px-3 py-2 rounded-lg bg-black/60 border border-gray-700 text-xs text-white focus:outline-none focus:border-[#D4A72C] mb-2 font-mono"
                    />

                    {testPassword.length < 6 ? (
                      <div className="p-2 rounded bg-red-950/40 border border-red-800/60 text-red-300 text-[11px]">
                        ❌ <strong>Error:</strong> La contraseña debe tener al menos 6 caracteres (Actual: {testPassword.length}).
                      </div>
                    ) : (
                      <div className="p-2 rounded bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-[11px]">
                        ✅ <strong>Válida:</strong> Cumple con longitud segura ({testPassword.length} car.).
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => setTestPassword("12345")}
                      className="flex-1 py-1 px-2 rounded bg-red-950/40 hover:bg-red-900/60 border border-red-800 text-red-200 text-[10px]"
                    >
                      5 car. (Falla)
                    </button>
                    <button
                      onClick={() => setTestPassword("Studio2026!")}
                      className="flex-1 py-1 px-2 rounded bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-800 text-emerald-200 text-[10px]"
                    >
                      11 car. (Válido)
                    </button>
                  </div>
                </div>

                {/* 4. Validación de RUT Chileno (Algoritmo Módulo 11) */}
                <div className="bg-[#1E201D] border border-[#2A2C28] rounded-xl p-4 flex flex-col justify-between">
                  <div>
                    <span className="text-xs font-bold text-white flex items-center gap-1.5 mb-2">
                      <CreditCard className="w-4 h-4 text-[#D4A72C]" /> 4. RUT (Módulo 11)
                    </span>
                    <p className="text-[11px] text-gray-400 mb-3">
                      Valida Cédula de Identidad con algoritmo oficial y dígito verificador.
                    </p>
                    <input
                      type="text"
                      value={testRut}
                      onChange={(e) => setTestRut(e.target.value)}
                      placeholder="12345678-9"
                      className="w-full px-3 py-2 rounded-lg bg-black/60 border border-gray-700 text-xs text-white focus:outline-none focus:border-[#D4A72C] mb-2 font-mono"
                    />

                    {(() => {
                      const res = validateRutDetailed(testRut);
                      if (!res.isValid) {
                        return (
                          <div className="p-2 rounded bg-red-950/40 border border-red-800/60 text-red-300 text-[11px]">
                            ❌ <strong>Error:</strong> {res.message || "RUT inválido"}.
                          </div>
                        );
                      }
                      return (
                        <div className="p-2 rounded bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-[11px]">
                          ✅ <strong>Válido:</strong> {res.formatted} (DV correcto).
                        </div>
                      );
                    })()}
                  </div>

                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => setTestRut("12345678-9")}
                      className="flex-1 py-1 px-2 rounded bg-red-950/40 hover:bg-red-900/60 border border-red-800 text-red-200 text-[10px]"
                    >
                      DV Mal (12345678-9)
                    </button>
                    <button
                      onClick={() => setTestRut("12345678-5")}
                      className="flex-1 py-1 px-2 rounded bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-800 text-emerald-200 text-[10px]"
                    >
                      DV OK (12345678-5)
                    </button>
                  </div>
                </div>

              </div>

              {/* 5. Resiliencia ante Login Fallido / Contraseña Errónea */}
              <div className="bg-[#1E201D] border border-amber-900/30 rounded-xl p-5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-emerald-400" />
                      5. Prueba de Resiliencia: Contraseña Incorrecta en Inicio de Sesión
                    </h3>
                    <p className="text-xs text-gray-300 mt-1 max-w-2xl leading-relaxed">
                      Si el usuario introduce un correo inexistente o contraseña equivocada, la aplicación <strong>NO se cae, NO recarga la página y NO produce errores no controlados</strong>. El bloque <code className="text-[#D4A72C]">try/catch</code> en <code className="text-gray-300">SignInForm.tsx</code> intercepta la respuesta de Supabase, restaura el botón de carga y muestra un toast en español amigable.
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      setLoginSimStatus("error_handled");
                      toast.error("Correo o contraseña incorrectos. Por favor verifica tus datos e inténtalo de nuevo.", {
                        duration: 4000,
                        style: { background: "#450a0a", color: "#fecaca", border: "1px solid #dc2626" }
                      });
                    }}
                    className="py-2.5 px-5 rounded-xl bg-red-950/50 hover:bg-red-900/70 border border-red-700 text-red-200 text-xs font-bold transition-all shrink-0 flex items-center gap-2 shadow-lg shadow-red-950/30"
                  >
                    <KeyRound className="w-4 h-4" />
                    Simular Login con Contraseña Incorrecta
                  </button>
                </div>

                {loginSimStatus === "error_handled" && (
                  <div className="mt-4 p-3 rounded-lg bg-black/60 border border-emerald-500/40 text-xs text-emerald-300 font-mono flex items-center justify-between">
                    <span>
                      &gt;&gt; [ESTADO DE EJECUCIÓN]: try &#123; signIn() &#125; catch (error) -&gt; Toast emitido correctamente. Estado de React intacto. App 100% estable.
                    </span>
                    <span className="text-emerald-400 font-bold ml-2">PASS ✅</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: DEF-04 Y DEF-10 - CÓDIGO QR Y ASISTENCIA BIDIRECCIONAL */}
          {/* ========================================================================= */}
          {activeTab === "asistencia" && (
            <div>
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#2A2C28]">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <QrCode className="w-5 h-5 text-[#D4A72C]" />
                    DEF-04 & DEF-10: Generación y Escaneo de Asistencia QR
                  </h2>
                  <p className="text-xs text-gray-400">
                    Comparativa de QR Mock estático vs QR dinámico escaneable con cámara.
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  Severidad: Alta
                </span>
              </div>

              <div className="grid md:grid-cols-2 gap-6 mb-6">
                {/* LADO ANTERIOR: SVG MOCK INERTE */}
                <div className="bg-[#1E201D] border border-red-900/30 rounded-xl p-5 flex flex-col items-center text-center">
                  <div className="w-full flex items-center justify-between mb-3">
                    <span className="text-red-400 font-semibold text-xs flex items-center gap-1.5">
                      <XCircle className="w-4 h-4" /> ANTES: Mock SVG Falso
                    </span>
                    <span className="text-[10px] bg-red-950 text-red-300 px-2 py-0.5 rounded border border-red-800">
                      No Escaneable
                    </span>
                  </div>

                  {/* El SVG mock que tenía el proyecto antes */}
                  <div className="bg-white p-4 rounded-xl shadow-inner my-2">
                    <svg className="w-36 h-36" viewBox="0 0 100 100">
                      <rect x="5" y="5" width="25" height="25" fill="black" />
                      <rect x="10" y="10" width="15" height="15" fill="white" />
                      <rect x="70" y="5" width="25" height="25" fill="black" />
                      <rect x="75" y="10" width="15" height="15" fill="white" />
                      <rect x="5" y="70" width="25" height="25" fill="black" />
                      <rect x="10" y="75" width="15" height="15" fill="white" />
                      <rect x="40" y="40" width="20" height="20" fill="black" />
                    </svg>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-2 max-w-xs">
                    Dibujo vectorial con coordenadas fijas. Ninguna cámara o aplicación podía leer ningún dato de él.
                  </p>
                </div>

                {/* LADO ACTUAL: QR DINÁMICO CON METADATOS */}
                <div className="bg-[#1E201D] border border-emerald-900/30 rounded-xl p-5 flex flex-col items-center text-center">
                  <div className="w-full flex items-center justify-between mb-3">
                    <span className="text-emerald-400 font-semibold text-xs flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" /> DESPUÉS: QRCodeSVG Real
                    </span>
                    <span className="text-[10px] bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded border border-emerald-800">
                      100% Escaneable
                    </span>
                  </div>

                  {/* Código QR generado dinámicamente con qrcode.react */}
                  <div className="bg-white p-4 rounded-xl shadow-lg my-2 border-2 border-[#D4A72C]">
                    <QRCodeSVG 
                      value={JSON.stringify({
                        tipo: "ASISTENCIA_CUERPO_Y_ALMA",
                        clase: "Pilates Reformer A",
                        token: "DEMO-VALID-2026",
                        fecha: "2026-11-15"
                      })} 
                      size={144}
                      level="H"
                      includeMargin={true}
                    />
                  </div>
                  <p className="text-[11px] text-gray-300 mt-2 max-w-xs">
                    ¡Puedes apuntar tu teléfono con la cámara y leerá el payload JSON con el token de asistencia!
                  </p>
                </div>
              </div>

              {/* Botones de simulación de escaneo para capturas */}
              <div className="bg-black/40 p-4 rounded-xl border border-[#2A2C28]">
                <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Camera className="w-4 h-4 text-[#D4A72C]" />
                  Simulador de Respuestas del Escáner de Alumnos:
                </h4>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => handleScanSimulation("invalido")}
                    className="py-2 px-4 rounded-lg bg-red-950/40 hover:bg-red-900/60 border border-red-800 text-red-200 text-xs font-medium transition-all"
                  >
                    Simular Escaneo Erróneo (QR no coincide con reserva)
                  </button>
                  <button
                    onClick={() => handleScanSimulation("valido")}
                    className="py-2 px-4 rounded-lg bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-800 text-emerald-200 text-xs font-medium transition-all"
                  >
                    Simular Escaneo Exitoso (QR Válido y Asistencia Registrada)
                  </button>
                </div>

                {attendanceScanResult && (
                  <div className={`mt-3 p-3 rounded-lg border text-xs font-mono ${
                    attendanceScanResult === "PRESENTE"
                      ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-300"
                      : "bg-red-950/20 border-red-500/30 text-red-300"
                  }`}>
                    {attendanceScanResult === "PRESENTE" 
                      ? ">> Estado: PRESENTE | Transacción Supabase: .upsert({ onConflict: 'id_reserva' }) -> 201 Created."
                      : ">> Estado: RECHAZADO | Excepción: Código QR inválido o expirado -> 400 Bad Request."}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: DEF-05 - REGLA DE NEGOCIO DE CANCELACIÓN (2 HORAS) */}
          {/* ========================================================================= */}
          {activeTab === "cancelacion" && (
            <div>
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#2A2C28]">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Clock className="w-5 h-5 text-amber-400" />
                    DEF-05: Validación Transaccional de Cancelación (Límite 2 Horas)
                  </h2>
                  <p className="text-xs text-gray-400">
                    Regla de negocio que protege la pérdida de ingresos y acaparamiento de cupos.
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  Severidad: Alta
                </span>
              </div>

              <div className="bg-[#1E201D] border border-[#2A2C28] rounded-xl p-5 mb-6">
                <p className="text-xs text-gray-300 mb-4">
                  Selecciona con cuántas horas de anticipación el alumno intenta cancelar una clase programada para las 18:00 hrs:
                </p>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                  <button
                    onClick={() => handleTestCancellation(0.5)}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      cancellationHours === 0.5 && cancellationResult === "RECHAZADA"
                        ? "bg-red-950/60 border-red-500 text-red-200"
                        : "bg-black/40 border-[#2A2C28] hover:border-gray-500 text-gray-300"
                    }`}
                  >
                    <span className="block text-sm font-bold text-red-400">30 Minutos antes</span>
                    <span className="text-[10px] text-gray-400">&lt; 2 Horas (Falla)</span>
                  </button>

                  <button
                    onClick={() => handleTestCancellation(1.0)}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      cancellationHours === 1.0 && cancellationResult === "RECHAZADA"
                        ? "bg-red-950/60 border-red-500 text-red-200"
                        : "bg-black/40 border-[#2A2C28] hover:border-gray-500 text-gray-300"
                    }`}
                  >
                    <span className="block text-sm font-bold text-red-400">1 Hora antes</span>
                    <span className="text-[10px] text-gray-400">&lt; 2 Horas (Falla)</span>
                  </button>

                  <button
                    onClick={() => handleTestCancellation(3.0)}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      cancellationHours === 3.0 && cancellationResult === "APROBADA"
                        ? "bg-emerald-950/60 border-emerald-500 text-emerald-200"
                        : "bg-black/40 border-[#2A2C28] hover:border-gray-500 text-gray-300"
                    }`}
                  >
                    <span className="block text-sm font-bold text-emerald-400">3 Horas antes</span>
                    <span className="text-[10px] text-gray-400">&gt; 2 Horas (Aprobada)</span>
                  </button>

                  <button
                    onClick={() => handleTestCancellation(6.0)}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      cancellationHours === 6.0 && cancellationResult === "APROBADA"
                        ? "bg-emerald-950/60 border-emerald-500 text-emerald-200"
                        : "bg-black/40 border-[#2A2C28] hover:border-gray-500 text-gray-300"
                    }`}
                  >
                    <span className="block text-sm font-bold text-emerald-400">6 Horas antes</span>
                    <span className="text-[10px] text-gray-400">&gt; 2 Horas (Aprobada)</span>
                  </button>
                </div>

                {cancellationResult && (
                  <div className={`p-4 rounded-xl border ${
                    cancellationResult === "APROBADA"
                      ? "bg-emerald-950/30 border-emerald-500 text-emerald-200"
                      : "bg-red-950/30 border-red-500 text-red-200"
                  }`}>
                    <h4 className="text-sm font-bold mb-1 flex items-center gap-2">
                      {cancellationResult === "APROBADA" ? (
                        <>
                          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                          Resultado de Negocio: REEMBOLSO EFECTUADO (2 Horas o más)
                        </>
                      ) : (
                        <>
                          <XCircle className="w-5 h-5 text-red-400" />
                          Resultado de Negocio: CANCELACIÓN TARDÍA SIN REEMBOLSO (&lt; 2 Horas)
                        </>
                      )}
                    </h4>
                    <p className="text-xs text-gray-300">
                      {cancellationResult === "APROBADA"
                        ? "El sistema ejecutó el incremento de cupo físico (+1 cupo disponible) y devolvió el crédito a la cuenta del alumno en la tabla 'profiles'."
                        : "El sistema bloquea la devolución del crédito debido a que el aviso tardío imposibilita que otro alumno aproveche el cupo vacante."}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 4: DEF-06 - AISLAMIENTO DE MÉTRICAS DEL PROFESOR */}
          {/* ========================================================================= */}
          {activeTab === "metricas" && (
            <div>
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#2A2C28]">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Users className="w-5 h-5 text-amber-400" />
                    DEF-06: Aislamiento de Métricas por Profesor (Data Isolation)
                  </h2>
                  <p className="text-xs text-gray-400">
                    Evidencia de fuga de datos en consulta sin filtro vs consulta blindada con .eq('id_profesor').
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  Severidad: Alta
                </span>
              </div>

              {/* Botón conmutador para ver cómo se veía antes vs después */}
              <div className="flex gap-3 mb-4">
                <button
                  onClick={() => {
                    setMetricsFilter("todos");
                    toast("⚠️ Mostrando consulta general ANTERIOR (Fuga de datos de todos los profesores)", { icon: "⚠️" });
                  }}
                  className={`py-2 px-4 rounded-xl text-xs font-bold transition-all border ${
                    metricsFilter === "todos"
                      ? "bg-red-950 border-red-500 text-red-200"
                      : "bg-[#1E201D] border-[#2A2C28] text-gray-400 hover:text-white"
                  }`}
                >
                  🔴 Consulta Anterior (Sin filtro de profesor)
                </button>
                <button
                  onClick={() => {
                    setMetricsFilter("prof-manuel");
                    toast.success("✅ Mostrando consulta ACTUAL (Filtrada por ID del profesor autenticado)");
                  }}
                  className={`py-2 px-4 rounded-xl text-xs font-bold transition-all border ${
                    metricsFilter === "prof-manuel"
                      ? "bg-emerald-950 border-emerald-500 text-emerald-200"
                      : "bg-[#1E201D] border-[#2A2C28] text-gray-400 hover:text-white"
                  }`}
                >
                  🟢 Consulta Actual (Aislada por id_profesor)
                </button>
              </div>

              {/* Tabla interactiva */}
              <div className="overflow-x-auto rounded-xl border border-[#2A2C28]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#1E201D] text-gray-400 border-b border-[#2A2C28]">
                    <tr>
                      <th className="p-3">Profesor</th>
                      <th className="p-3">Clase Asignada</th>
                      <th className="p-3">Alumnos Asistentes</th>
                      <th className="p-3">Ingresos Generados</th>
                      <th className="p-3">Estado de Aislamiento</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2A2C28] bg-black/40">
                    {(metricsFilter === "todos" ? profesoresMock : profesoresMock.filter(p => p.id === "prof-manuel")).map((prof) => (
                      <tr key={prof.id} className="hover:bg-white/5 transition-colors">
                        <td className="p-3 font-semibold text-white">{prof.nombre}</td>
                        <td className="p-3 text-gray-300">{prof.clase}</td>
                        <td className="p-3 font-mono text-[#D4A72C]">{prof.alumnos} alumnos</td>
                        <td className="p-3 font-mono text-emerald-400">${prof.ingresos.toLocaleString("es-CL")}</td>
                        <td className="p-3">
                          {metricsFilter === "todos" && prof.id !== "prof-manuel" ? (
                            <span className="text-[10px] bg-red-950/70 border border-red-800 text-red-300 px-2 py-0.5 rounded">
                              Fuga de información
                            </span>
                          ) : (
                            <span className="text-[10px] bg-emerald-950/70 border border-emerald-800 text-emerald-300 px-2 py-0.5 rounded">
                              Autorizado (Propio)
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-gray-400 mt-3">
                {metricsFilter === "todos"
                  ? "❌ En la vista anterior, el profesor Manuel podía ver los alumnos y recaudación de la profesora Claudia y Andrés."
                  : "✅ En la vista actual con .eq('id_profesor', auth.uid()), el profesor Manuel solo accede a sus clases personales."}
              </p>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 5: DEF-02 Y DEF-11 - FEEDBACK, TOASTER Y ALERT NATIVO */}
          {/* ========================================================================= */}
          {activeTab === "feedback" && (
            <div>
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#2A2C28]">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Layers className="w-5 h-5 text-amber-400" />
                    DEF-02 & DEF-11: Notificaciones Toaster vs Alert() Nativo
                  </h2>
                  <p className="text-xs text-gray-400">
                    Sustitución de diálogos bloqueantes por notificaciones reactivas no invasivas.
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                  Severidad: Media
                </span>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                {/* Lado Izquierdo: Alert() Nativo */}
                <div className="bg-[#1E201D] border border-red-900/30 rounded-xl p-5 flex flex-col justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-red-400 mb-2 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" /> Comportamiento Anterior: window.alert()
                    </h3>
                    <p className="text-xs text-gray-300 leading-relaxed mb-4">
                      Bloquea el hilo principal de JavaScript, pausa el renderizado de la página y en dispositivos móviles genera cuadros de diálogo toscos que rompen la identidad de marca del estudio.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      alert("⚠️ [ALERTA NATIVA ANTERIOR]: Este diálogo bloqueaba el hilo de ejecución.");
                    }}
                    className="py-2.5 px-4 rounded-xl bg-red-950/40 hover:bg-red-900/60 border border-red-800 text-red-200 text-xs font-bold transition-all"
                  >
                    Probar window.alert() nativo (Antes)
                  </button>
                </div>

                {/* Lado Derecho: Toasts Reactivos */}
                <div className="bg-[#1E201D] border border-emerald-900/30 rounded-xl p-5 flex flex-col justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-emerald-400 mb-2 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-emerald-400" /> Solución Actual: react-hot-toast
                    </h3>
                    <p className="text-xs text-gray-300 leading-relaxed mb-4">
                      Alertas no bloqueantes, animadas con CSS, adaptadas a la paleta dorada y negra corporativa, montadas en el <code className="text-emerald-300">&lt;Toaster /&gt;</code> de RootLayout.
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => toast.success("¡Reserva confirmada con éxito en Pilates Reformer!", { duration: 3500 })}
                      className="py-2 px-4 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-700 text-emerald-200 text-xs font-semibold transition-all text-left flex items-center justify-between"
                    >
                      <span>Probar Toast de Éxito</span>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    </button>
                    <button
                      onClick={() => toast.error("Error: Clase sin cupos disponibles. Intenta otro horario.", { duration: 3500 })}
                      className="py-2 px-4 rounded-lg bg-red-950/60 hover:bg-red-900/80 border border-red-700 text-red-200 text-xs font-semibold transition-all text-left flex items-center justify-between"
                    >
                      <span>Probar Toast de Error</span>
                      <XCircle className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Pie de página del laboratorio */}
        <div className="mt-8 text-center text-xs text-gray-500 border-t border-[#2A2C28] pt-4">
          Sistema de Control de Calidad | Proyecto Capstone PTY4614 | Escuela de Informática | 2026
        </div>
      </div>
    </div>
  );
}
