import Link from "next/link";
import BrandLogo from "@/components/ui/BrandLogo";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-surface text-on-surface px-6 text-center relative overflow-hidden">
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center max-w-md gap-4">
        <BrandLogo size="lg" showText={true} />
        <span className="mt-2 px-3 py-1 rounded-full bg-primary/15 text-primary font-label-caps uppercase tracking-widest">
          Error 404
        </span>
        <h1 className="font-headline-lg text-on-surface">
          Página no encontrada
        </h1>
        <p className="font-body-md text-secondary">
          La dirección que buscas no existe o fue movida. Vuelve al inicio para continuar navegando en Cuerpo y Alma.
        </p>
        <Link
          href="/"
          className="premium-btn mt-2"
        >
          <span className="material-symbols-outlined text-[20px]">home</span>
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
