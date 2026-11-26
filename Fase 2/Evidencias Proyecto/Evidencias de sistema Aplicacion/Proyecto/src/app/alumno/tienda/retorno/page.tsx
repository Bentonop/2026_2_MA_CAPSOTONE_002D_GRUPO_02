"use client";

import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { getPaymentTypeDescription } from "@/lib/webpay";

function RetornoPagoContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const status = searchParams.get("status") || "exito";
  const buyOrder = searchParams.get("buy_order") || "OC-000000";
  const authCode = searchParams.get("auth") || "123456";
  const cardNumber = searchParams.get("card") || "6623";
  const paymentType = searchParams.get("type") || "VD";
  const amount = Number(searchParams.get("amount") || 0);
  const planName = searchParams.get("plan") || "Plan Seleccionado";
  const creditos = searchParams.get("creditos") || "8";
  const duracionDias = searchParams.get("dias") || "30";
  const errorCode = searchParams.get("code") || "";
  const errorMessage = searchParams.get("mensaje") || "";

  const [fechaActual, setFechaActual] = useState("");

  useEffect(() => {
    const now = new Date();
    setFechaActual(
      now.toLocaleDateString("es-CL", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    );
  }, []);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-surface pb-bottom-nav-safe flex flex-col justify-center items-center px-4 py-8">
      <div className="w-full max-w-lg">
        
        {/* CASO: ÉXITO */}
        {status === "exito" && (
          <div className="flex flex-col gap-6 animate-in fade-in duration-300">
            {/* Cabecera de éxito */}
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3 shadow-md">
                <span className="material-symbols-outlined text-[36px]" style={{ fontVariationSettings: '"FILL" 1' }}>
                  check_circle
                </span>
              </div>
              <h1 className="font-headline-sm text-2xl font-black text-on-surface">
                ¡Pago Aprobado con Éxito!
              </h1>
              <p className="font-body-sm text-on-surface-variant mt-1 max-w-sm">
                Tu transacción ha sido autorizada correctamente por Webpay Plus. Tus cupos ya están activos.
              </p>
            </div>

            {/* Voucher Oficial estilo Transbank */}
            <div className="bg-surface-container-lowest border border-surface-container rounded-3xl shadow-xl overflow-hidden print:border-black print:shadow-none">
              
              {/* Encabezado del comprobante */}
              <div className="bg-gradient-to-r from-red-600 to-rose-700 text-white p-5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="bg-white text-red-600 font-black text-xs px-2 py-0.5 rounded">
                    WEBPAY
                  </div>
                  <span className="font-bold text-lg tracking-tight">Plus</span>
                </div>
                <div className="text-right">
                  <span className="text-[11px] uppercase tracking-wider block text-rose-100 font-semibold">Comprobante</span>
                  <span className="font-bold text-sm">Transbank S.A.</span>
                </div>
              </div>

              {/* Cuerpo del Voucher */}
              <div className="p-6 flex flex-col gap-4 text-on-surface">
                
                {/* Resumen del Plan */}
                <div className="bg-primary/5 dark:bg-primary/10 border border-primary/20 rounded-2xl p-4 flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-primary uppercase tracking-wider">Plan Contratado</span>
                    <span className="text-lg font-black text-on-surface">{planName}</span>
                    <span className="text-xs text-on-surface-variant font-medium mt-0.5">
                      Vigencia por {duracionDias} días
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-on-surface-variant uppercase tracking-wider block font-semibold">Cupos</span>
                    <span className="text-xl font-black text-primary">+{creditos} clases</span>
                  </div>
                </div>

                {/* Datos de la Transacción */}
                <div className="flex flex-col gap-2.5 pt-2 border-t border-surface-container text-sm">
                  <div className="flex justify-between items-center py-1 border-b border-surface-container/60">
                    <span className="text-on-surface-variant font-medium">Monto Pagado:</span>
                    <span className="font-black text-lg text-emerald-600 dark:text-emerald-400">
                      ${amount.toLocaleString("es-CL")} CLP
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-1 border-b border-surface-container/60">
                    <span className="text-on-surface-variant font-medium">Comercio:</span>
                    <span className="font-bold text-on-surface">Cuerpo y Alma</span>
                  </div>

                  <div className="flex justify-between items-center py-1 border-b border-surface-container/60">
                    <span className="text-on-surface-variant font-medium">Orden de Compra:</span>
                    <span className="font-mono font-bold text-on-surface">{buyOrder}</span>
                  </div>

                  <div className="flex justify-between items-center py-1 border-b border-surface-container/60">
                    <span className="text-on-surface-variant font-medium">Código de Autorización:</span>
                    <span className="font-mono font-bold text-on-surface">{authCode}</span>
                  </div>

                  <div className="flex justify-between items-center py-1 border-b border-surface-container/60">
                    <span className="text-on-surface-variant font-medium">Tipo de Pago:</span>
                    <span className="font-semibold text-on-surface">{getPaymentTypeDescription(paymentType)}</span>
                  </div>

                  <div className="flex justify-between items-center py-1 border-b border-surface-container/60">
                    <span className="text-on-surface-variant font-medium">Tarjeta:</span>
                    <span className="font-mono font-bold text-on-surface">**** **** **** {cardNumber}</span>
                  </div>

                  <div className="flex justify-between items-center py-1">
                    <span className="text-on-surface-variant font-medium">Fecha y Hora:</span>
                    <span className="font-medium text-on-surface">{fechaActual || "Hoy"}</span>
                  </div>
                </div>

                <div className="mt-2 text-center text-[11px] text-on-surface-variant">
                  Guarda este comprobante como respaldo de tu compra ante el centro deportivo.
                </div>
              </div>

            </div>

            {/* Acciones para el Alumno */}
            <div className="flex flex-col gap-3 print:hidden">
              <Link
                href="/alumno/mis-clases"
                className="w-full h-14 bg-primary text-on-primary rounded-xl font-label-lg font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-md"
              >
                <span>Reservar mi Primera Clase</span>
                <span className="material-symbols-outlined text-[20px]">calendar_month</span>
              </Link>

              <div className="grid grid-cols-2 gap-3">
                <Link
                  href="/alumno/perfil"
                  className="h-12 bg-surface-container-high hover:bg-surface-container-highest text-on-surface rounded-xl font-label-md font-bold flex items-center justify-center gap-1.5 transition-colors border border-surface-container"
                >
                  <span className="material-symbols-outlined text-[18px]">person</span>
                  <span>Ver Mi Perfil</span>
                </Link>

                <button
                  type="button"
                  onClick={handlePrint}
                  className="h-12 bg-surface-container-high hover:bg-surface-container-highest text-on-surface rounded-xl font-label-md font-bold flex items-center justify-center gap-1.5 transition-colors border border-surface-container"
                >
                  <span className="material-symbols-outlined text-[18px]">print</span>
                  <span>Imprimir Voucher</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CASO: ANULADO POR EL USUARIO */}
        {status === "anulado" && (
          <div className="bg-surface-container-lowest border border-surface-container rounded-3xl p-6 sm:p-8 shadow-xl text-center flex flex-col items-center gap-4 animate-in fade-in">
            <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-md">
              <span className="material-symbols-outlined text-[36px]">
                warning
              </span>
            </div>
            
            <h1 className="font-headline-sm text-2xl font-bold text-on-surface">
              Operación Anulada en Webpay
            </h1>

            <p className="font-body-md text-on-surface-variant max-w-sm">
              Has decidido anular la compra antes de confirmar en el portal de Transbank. No se ha realizado ningún cobro a tu cuenta o tarjeta.
            </p>

            <div className="w-full flex flex-col gap-3 mt-4">
              <Link
                href="/alumno/tienda"
                className="w-full h-14 bg-primary text-on-primary rounded-xl font-label-lg font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-md"
              >
                <span>Volver a la Tienda de Planes</span>
                <span className="material-symbols-outlined text-[20px]">storefront</span>
              </Link>

              <Link
                href="/alumno/perfil"
                className="w-full h-12 bg-surface-container text-on-surface rounded-xl font-label-md font-semibold flex items-center justify-center transition-colors"
              >
                Ir a mi Perfil
              </Link>
            </div>
          </div>
        )}

        {/* CASO: RECHAZADO POR EL BANCO */}
        {status === "rechazado" && (
          <div className="bg-surface-container-lowest border border-surface-container rounded-3xl p-6 sm:p-8 shadow-xl text-center flex flex-col items-center gap-4 animate-in fade-in">
            <div className="w-16 h-16 rounded-full bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center shadow-md">
              <span className="material-symbols-outlined text-[36px]">
                cancel
              </span>
            </div>
            
            <h1 className="font-headline-sm text-2xl font-bold text-on-surface">
              Pago Rechazado por el Banco
            </h1>

            <p className="font-body-md text-on-surface-variant max-w-sm">
              Tu entidad financiera no autorizó la transacción. Esto puede deberse a saldo insuficiente, límites de tarjeta o medidas de seguridad bancaria.
            </p>

            {errorCode && (
              <span className="inline-block bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs font-mono font-bold px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-800">
                Código de error Webpay: {errorCode}
              </span>
            )}

            <div className="w-full flex flex-col gap-3 mt-4">
              <Link
                href="/alumno/tienda"
                className="w-full h-14 bg-primary text-on-primary rounded-xl font-label-lg font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-md"
              >
                <span>Intentar Nuevamente</span>
                <span className="material-symbols-outlined text-[20px]">refresh</span>
              </Link>

              <Link
                href="/alumno/perfil"
                className="w-full h-12 bg-surface-container text-on-surface rounded-xl font-label-md font-semibold flex items-center justify-center transition-colors"
              >
                Volver al Perfil
              </Link>
            </div>
          </div>
        )}

        {/* CASO: ERROR GENÉRICO */}
        {status === "error" && (
          <div className="bg-surface-container-lowest border border-surface-container rounded-3xl p-6 sm:p-8 shadow-xl text-center flex flex-col items-center gap-4 animate-in fade-in">
            <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 flex items-center justify-center shadow-md">
              <span className="material-symbols-outlined text-[36px]">
                error
              </span>
            </div>
            
            <h1 className="font-headline-sm text-2xl font-bold text-on-surface">
              Ocurrió un Inconveniente
            </h1>

            <p className="font-body-md text-on-surface-variant max-w-sm">
              {errorMessage || "No se pudo completar la verificación del pago. Si el cargo se realizó en tu banco, contáctanos indicando tu comprobante."}
            </p>

            <div className="w-full flex flex-col gap-3 mt-4">
              <Link
                href="/alumno/tienda"
                className="w-full h-14 bg-primary text-on-primary rounded-xl font-label-lg font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-md"
              >
                <span>Regresar a la Tienda</span>
                <span className="material-symbols-outlined text-[20px]">storefront</span>
              </Link>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default function RetornoPagoPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
      </div>
    }>
      <RetornoPagoContent />
    </Suspense>
  );
}
