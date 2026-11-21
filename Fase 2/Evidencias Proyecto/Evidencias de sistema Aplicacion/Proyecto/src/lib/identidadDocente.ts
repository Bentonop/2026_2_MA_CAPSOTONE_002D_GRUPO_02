interface PerfilDocente {
  name?: string | null;
  last_name?: string | null;
  correo?: string | null;
}

export function nombreDocenteRegistrado(perfil: PerfilDocente): string {
  const nombre = perfil.name?.trim() ?? "";
  const correo = perfil.correo?.trim().toLowerCase();
  const alias = correo?.split("@")[0];
  const pareceAlias = nombre.toLowerCase() === alias && (!perfil.last_name?.trim() || /[._+]/.test(nombre));
  return nombre.includes("@") || pareceAlias || nombre === "Docente sin nombre registrado" ? "" : nombre;
}

export function identidadDocente(perfil: PerfilDocente | null | undefined) {
  const partes = perfil
    ? [nombreDocenteRegistrado(perfil), perfil.last_name?.trim()].filter((parte): parte is string => Boolean(parte))
    : [];
  return {
    nombre: partes.join(" ") || "Docente sin nombre registrado",
    iniciales: partes.map(parte => Array.from(parte)[0]).join("").toLocaleUpperCase("es-CL") || "D",
  };
}
