"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as z from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "react-hot-toast";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import BrandLogo from "@/components/ui/BrandLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";

const resetSchema = z
  .object({
    password: z.string().min(6, "La nueva contraseña debe tener al menos 6 caracteres"),
    confirmPassword: z.string().min(6, "Confirma tu nueva contraseña"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

export default function ActualizarContrasenaPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof resetSchema>>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const onSubmit = async (values: z.infer<typeof resetSchema>) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: values.password,
      });
      if (error) throw error;

      toast.success("Contraseña actualizada con éxito. Ahora puedes iniciar sesión.");
      router.push("/");
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "No se pudo actualizar la contraseña. Solicita un nuevo enlace de recuperación.";
      toast.error(message, { duration: 4000 });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-surface p-margin-mobile relative overflow-hidden">
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

      <div className="flex flex-col items-center justify-center flex-1 relative z-10 py-8">
        <div className="w-full max-w-md bg-surface-container-lowest border border-surface-container rounded-3xl p-6 shadow-sm">
          <div className="text-center mb-6">
            <BrandLogo size="lg" showText={true} className="mb-2" />
            <h1 className="text-2xl font-bold tracking-tight text-on-surface mt-3">
              Nueva Contraseña
            </h1>
            <p className="text-sm text-secondary mt-1">
              Elige una contraseña segura de al menos 6 caracteres.
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="grid gap-3">
            <Field>
              <FieldLabel htmlFor="password">Nueva Contraseña</FieldLabel>
              <div className="relative">
                <Input
                  {...register("password")}
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Mínimo 6 caracteres"
                  disabled={isLoading}
                  aria-invalid={!!errors.password}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Ocultar contraseña" : "Ver contraseña"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary hover:text-on-surface transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <FieldError>{errors.password.message}</FieldError>}
            </Field>

            <Field>
              <FieldLabel htmlFor="confirmPassword">Confirmar Contraseña</FieldLabel>
              <div className="relative">
                <Input
                  {...register("confirmPassword")}
                  id="confirmPassword"
                  type={showConfirm ? "text" : "password"}
                  placeholder="Repite tu contraseña"
                  disabled={isLoading}
                  aria-invalid={!!errors.confirmPassword}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  aria-label={showConfirm ? "Ocultar confirmación" : "Ver confirmación"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary hover:text-on-surface transition-colors"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.confirmPassword && <FieldError>{errors.confirmPassword.message}</FieldError>}
            </Field>

            <Button type="submit" disabled={isLoading} className="mt-2">
              {isLoading && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
              Guardar nueva contraseña
            </Button>
          </form>

          <p className="text-center text-sm text-foreground mt-5">
            <Link href="/" className="underline underline-offset-4 hover:text-primary">
              Volver al inicio de sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
