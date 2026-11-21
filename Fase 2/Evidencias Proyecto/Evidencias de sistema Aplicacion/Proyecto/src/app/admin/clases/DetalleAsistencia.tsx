"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface SesionAsistencia {
  id_clase: number;
  nombre_clase: string;
  fecha_hora_inicio: string;
  fecha_hora_fin: string;
  estado_clase: string | null;
}

type Estado = "Presente" | "Ausente" | "Pendiente" | "Cancelada";

interface Inscripcion {
  id: number;
  nombre: string;
  estado: Estado;
}

export default function DetalleAsistencia({ sesion, onClose }: {
  sesion: SesionAsistencia;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [inscripciones, setInscripciones] = useState<Inscripcion[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function cargar() {
      const { data, error: errorConsulta } = await supabase.from("reserva")
        .select("id_reserva, estado_reserva, profiles:id_usuario(name, last_name), asistencia(asistio, fecha_hora_ingreso)")
        .eq("id_clase", sesion.id_clase)
        .abortSignal(controller.signal);

      if (controller.signal.aborted) return;
      if (errorConsulta) {
        console.error("No se pudo consultar la asistencia:", errorConsulta);
        setError(true);
        return;
      }

      const sesionCancelada = sesion.estado_clase === "cancelada";
      const finalizada = ["finalizada", "completada"].includes(sesion.estado_clase ?? "") ||
        Date.parse(sesion.fecha_hora_fin) <= Date.now();

      const filas = (data ?? []).map((reserva): Inscripcion => {
        const perfil = Array.isArray(reserva.profiles) ? reserva.profiles[0] : reserva.profiles;
        const marcas = Array.isArray(reserva.asistencia) ? reserva.asistencia : [reserva.asistencia];
        const nombre = [perfil?.name, perfil?.last_name].filter(Boolean).join(" ").trim() ||
          `Alumno · reserva #${reserva.id_reserva}`;
        const presente = reserva.estado_reserva === "presente" ||
          marcas.some(marca => marca?.asistio || marca?.fecha_hora_ingreso);
        const cancelada = sesionCancelada || reserva.estado_reserva === "cancelada";
        const estado = cancelada ? "Cancelada" : presente ? "Presente" : finalizada ? "Ausente" : "Pendiente";
        return { id: reserva.id_reserva, nombre, estado };
      });

      setInscripciones(filas.sort((a, b) => a.nombre.localeCompare(b.nombre, "es-CL")));
    }

    void cargar();
    return () => controller.abort();
  }, [sesion]);

  const fecha = new Date(sesion.fecha_hora_inicio).toLocaleString("es-CL", {
    dateStyle: "medium", timeStyle: "short",
  });

  return (
    <dialog ref={dialog}
      aria-labelledby="titulo-asistencia"
      onCancel={event => { event.preventDefault(); onClose(); }}
      className="m-auto max-h-[85vh] w-11/12 max-w-xl overflow-y-auto rounded-2xl border border-surface-container bg-surface-container-lowest p-5 text-on-surface shadow-xl backdrop:bg-black/50">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 id="titulo-asistencia" className="font-headline-sm font-bold">{sesion.nombre_clase}</h2>
          <p className="text-sm text-secondary">{fecha}</p>
        </div>
        <button type="button" autoFocus onClick={onClose}
          className="rounded-lg bg-surface-container px-3 py-2 text-sm font-bold">Cerrar</button>
      </header>

      {error ? <p role="alert">No se pudo cargar la asistencia de esta clase.</p> :
        inscripciones === null ? <p role="status">Cargando asistencia…</p> :
          inscripciones.length === 0 ? <p>Esta clase no tiene inscripciones registradas.</p> : (
            <>
              <p className="mb-3 text-sm font-bold">
                {inscripciones.filter(fila => fila.estado !== "Cancelada").length} inscritos · {" "}
                {inscripciones.filter(fila => fila.estado === "Presente").length} presentes · {" "}
                {inscripciones.filter(fila => fila.estado === "Ausente").length} ausentes
              </p>
              <ul className="divide-y divide-surface-container border-y border-surface-container">
                {inscripciones.map(fila => (
                  <li key={fila.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                    <span>{fila.nombre}</span>
                    <span className={`rounded-full px-2.5 py-1 font-bold ${fila.estado === "Presente" ?
                      "bg-emerald-500/10 text-emerald-700" : fila.estado === "Ausente" ?
                        "bg-error/10 text-error" : "bg-surface-container text-secondary"}`}>
                      {fila.estado}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
    </dialog>
  );
}
