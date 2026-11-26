"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AuthForm from "@/components/ui/auth/AuthForm";
import ThemeToggle from "@/components/theme/ThemeToggle";
import { supabase } from "@/lib/supabase";

interface ActiveSessionInfo {
  name: string;
  role: string;
  dashboardHref: string;
}

export default function LoginPage() {
  const [activeSession, setActiveSession] = useState<ActiveSessionInfo | null>(null);

  useEffect(() => {
    let mounted = true;
    async function checkExistingSession() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session || !mounted) return;

        const { data: profile } = await supabase
          .from("profiles")
          .select("name, role")
          .eq("id", session.user.id)
          .maybeSingle();

        if (!mounted || !profile) return;

        const role = profile.role || "alumno";
        const dashboardHref =
          role === "administrador"
            ? "/admin/dashboard"
            : role === "profesor"
            ? "/profesor/dashboard"
            : "/alumno/dashboard";

        setActiveSession({
          name: profile.name || "Usuario",
          role,
          dashboardHref,
        });
      } catch {
        // Ignorar errores silenciosamente en pantalla de login
      }
    }
    checkExistingSession();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-surface p-margin-mobile relative overflow-hidden">
      {/* Botón flotante de Modo Oscuro en Login */}
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      {/* Ambient gold glow for premium aesthetic */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none"></div>

      <div className="flex flex-col items-center justify-center flex-1 relative z-10 py-8">
        {activeSession && (
          <div className="w-full max-w-md mb-4 p-3.5 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-between gap-3 shadow-sm">
            <div className="min-w-0">
              <p className="text-xs font-bold text-on-surface truncate">
                Sesión activa: {activeSession.name}
              </p>
              <p className="text-[11px] text-on-surface-variant capitalize">
                Rol: {activeSession.role}
              </p>
            </div>
            <Link
              href={activeSession.dashboardHref}
              className="px-3.5 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold shrink-0 hover:opacity-90 active:scale-95 transition-all"
            >
              Ir a mi panel →
            </Link>
          </div>
        )}

        <AuthForm type="sign-in" />

        {/* Enlace directo a Laboratorio de Evidencias QA para evaluación */}
        <div className="mt-6 text-center">
          <Link
            href="/qa-lab"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium text-on-surface-variant hover:text-primary bg-surface-container hover:bg-surface-container-high border border-surface-container-highest hover:border-primary/40 transition-all shadow-sm"
          >
            <span>🧪</span>
            <span>Laboratorio de Pruebas y Evidencias QA</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
