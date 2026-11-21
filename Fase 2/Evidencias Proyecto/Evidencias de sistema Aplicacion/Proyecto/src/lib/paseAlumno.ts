interface PaseAlumno {
  id_reserva: number;
  id_clase: number;
}

export function crearPaseAlumno(reservaId: number, claseId: number) {
  return JSON.stringify({
    tipo: "asistencia_alumno",
    id_reserva: reservaId,
    id_clase: claseId,
  });
}

export function leerPaseAlumno(texto: string): PaseAlumno | null {
  try {
    const pase = JSON.parse(texto);
    if (
      pase?.tipo !== "asistencia_alumno" ||
      !Number.isSafeInteger(pase.id_reserva) || pase.id_reserva <= 0 ||
      !Number.isSafeInteger(pase.id_clase) || pase.id_clase <= 0
    ) return null;

    return { id_reserva: pase.id_reserva, id_clase: pase.id_clase };
  } catch {
    return null;
  }
}
