"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, Suspense } from "react";

function WebpaySimulatorContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const token = searchParams.get("token_ws") || "SIM-TBK-TEST-TOKEN";
  const amount = Number(searchParams.get("amount") || 29990);
  const buyOrder = searchParams.get("buy_order") || "OC-SIMULADA-101";
  const returnUrl = searchParams.get("return_url") || "/api/webpay/retorno";

  const [cardType, setCardType] = useState<"debito" | "credito">("debito");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePagar = () => {
    setIsSubmitting(true);
    // Redirigir a la URL de retorno con el token de transacción
    const targetUrl = new URL(returnUrl, window.location.origin);
    targetUrl.searchParams.set("token_ws", token);
    window.location.href = targetUrl.toString();
  };

  const handleAnular = () => {
    setIsSubmitting(true);
    const targetUrl = new URL(returnUrl, window.location.origin);
    targetUrl.searchParams.set("TBK_TOKEN", token);
    targetUrl.searchParams.set("TBK_ORDEN_COMPRA", buyOrder);
    window.location.href = targetUrl.toString();
  };

  return (
    <div className="min-h-screen bg-[#F0F2F5] text-slate-800 flex flex-col justify-between font-sans">
      {/* Barra superior estilo Webpay */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 shadow-sm">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-[#E4002B] text-white font-extrabold text-xs px-2 py-1 rounded">
              WEBPAY
            </div>
            <span className="font-bold text-slate-800 text-lg tracking-tight">Plus</span>
            <span className="text-xs bg-amber-100 text-amber-800 font-semibold px-2 py-0.5 rounded-full border border-amber-300 ml-1">
              Ambiente de Pruebas Transbank
            </span>
          </div>
          <span className="text-xs text-slate-500 font-medium">Transbank S.A.</span>
        </div>
      </header>

      {/* Contenido principal */}
      <main className="max-w-xl w-full mx-auto p-4 sm:p-6 my-auto">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
          
          {/* Cabecera del Comercio */}
          <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-300 uppercase tracking-wider font-semibold">Comercio Asociado</p>
                <h2 className="text-2xl font-black mt-0.5">Cuerpo y Alma</h2>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-300 uppercase tracking-wider font-semibold">Monto a Pagar</p>
                <p className="text-2xl font-black text-emerald-400">
                  ${amount.toLocaleString("es-CL")} <span className="text-xs text-slate-300">CLP</span>
                </p>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-700/60 flex items-center justify-between text-xs text-slate-300">
              <span>Orden de Compra: <strong className="text-white">{buyOrder}</strong></span>
              <span>Código Comercio: <strong className="text-white">597055555532</strong></span>
            </div>
          </div>

          {/* Formulario de pago simulado */}
          <div className="p-6 flex flex-col gap-5">
            <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
              <span className="material-symbols-outlined text-red-600 text-[22px]">credit_card</span>
              Selecciona tu medio de pago de prueba
            </h3>

            {/* Selector de medio */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setCardType("debito")}
                className={`p-3.5 rounded-xl border-2 flex flex-col items-center gap-1.5 transition-all text-center ${
                  cardType === "debito"
                    ? "border-red-600 bg-red-50/50 text-red-950 shadow-sm"
                    : "border-slate-200 hover:border-slate-300 bg-white text-slate-600"
                }`}
              >
                <span className="text-sm font-bold">Redcompra / Débito</span>
                <span className="text-[11px] text-slate-500">Cuenta Corriente / Vista</span>
              </button>

              <button
                type="button"
                onClick={() => setCardType("credito")}
                className={`p-3.5 rounded-xl border-2 flex flex-col items-center gap-1.5 transition-all text-center ${
                  cardType === "credito"
                    ? "border-red-600 bg-red-50/50 text-red-950 shadow-sm"
                    : "border-slate-200 hover:border-slate-300 bg-white text-slate-600"
                }`}
              >
                <span className="text-sm font-bold">Tarjeta de Crédito</span>
                <span className="text-[11px] text-slate-500">Visa / Mastercard / Magna</span>
              </button>
            </div>

            {/* Datos de tarjeta simulada */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Número de Tarjeta (Pruebas Oficial Transbank)
                </label>
                <input
                  type="text"
                  disabled
                  value="6623 **** **** 6623"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono font-medium text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Vencimiento</label>
                  <input
                    type="text"
                    disabled
                    value="12 / 28"
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">CVV</label>
                  <input
                    type="text"
                    disabled
                    value="123"
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono text-slate-800"
                  />
                </div>
              </div>

              <p className="text-[11px] text-slate-500 italic mt-1">
                ℹ️ Esta pasarela replica el portal Webpay Plus de Transbank para pruebas locales. Al pulsar Continuar, la transacción se autorizará automáticamente y se abonarán tus créditos de clases.
              </p>
            </div>

            {/* Botones de acción */}
            <div className="flex flex-col gap-2.5 pt-2">
              <button
                onClick={handlePagar}
                disabled={isSubmitting}
                className="w-full bg-[#E4002B] hover:bg-[#c30024] active:scale-[0.99] text-white font-bold py-3.5 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 text-base disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span className="material-symbols-outlined animate-spin text-[20px]">refresh</span>
                ) : (
                  <>
                    <span>Pagar con Webpay Plus</span>
                    <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                  </>
                )}
              </button>

              <button
                onClick={handleAnular}
                disabled={isSubmitting}
                type="button"
                className="w-full py-2.5 text-xs text-slate-600 hover:text-slate-900 font-semibold transition-colors flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">cancel</span>
                Anular compra y volver al comercio
              </button>
            </div>

          </div>
        </div>
      </main>

      {/* Pie de página oficial Transbank */}
      <footer className="bg-white border-t border-slate-200 py-3 text-center text-xs text-slate-500">
        <p>© Transbank S.A. Todos los derechos reservados. Webpay Plus es una marca registrada de Transbank.</p>
      </footer>
    </div>
  );
}

export default function WebpaySimulatorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#F0F2F5]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600"></div>
      </div>
    }>
      <WebpaySimulatorContent />
    </Suspense>
  );
}
