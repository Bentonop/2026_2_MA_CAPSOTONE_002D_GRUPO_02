"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { supabase } from "@/lib/supabase";
import BrandLogo from "@/components/ui/BrandLogo";
import ThemeToggle from "@/components/theme/ThemeToggle";

interface HeaderProps {
  title?: string;
  subtitle?: string;
  profileLink?: string;
  homeLink?: string;
}

interface Notificacion {
  id: string;
  tipo: string;
  titulo: string;
  mensaje: string;
  leida: boolean;
  creado_en: string;
  clase_id?: number;
}

function formatRelativeTime(isoDate: string): string {
  const date = new Date(isoDate);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Ahora";
  if (diffMin < 60) return `Hace ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Hace ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Ayer";
  if (diffDays < 7) return `Hace ${diffDays} d`;
  return date.toLocaleDateString("es-CL", { day: "2-digit", month: "short" });
}

export default function Header({ title = "Cuerpo y Alma", subtitle = "Inicio", profileLink = "#", homeLink }: HeaderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [filter, setFilter] = useState<"todas" | "importantes" | "no_leidas">("todas");
  const [markingAll, setMarkingAll] = useState(false);
  const unreadCount = notificaciones.filter(n => !n.leida).length;
  const isAdmin = profileLink.startsWith("/admin");
  const isStudent = profileLink.startsWith("/alumno");
  const inbox = isStudent ? "notificaciones_alumno" : "notificaciones";

  // Cerrar panel con tecla Escape
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  useEffect(() => {
    let active = true;

    const fetchNotificaciones = async () => {
      if (isStudent) {
        await supabase.rpc("registrar_avisos_vencimiento");
      }
      const query = supabase.from(inbox).select("*");
      const { data, error } = await (isStudent ? query.eq("descartada", false) : query)
        .order("creado_en", { ascending: false })
        .limit(20);
      if (active && !error) setNotificaciones(data ?? []);
    };

    void fetchNotificaciones();

    if (isStudent) {
      const interval = window.setInterval(fetchNotificaciones, 60_000);
      window.addEventListener("focus", fetchNotificaciones);
      return () => {
        active = false;
        window.clearInterval(interval);
        window.removeEventListener("focus", fetchNotificaciones);
      };
    }

    const channel = supabase.channel("schema-db-changes")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "notificaciones",
      }, () => { void fetchNotificaciones(); })
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [inbox, isStudent, isOpen]);

  const handleDismiss = async (id: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const { error } = await supabase.from("notificaciones_alumno")
      .update({ descartada: true }).eq("id", id);
    if (error) {
      toast.error("No se pudo quitar la notificación.");
      return;
    }
    setNotificaciones(current => current.filter(notif => notif.id !== id));
  };

  const handleMarkAsRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const { error } = await supabase.from(inbox).update({ leida: true }).eq("id", id);
      if (error) throw error;
      setNotificaciones(current =>
        current.map(n => n.id === id ? { ...n, leida: true } : n)
      );
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllAsRead = async () => {
    const unreadIds = notificaciones.filter(n => !n.leida).map(n => n.id);
    if (unreadIds.length === 0) return;

    setMarkingAll(true);
    try {
      const { error } = await supabase
        .from(inbox)
        .update({ leida: true })
        .in('id', unreadIds);
      if (error) throw error;

      setNotificaciones(current => current.map(n => unreadIds.includes(n.id) ? { ...n, leida: true } : n));
      toast.success("Todas las notificaciones marcadas como leídas");
    } catch (err) {
      console.error(err);
      toast.error("No se pudieron actualizar las notificaciones");
    } finally {
      setMarkingAll(false);
    }
  };

  const getIconForType = (tipo: string) => {
    switch (tipo) {
      case 'critica':
        return (
          <div className="w-10 h-10 rounded-full bg-error/10 text-error flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[20px]">report</span>
          </div>
        );
      case 'operativa':
        return (
          <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[20px]">check_circle</span>
          </div>
        );
      default:
        return (
          <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[20px]">info</span>
          </div>
        );
    }
  };

  const filteredNotifs = notificaciones.filter(n => {
    if (filter === "no_leidas") return !n.leida;
    if (filter === "importantes") return n.tipo === "critica" || n.tipo === "operativa";
    return true;
  }).slice(0, 6);

  const brand = (
    <>
      <BrandLogo size="sm" showText={false} />
      <div className="flex flex-col">
        <span className="font-headline-sm text-headline-sm tracking-tight text-on-surface leading-none">
          {title}
        </span>
        <span className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider">
          {subtitle}
        </span>
      </div>
    </>
  );

  return (
    <>
      <header className="fixed top-0 inset-x-0 z-50 bg-surface/90 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] pt-safe">
        <div className="h-16 max-w-5xl mx-auto px-margin-mobile flex items-center justify-between w-full">
          {homeLink ? (
            <Link href={homeLink} aria-label="Ir al Dashboard"
              className="flex items-center gap-space-sm rounded-lg focus-visible:outline-2 focus-visible:outline-primary">
              {brand}
            </Link>
          ) : <div className="flex items-center gap-space-sm">{brand}</div>}

          <div className="flex items-center gap-space-xs relative">
            <ThemeToggle />
            <button
              aria-label={unreadCount > 0 ? `Notificaciones (${unreadCount} sin leer)` : "Notificaciones"}
              onClick={() => setIsOpen(!isOpen)}
              className="w-11 h-11 relative flex items-center justify-center rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
            >
              <span className="material-symbols-outlined text-[24px]">notifications</span>
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 bg-primary text-on-primary text-[10px] font-bold rounded-full flex items-center justify-center border border-surface shadow-sm">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
            <Link
              href={profileLink}
              aria-label="Ir a mi perfil"
              className="relative flex items-center justify-center p-0.5 cursor-pointer active:scale-95 transition-transform"
            >
              <div className="w-8 h-8 rounded-full bg-surface-container-highest flex items-center justify-center text-on-surface hover:ring-2 hover:ring-primary/40 transition-all">
                <span className="material-symbols-outlined text-[20px]">person</span>
              </div>
            </Link>
          </div>
        </div>
      </header>

      {/* Panel de Notificaciones */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-end sm:items-start sm:justify-end sm:p-4 bg-black/40 sm:bg-transparent backdrop-blur-[2px] sm:backdrop-blur-none"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="w-full sm:w-[390px] bg-surface sm:mt-14 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom sm:slide-in-from-top-4 h-[75vh] sm:h-auto sm:max-h-[80vh] border border-surface-container"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-1.5 bg-surface-variant/50 rounded-full mx-auto mt-3 mb-1 sm:hidden"></div>

            <div className="px-5 pt-4 pb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h3 className="font-headline-md font-bold text-on-surface">Notificaciones</h3>
                {unreadCount > 0 && (
                  <span className="bg-primary/20 text-primary px-2 py-0.5 rounded-full text-xs font-bold">
                    {unreadCount}
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  disabled={markingAll}
                  className="text-xs font-semibold text-primary hover:underline disabled:opacity-50"
                >
                  {markingAll ? "Marcando..." : "Marcar todas leídas"}
                </button>
              )}
            </div>

            {/* Filtros */}
            <div className="px-5 pb-4 flex gap-2 overflow-x-auto hide-scrollbar">
              <button
                onClick={() => setFilter("todas")}
                className={`px-4 py-1.5 rounded-full font-label-md transition-colors ${filter === "todas" ? 'bg-[#d4af37] text-white font-bold' : 'bg-surface border border-surface-container-highest text-on-surface-variant'}`}
              >
                Todas
              </button>
              <button
                onClick={() => setFilter("importantes")}
                className={`px-4 py-1.5 rounded-full font-label-md transition-colors ${filter === "importantes" ? 'bg-[#d4af37] text-white font-bold' : 'bg-surface border border-surface-container-highest text-on-surface-variant'}`}
              >
                Importantes
              </button>
              <button
                onClick={() => setFilter("no_leidas")}
                className={`px-4 py-1.5 rounded-full font-label-md transition-colors ${filter === "no_leidas" ? 'bg-[#d4af37] text-white font-bold' : 'bg-surface border border-surface-container-highest text-on-surface-variant'}`}
              >
                No leídas
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-4 flex flex-col gap-3">
              {filteredNotifs.length === 0 ? (
                <div className="p-8 flex flex-col items-center justify-center text-center gap-2">
                  <span className="material-symbols-outlined text-[40px] text-on-surface-variant/40">done_all</span>
                  <p className="font-body-md text-on-surface-variant">Estás al día.</p>
                </div>
              ) : (
                filteredNotifs.map(notif => {
                  const content = (
                    <div
                      key={notif.id}
                      onClick={(e) => {
                        if (!notif.leida) handleMarkAsRead(notif.id, e);
                        if (!isAdmin) setIsOpen(false);
                      }}
                      className={`p-4 rounded-2xl flex items-center justify-between transition-colors border cursor-pointer ${notif.leida ? 'opacity-65 bg-surface border-surface-container' : 'bg-surface-container-lowest border-primary/25 shadow-sm'}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {getIconForType(notif.tipo)}
                        <div className="flex flex-col min-w-0">
                          <p className={`font-label-md truncate ${!notif.leida ? 'text-on-surface font-bold' : 'text-on-surface-variant'}`}>
                            {notif.titulo}
                          </p>
                          <p className="font-body-sm text-secondary truncate">
                            {notif.mensaje}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0 ml-2">
                        <span className="font-label-sm text-secondary whitespace-nowrap">
                          {formatRelativeTime(notif.creado_en)}
                        </span>
                        <span className="material-symbols-outlined text-on-surface-variant text-[18px]">
                          {isAdmin ? 'chevron_right' : (notif.leida ? 'done_all' : 'mark_chat_read')}
                        </span>
                        {isStudent && (
                          <button type="button" aria-label={`Quitar notificación: ${notif.titulo}`}
                            onClick={event => void handleDismiss(notif.id, event)}
                            className="rounded p-1 text-secondary hover:bg-surface-container">
                            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">close</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );

                  return isAdmin ? (
                    <Link
                      href="/admin/notificaciones"
                      key={notif.id}
                      onClick={(e) => {
                        if (!notif.leida) handleMarkAsRead(notif.id, e);
                        setIsOpen(false);
                      }}
                    >
                      {content}
                    </Link>
                  ) : (
                    content
                  );
                })
              )}
            </div>

            {isAdmin ? (
              <div className="p-4 bg-surface text-center pb-safe border-t border-surface-container">
                <Link
                  href="/admin/notificaciones"
                  onClick={() => setIsOpen(false)}
                  className="text-[#d4af37] font-label-md font-bold hover:underline inline-flex items-center gap-1"
                >
                  Ver historial completo
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </Link>
              </div>
            ) : (
              <div className="p-3 bg-surface text-center pb-safe border-t border-surface-container">
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-secondary hover:text-on-surface font-label-md transition-colors"
                >
                  Cerrar
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
