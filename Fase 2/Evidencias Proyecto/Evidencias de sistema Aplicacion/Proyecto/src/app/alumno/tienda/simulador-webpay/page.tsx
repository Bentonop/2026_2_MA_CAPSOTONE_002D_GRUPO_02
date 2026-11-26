"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, Suspense, useMemo } from "react";

function WebpaySimulatorContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const token = searchParams.get("token_ws") || "SIM-TBK-TEST-TOKEN";
  const amount = Number(searchParams.get("amount") || 29990);
  const buyOrder = searchParams.get("buy_order") || "OC-SIMULADA-101";
  const returnUrl = searchParams.get("return_url") || "/api/webpay/retorno";

  // Form states
  const [cardType, setCardType] = useState<"VD" | "VN" | "VC">("VD");
  const [cardNumber, setCardNumber] = useState("1234 5678 9012 3456");
  const [cardHolder, setCardHolder] = useState("MANUEL ROJAS");
  const [cardExpiry, setCardExpiry] = useState("12/28");
  const [cardCvv, setCardCvv] = useState("123");
  const [userRut, setUserRut] = useState("18.456.789-K");
  const [outcome, setOutcome] = useState<"approved" | "rejected">("approved");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto detect card brand
  const cardBrand = useMemo(() => {
    const clean = cardNumber.replace(/\s+/g, "");
    if (clean.startsWith("4")) return { name: "Visa", icon: "credit_card", color: "from-blue-700 to-indigo-900" };
    if (/^(5[1-5]|2[2-7])/.test(clean)) return { name: "Mastercard", icon: "credit_card", color: "from-amber-700 to-red-900" };
    if (clean.startsWith("6623") || cardType === "VD") return { name: "Redcompra / Cuenta RUT", icon: "account_balance", color: "from-emerald-800 to-teal-950" };
    return { name: "Transbank Webpay", icon: "credit_card", color: "from-slate-800 to-slate-950" };
  }, [cardNumber, cardType]);

  // Format card number with spaces every 4 digits
  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 16);
    const parts = raw.match(/.{1,4}/g);
    setCardNumber(parts ? parts.join(" ") : raw);
  };

  // Format expiry MM/YY
  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/\D/g, "").slice(0, 4);
    if (raw.length >= 3) {
      raw = `${raw.slice(0, 2)}/${raw.slice(2)}`;
    }
    setCardExpiry(raw);
  };

  // Quick Presets
  const applyPreset = (preset: "cuentarut" | "credito_visa" | "debito_redcompra" | "transbank_test" | "clear") => {
    switch (preset) {
      case "cuentarut":
        setCardType("VD");
        setCardNumber("5020 9876 5432 1098");
        setCardHolder("MANUEL ROJAS (CUENTA RUT)");
        setCardExpiry("08/29");
        setCardCvv("789");
        break;
      case "credito_visa":
        setCardType("VN");
        setCardNumber("4512 8765 4321 0987");
        setCardHolder("MANUEL ROJAS (VISA)");
        setCardExpiry("11/27");
        setCardCvv("456");
        break;
      case "debito_redcompra":
        setCardType("VD");
        setCardNumber("5895 1234 5678 9012");
        setCardHolder("MANUEL ROJAS (DÉBITO)");
        setCardExpiry("05/28");
        setCardCvv("321");
        break;
      case "transbank_test":
        setCardType("VD");
        setCardNumber("6623 0000 0000 6623");
        setCardHolder("USUARIO PRUEBA TRANSBANK");
        setCardExpiry("12/28");
        setCardCvv("123");
        break;
      case "clear":
        setCardNumber("");
        setCardHolder("");
        setCardExpiry("");
        setCardCvv("");
        break;
    }
  };

  const handlePagar = () => {
    setIsSubmitting(true);
    const targetUrl = new URL(returnUrl, window.location.origin);
    targetUrl.searchParams.set("token_ws", token);
    targetUrl.searchParams.set("card_num", cardNumber);
    targetUrl.searchParams.set("card_type", cardType);
    if (outcome === "rejected") {
      targetUrl.searchParams.set("sim_status", "rejected");
    }
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
    <div className="min-h-screen bg-[#F0F2F5] dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col justify-between font-sans">
      {/* Barra superior estilo Webpay */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3 shadow-sm sticky top-0 z-20">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-[#E4002B] text-white font-black text-xs px-2.5 py-1 rounded tracking-tight">
              WEBPAY
            </div>
            <span className="font-bold text-slate-800 dark:text-white text-lg tracking-tight">Plus</span>
            <span className="text-xs bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 font-bold px-2.5 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-800 ml-1">
              Pasarela de Pruebas Interactiva
            </span>
          </div>
          <span className="text-xs text-slate-500 font-medium">Transbank S.A.</span>
        </div>
      </header>

      {/* Contenido principal */}
      <main className="max-w-3xl w-full mx-auto p-4 sm:p-6 my-auto">
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          
          {/* Cabecera del Comercio */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Comercio Adherido</p>
                <h2 className="text-2xl font-black mt-0.5">Cuerpo y Alma</h2>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Monto a Cobrar</p>
                <p className="text-2xl font-black text-emerald-400">
                  ${amount.toLocaleString("es-CL")} <span className="text-xs text-slate-300">CLP</span>
                </p>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-700/60 flex items-center justify-between text-xs text-slate-300">
              <span>Orden de Compra: <strong className="text-white font-mono">{buyOrder}</strong></span>
              <span>Código Comercio: <strong className="text-white font-mono">597055555532</strong></span>
            </div>
          </div>

          <div className="p-6 sm:p-8 flex flex-col gap-6">

            {/* TARJETA VISUAL ANIMADA */}
            <div className="flex justify-center">
              <div className={`w-full max-w-sm h-52 rounded-2xl p-5 text-white shadow-2xl flex flex-col justify-between bg-gradient-to-br ${cardBrand.color} border border-white/10 transition-all duration-300 transform hover:scale-[1.01]`}>
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-7 bg-amber-400/80 rounded-md border border-amber-300/40 flex items-center justify-center">
                      <div className="w-6 h-4 border border-amber-600/50 rounded-sm"></div>
                    </div>
                    <span className="material-symbols-outlined text-white/80 text-[20px]">contactless</span>
                  </div>
                  <span className="font-extrabold text-xs tracking-wider uppercase px-2 py-0.5 bg-black/30 rounded backdrop-blur-sm">
                    {cardBrand.name}
                  </span>
                </div>

                <div className="my-auto">
                  <span className="font-mono text-xl sm:text-2xl font-bold tracking-widest drop-shadow-md">
                    {cardNumber || "•••• •••• •••• ••••"}
                  </span>
                </div>

                <div className="flex justify-between items-end text-xs">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-white/70 uppercase tracking-wider">Titular</span>
                    <span className="font-bold tracking-wide uppercase truncate max-w-[190px]">
                      {cardHolder || "NOMBRE DEL TITULAR"}
                    </span>
                  </div>
                  <div className="flex flex-col text-right">
                    <span className="text-[10px] text-white/70 uppercase tracking-wider">Vence</span>
                    <span className="font-mono font-bold">{cardExpiry || "MM/AA"}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Presets Rápidos */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                ⚡ Cargar Tarjeta de Prueba Rápida o escribe la tuya:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => applyPreset("cuentarut")}
                  className="p-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 transition-colors text-left flex items-center gap-1.5"
                >
                  <span>🏦 Cuenta RUT</span>
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset("debito_redcompra")}
                  className="p-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 transition-colors text-left flex items-center gap-1.5"
                >
                  <span>💳 Redcompra</span>
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset("credito_visa")}
                  className="p-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 transition-colors text-left flex items-center gap-1.5"
                >
                  <span>💳 Visa / Master</span>
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset("clear")}
                  className="p-2 text-xs font-bold rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 text-red-600 hover:bg-red-100 transition-colors text-center"
                >
                  ✏️ Escribir propia
                </button>
              </div>
            </div>

            {/* FORMULARIO EDITABLE DE TARJETA */}
            <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col gap-4">
              
              {/* Tipo de tarjeta */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Tipo de Tarjeta
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setCardType("VD")}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                      cardType === "VD"
                        ? "border-[#E4002B] bg-red-50 dark:bg-red-950/40 text-red-600"
                        : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    }`}
                  >
                    Débito (Redcompra)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCardType("VN")}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                      cardType === "VN"
                        ? "border-[#E4002B] bg-red-50 dark:bg-red-950/40 text-red-600"
                        : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    }`}
                  >
                    Crédito (1 Cuota)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCardType("VC")}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                      cardType === "VC"
                        ? "border-[#E4002B] bg-red-50 dark:bg-red-950/40 text-red-600"
                        : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    }`}
                  >
                    Crédito en Cuotas
                  </button>
                </div>
              </div>

              {/* Número de Tarjeta */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Número de Tarjeta (Ingresa tu tarjeta o la de prueba)
                </label>
                <input
                  type="text"
                  value={cardNumber}
                  onChange={handleCardNumberChange}
                  placeholder="1234 5678 9012 3456"
                  maxLength={19}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 text-base font-mono font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E4002B]"
                />
              </div>

              {/* Nombre y RUT */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Nombre del Titular
                  </label>
                  <input
                    type="text"
                    value={cardHolder}
                    onChange={(e) => setCardHolder(e.target.value.toUpperCase())}
                    placeholder="MANUEL ROJAS"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-semibold uppercase text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E4002B]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    RUT del Titular
                  </label>
                  <input
                    type="text"
                    value={userRut}
                    onChange={(e) => setUserRut(e.target.value)}
                    placeholder="18.456.789-K"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-mono text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E4002B]"
                  />
                </div>
              </div>

              {/* Vencimiento y CVV */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Vencimiento (MM/AA)
                  </label>
                  <input
                    type="text"
                    value={cardExpiry}
                    onChange={handleExpiryChange}
                    placeholder="12/28"
                    maxLength={5}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-mono text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E4002B]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    CVV / Código Seguridad
                  </label>
                  <input
                    type="password"
                    value={cardCvv}
                    onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    placeholder="123"
                    maxLength={4}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-mono text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E4002B]"
                  />
                </div>
              </div>

              {/* Simulación de resultado bancario */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  🧪 Resultado de prueba bancaria a simular:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setOutcome("approved")}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      outcome === "approved"
                        ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 shadow-sm"
                        : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">check_circle</span>
                    Aprobar Compra (Éxito)
                  </button>

                  <button
                    type="button"
                    onClick={() => setOutcome("rejected")}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      outcome === "rejected"
                        ? "border-rose-500 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 shadow-sm"
                        : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">cancel</span>
                    Simular Rechazo Bancario
                  </button>
                </div>
              </div>

            </div>

            {/* BOTONES DE ACCIÓN */}
            <div className="flex flex-col gap-2.5 pt-1">
              <button
                onClick={handlePagar}
                disabled={isSubmitting || !cardNumber.trim()}
                className="w-full bg-[#E4002B] hover:bg-[#c30024] active:scale-[0.99] text-white font-bold py-4 px-4 rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 text-base disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span className="material-symbols-outlined animate-spin text-[22px]">refresh</span>
                ) : (
                  <>
                    <span>
                      {outcome === "approved" ? "Pagar con Webpay Plus" : "Procesar y Simular Rechazo"}
                    </span>
                    <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                  </>
                )}
              </button>

              <button
                onClick={handleAnular}
                disabled={isSubmitting}
                type="button"
                className="w-full py-2.5 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-white font-semibold transition-colors flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">cancel</span>
                Anular compra y volver al comercio
              </button>
            </div>

          </div>
        </div>
      </main>

      {/* Pie de página oficial Transbank */}
      <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-3 text-center text-xs text-slate-500">
        <p>© Transbank S.A. Todos los derechos reservados. Webpay Plus es una marca registrada de Transbank.</p>
      </footer>
    </div>
  );
}

export default function WebpaySimulatorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#F0F2F5] dark:bg-slate-950">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600"></div>
      </div>
    }>
      <WebpaySimulatorContent />
    </Suspense>
  );
}
