export function calcularVigenciaPlan(
  estado: string,
  inicio: string | null,
  fin: string | null,
  duracionDias: number | null | undefined,
  ahora: number,
) {
  if (estado !== "activa" && estado !== "vencida") return { estado, fin };

  const inicioMs = inicio ? Date.parse(inicio) : NaN;
  const finEstimado = duracionDias && duracionDias > 0 ? inicioMs + duracionDias * 86_400_000 : NaN;
  const finMs = fin ? Date.parse(fin) : finEstimado;
  if (!Number.isFinite(finMs)) {
    return { estado: estado === "activa" ? "sin_vigencia" : estado, fin: null };
  }

  return {
    estado: estado === "activa" && finMs <= ahora ? "vencida" : estado,
    fin: fin ?? new Date(finMs).toISOString(),
  };
}
