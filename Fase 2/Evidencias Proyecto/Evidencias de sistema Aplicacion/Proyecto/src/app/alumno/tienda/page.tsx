"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import toast from "react-hot-toast";

export default function TiendaPage() {
  const [planes, setPlanes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Payment Modal State
  const [selectedPlan, setSelectedPlan] = useState<any | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"transferencia" | "integrado">("integrado");
  const [comprobanteUrl, setComprobanteUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchPlanes();
  }, []);

  async function fetchPlanes() {
    try {
      if (!supabase) return;
      const { data, error } = await supabase
        .from("planes")
        .select("*")
        .eq("estado", true)
        .order("precio", { ascending: false });
      
      if (error) throw error;
      setPlanes(data || []);
    } catch (error) {
      console.error("Error fetching planes:", error);
    } finally {
      setIsLoading(false);
    }
  }

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const procesarCompra = async () => {
    if (!selectedPlan || !paymentMethod) return;

    if (paymentMethod === "transferencia" && !comprobanteUrl.trim()) {
      toast.error("Por favor adjunta o ingresa el comprobante de transferencia.");
      return;
    }

    setIsProcessing(true);
    try {
      if (!supabase) throw new Error("Supabase no inicializado");
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No hay usuario autenticado. Por favor inicia sesión.");
      const userId = user.id;

      // ==========================================
      // FLUJO 1: PAGO EN LÍNEA CON WEBPAY PLUS
      // ==========================================
      if (paymentMethod === "integrado") {
        toast.loading("Iniciando conexión con Transbank Webpay Plus...", { id: "webpay-init" });

        const res = await fetch("/api/webpay/crear", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            planId: selectedPlan.id_plan,
            userId: userId,
          }),
        });

        const result = await res.json();
        toast.dismiss("webpay-init");

        if (!res.ok || !result.ok) {
          throw new Error(result.mensaje || "No se pudo iniciar el pago en Webpay");
        }

        // Redirigir a Webpay
        if (result.url.startsWith("/") || result.url.includes("simulador-webpay")) {
          window.location.href = result.url;
        } else {
          // Envío estándar oficial de formulario POST a Transbank Webpay
          const form = document.createElement("form");
          form.method = "POST";
          form.action = result.url;

          const tokenInput = document.createElement("input");
          tokenInput.type = "hidden";
          tokenInput.name = "token_ws";
          tokenInput.value = result.token;

          form.appendChild(tokenInput);
          document.body.appendChild(form);
          form.submit();
        }
        return;
      }

      // ==========================================
      // FLUJO 2: TRANSFERENCIA MANUAL
      // ==========================================
      const isManual = true;
      const estadoSub = "pendiente";
      const estadoPago = "pendiente";
      const creditos = 0;

      // 1. Crear Suscripcion
      const { data: subData, error: subError } = await supabase.from("user_suscripciones").insert({
        user_id: userId,
        plan_id: selectedPlan.id_plan,
        estado: estadoSub,
        fecha_inicio: null,
        fecha_fin: null,
        creditos_restantes: creditos
      }).select("id").single();

      if (subError) throw subError;

      // 2. Crear Pago
      const { error: pagoError } = await supabase.from("user_pagos").insert({
        suscripcion_id: subData.id,
        user_id: userId,
        monto: selectedPlan.precio,
        metodo_pago: "transferencia",
        estado: estadoPago,
        comprobante_url: comprobanteUrl
      });

      if (pagoError) throw pagoError;

      setSelectedPlan(null);
      setComprobanteUrl("");
      showToast("¡Comprobante enviado! El administrador lo revisará pronto.");
      
    } catch (error: any) {
      console.error("Error al procesar compra:", error);
      toast.error(error?.message || "Error al procesar la compra. Intenta nuevamente.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col w-full pb-bottom-nav-safe min-h-screen bg-surface relative">
      <div className="flex flex-col px-margin-mobile gap-space-lg pt-space-md">
        
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-on-surface">
            <span className="material-symbols-outlined text-[28px] text-primary">storefront</span>
            <h1 className="font-headline-sm text-headline-sm text-on-surface font-bold">Planes Disponibles</h1>
          </div>
          <button className="flex items-center text-secondary font-label-md">
            <span className="material-symbols-outlined text-[20px]">filter_list</span>
            Filtrar
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center p-10"><span className="material-symbols-outlined animate-spin text-primary text-3xl">refresh</span></div>
        ) : planes.length === 0 ? (
          <div className="p-8 bg-surface-container-low border border-surface-container rounded-2xl text-center flex flex-col items-center">
            <span className="material-symbols-outlined text-[48px] text-secondary mb-3">production_quantity_limits</span>
            <h3 className="font-headline-sm text-on-surface">Sin planes disponibles</h3>
            <p className="font-body-sm text-on-surface-variant mt-1">Actualmente no hay planes a la venta. Por favor consulta más tarde.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {(() => {
              const maxVentas = Math.max(0, ...planes.map(p => p.ventas || 0));
              const destacadoId = maxVentas > 0 
                ? planes.find(p => (p.ventas || 0) === maxVentas)?.id_plan 
                : planes[0]?.id_plan;

              return planes.map((plan) => {
                const isDestacado = plan.id_plan === destacadoId;
                
                return (
                <div key={plan.id_plan} onClick={() => setSelectedPlan(plan)} className={`flex flex-col rounded-2xl border shadow-sm p-space-lg gap-space-md cursor-pointer hover:shadow-md transition-all active:scale-[0.99] hover:border-primary/50 ${isDestacado ? 'bg-surface-container-lowest border-primary/30 border-2' : 'bg-surface-container-low border-surface-container'}`}>
                  {isDestacado && (
                    <div className="flex items-center gap-1.5 text-primary">
                      <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: '"FILL" 1' }}>star</span>
                      <span className="font-label-md font-bold uppercase tracking-wider">Plan destacado</span>
                    </div>
                  )}
                  
                  <div className="flex items-end justify-between border-b border-surface-container pb-3">
                    <span className={`font-label-lg font-bold ${isDestacado ? 'text-primary' : 'text-on-surface-variant'}`}>
                      {plan.duracion_dias} días
                    </span>
                    <span className="font-headline-sm font-bold gradient-text">
                      $ {plan.precio.toLocaleString()}
                    </span>
                  </div>

                  <h2 className="font-headline-sm text-[22px] text-on-surface leading-snug">
                    {plan.nombre_plan}
                  </h2>

                  <ul className="flex flex-col gap-3 mt-1">
                    <li className="flex items-start gap-3">
                      <span className={`material-symbols-outlined text-[20px] mt-0.5 ${isDestacado ? 'text-primary' : 'text-secondary'}`}>database</span>
                      <div className="flex flex-col">
                        <span className="font-body-md text-on-surface font-medium">Incluye {plan.creditos_clases} cupos</span>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className={`material-symbols-outlined text-[20px] mt-0.5 ${isDestacado ? 'text-primary' : 'text-secondary'}`}>fitness_center</span>
                      <div className="flex flex-col">
                        <span className="font-body-md text-on-surface font-medium">Disciplinas</span>
                        <span className="font-body-sm text-[13px] text-on-surface-variant">{plan.disciplinas_incluidas}</span>
                      </div>
                    </li>
                  </ul>

                  <p className="font-body-sm text-[13px] text-on-surface-variant mt-2 mb-2 leading-relaxed italic border-l-2 border-surface-container-highest pl-3">
                    {plan.descripcion}
                  </p>

                  <button 
                    onClick={() => setSelectedPlan(plan)}
                    className={`w-full h-14 rounded-xl font-label-lg font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-sm ${isDestacado ? 'bg-primary text-on-primary' : 'bg-surface-container-highest text-on-surface'}`}
                  >
                    Adquirir
                    <span className="material-symbols-outlined text-[20px]">shopping_cart_checkout</span>
                  </button>
                </div>
              );
            })})()}
          </div>
        )}
      </div>

      {/* PAYMENT MODAL */}
      {selectedPlan && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-surface/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-surface-container-lowest w-full sm:w-[440px] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col animate-in slide-in-from-bottom-10 max-h-[90vh] overflow-y-auto border border-surface-container">
            
            <div className="flex justify-between items-center p-4 border-b border-surface-container sticky top-0 bg-surface-container-lowest z-10">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">payments</span>
                <h3 className="font-headline-sm text-on-surface font-bold">Método de Pago</h3>
              </div>
              <button 
                onClick={() => { setSelectedPlan(null); }} 
                className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="p-5 pb-24 flex flex-col gap-5">
              
              {/* Resumen del plan */}
              <div className="bg-surface-container-low p-4 rounded-2xl border border-surface-container flex flex-col gap-1">
                <div className="flex justify-between items-center">
                  <span className="font-label-md font-bold text-on-surface">{selectedPlan.nombre_plan}</span>
                  <span className="font-headline-sm font-black gradient-text">${selectedPlan.precio.toLocaleString()} CLP</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-on-surface-variant font-medium mt-1">
                  <span>📅 {selectedPlan.duracion_dias} días de vigencia</span>
                  <span>•</span>
                  <span>🎟️ {selectedPlan.creditos_clases} clases incluidas</span>
                </div>
              </div>

              {/* Selector de Métodos de Pago */}
              <div className="flex flex-col gap-3">
                
                {/* Opción 1: Webpay Plus */}
                <button 
                  type="button"
                  onClick={() => setPaymentMethod("integrado")}
                  className={`p-4 rounded-2xl border-2 flex items-start gap-3.5 transition-all text-left ${
                    paymentMethod === 'integrado' 
                      ? 'border-primary bg-primary/5 shadow-sm' 
                      : 'border-surface-container bg-surface-container-lowest hover:border-surface-container-highest'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    paymentMethod === 'integrado' ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'
                  }`}>
                    <span className="material-symbols-outlined text-[24px]">credit_card</span>
                  </div>

                  <div className="flex flex-col flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-label-lg text-on-surface font-bold">Pago en línea (Webpay Plus)</span>
                      <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold px-2 py-0.5 rounded-full border border-emerald-500/20">
                        Inmediato
                      </span>
                    </div>
                    <span className="font-body-sm text-on-surface-variant text-xs mt-0.5">
                      Débito (Redcompra), Crédito y Prepago. Transbank oficial.
                    </span>

                    {/* Insignias de tarjetas aceptadas */}
                    <div className="flex items-center gap-1.5 mt-2.5">
                      <span className="px-2 py-0.5 bg-red-600 text-white text-[10px] font-black rounded tracking-tight">
                        Webpay Plus
                      </span>
                      <span className="px-1.5 py-0.5 bg-surface-container text-on-surface-variant text-[10px] font-semibold rounded">
                        Redcompra
                      </span>
                      <span className="px-1.5 py-0.5 bg-surface-container text-on-surface-variant text-[10px] font-semibold rounded">
                        Visa
                      </span>
                      <span className="px-1.5 py-0.5 bg-surface-container text-on-surface-variant text-[10px] font-semibold rounded">
                        Mastercard
                      </span>
                    </div>
                  </div>
                </button>

                {/* Opción 2: Transferencia Bancaria */}
                <button 
                  type="button"
                  onClick={() => setPaymentMethod("transferencia")}
                  className={`p-4 rounded-2xl border-2 flex items-start gap-3.5 transition-all text-left ${
                    paymentMethod === 'transferencia' 
                      ? 'border-primary bg-primary/5 shadow-sm' 
                      : 'border-surface-container bg-surface-container-lowest hover:border-surface-container-highest'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    paymentMethod === 'transferencia' ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'
                  }`}>
                    <span className="material-symbols-outlined text-[24px]">account_balance</span>
                  </div>

                  <div className="flex flex-col flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-label-lg text-on-surface font-bold">Transferencia Manual</span>
                      <span className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold px-2 py-0.5 rounded-full border border-amber-500/20">
                        Manual
                      </span>
                    </div>
                    <span className="font-body-sm text-on-surface-variant text-xs mt-0.5">
                      Requiere validación de comprobante por administración
                    </span>
                  </div>
                </button>
              </div>

              {/* Transferencia Details */}
              {paymentMethod === "transferencia" && (
                <div className="bg-surface-container p-4 rounded-2xl flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 border border-surface-container-highest">
                  <h4 className="font-label-md font-bold text-on-surface border-b border-surface-container-highest pb-2">
                    Datos Bancarios para Transferencia
                  </h4>
                  <ul className="font-body-sm text-on-surface-variant flex flex-col gap-1.5 text-xs">
                    <li><span className="font-bold text-on-surface">Banco:</span> Banco Estado</li>
                    <li><span className="font-bold text-on-surface">Cuenta Corriente / Rut:</span> 12.345.678-9</li>
                    <li><span className="font-bold text-on-surface">Titular:</span> Gimnasio Cuerpo y Alma SpA</li>
                    <li><span className="font-bold text-on-surface">Correo:</span> pagos@cuerpoyalma.cl</li>
                  </ul>
                  
                  <div className="flex flex-col gap-1.5 mt-2">
                    <label className="font-label-sm font-bold text-on-surface text-xs">
                      Adjuntar Comprobante de Transferencia:
                    </label>
                    <div className="relative">
                      <input 
                        type="file"
                        accept="image/*,.pdf"
                        onChange={(e) => {
                           const file = e.target.files?.[0];
                           if(file) {
                              setFileName(file.name);
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                 setComprobanteUrl(reader.result as string);
                              };
                              reader.readAsDataURL(file);
                           }
                        }}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <div className="h-12 px-3 rounded-xl border-2 border-dashed border-primary bg-primary/5 text-primary flex items-center justify-center gap-2 hover:bg-primary/10 transition-colors">
                        <span className="material-symbols-outlined text-[20px]">{fileName ? 'check_circle' : 'add_photo_alternate'}</span>
                        <span className="font-label-md font-bold truncate max-w-[200px]">
                           {fileName ? fileName : "Seleccionar foto o PDF"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Mensaje de seguridad para Webpay */}
              {paymentMethod === "integrado" && (
                <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-medium">
                  <span className="material-symbols-outlined text-[20px] shrink-0" style={{ fontVariationSettings: '"FILL" 1' }}>
                    verified_user
                  </span>
                  <span>Transacción encriptada y protegida por Transbank Webpay Plus.</span>
                </div>
              )}

              {/* Botón de Pago */}
              <button 
                onClick={procesarCompra}
                disabled={!paymentMethod || isProcessing}
                className="w-full h-14 bg-primary text-on-primary rounded-xl font-label-lg font-bold flex items-center justify-center gap-2 disabled:opacity-50 transition-all hover:opacity-95 active:scale-[0.99] shadow-md"
              >
                {isProcessing ? (
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined animate-spin text-[24px]">refresh</span>
                    <span>Conectando con Webpay...</span>
                  </div>
                ) : (
                  <>
                    <span>
                      {paymentMethod === 'transferencia' ? 'Enviar Comprobante' : `Pagar con Webpay Plus ($${selectedPlan.precio.toLocaleString()})`}
                    </span>
                    <span className="material-symbols-outlined">
                      {paymentMethod === 'transferencia' ? 'send' : 'lock'}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {toastMessage && (
        <div className="fixed top-20 inset-x-4 z-50 flex items-center justify-center animate-in slide-in-from-top-4">
          <div className="bg-surface-container-highest text-on-surface px-5 py-3.5 rounded-2xl shadow-xl flex items-center gap-3">
            <span className="material-symbols-outlined text-emerald-500 text-[24px]">check_circle</span>
            <span className="font-label-md font-bold text-[15px]">{toastMessage}</span>
          </div>
        </div>
      )}
    </div>
  );
}
