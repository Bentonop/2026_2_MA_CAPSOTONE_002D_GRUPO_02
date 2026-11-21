"use client"

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";

import * as z from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { useState } from "react";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import BrandLogo from "@/components/ui/BrandLogo";
import toast from "react-hot-toast";
import { AuthFormProps } from "./AuthForm";
import { supabase } from "@/lib/supabase";

const SignInForm = ({ setTypeSelected }: AuthFormProps) => {
  const [isLoading, setisLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // ============ Form ============
  const formSchema = z.object({
    email: z.string().email('Por favor ingresa un correo válido con @ (ejemplo: usuario@mail.com)').min(1, {
      message: 'Este campo es requerido',
    }),
    password: z.string().min(6, {
      message: 'La contraseña debe tener al menos 6 caracteres',
    }),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const { handleSubmit, formState, register } = form;
  const { errors } = formState;

  // ============ Sign In ===========
  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    setisLoading(true);
    setErrorMessage(null);

    try {
      if (!supabase) throw new Error("Error de conexión con la base de datos.");

      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: data.email.trim(),
        password: data.password,
      });

      if (error) throw error;

      // Get user role to redirect
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', authData.user.id)
        .single();

      toast.success('Inicio de sesión exitoso', { duration: 2500 });

      if (profile?.role === 'administrador') {
        window.location.href = '/admin/dashboard';
      } else if (profile?.role === 'profesor') {
        window.location.href = '/profesor/dashboard';
      } else {
        window.location.href = '/alumno/dashboard';
      }
    } catch (error: unknown) {
      let msg = error instanceof Error ? error.message : 'Error al iniciar sesión';
      const code = error instanceof Error && 'code' in error ? error.code : undefined;
      const normalizedMessage = msg.toLowerCase();
      if (code === 'invalid_credentials' || normalizedMessage.includes('invalid login credentials') || normalizedMessage.includes('invalid credentials')) {
        msg = 'Correo o contraseña incorrectos. Por favor verifica tus datos e inténtalo de nuevo.';
      } else if (normalizedMessage.includes('email not confirmed')) {
        msg = 'Tu correo aún no ha sido confirmado. Revisa tu bandeja de entrada.';
      }
      setErrorMessage(msg);
      toast.error(msg, { duration: 4000 });
    } finally {
      setisLoading(false);
    }
  };

  return (
    <div>
      <div className="w-full backdrop-blur-xl py-2 rounded-4xl">
        <div className="text-center mb-6">
          <BrandLogo size="lg" showText={true} className="mb-2" />
          <h2 className="text-2xl font-bold tracking-tight text-on-surface mt-3">Iniciar Sesión</h2>
          <p className="text-sm text-secondary mt-1">
            Ingresa tus credenciales para acceder a tu cuenta.
          </p>
        </div>

        {errorMessage && (
          <p role="alert" className="mb-3 text-sm text-destructive">{errorMessage}</p>
        )}
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-2">
            {/* ========== Email ========= */}
            <Field className="mb-3">
              <FieldLabel htmlFor="email">Correo</FieldLabel>
              <Input
                {...register("email")}
                id="email"
                placeholder="usuario@ejemplo.com"
                type="email"
                inputMode="email"
                autoComplete="email"
                disabled={isLoading}
                aria-invalid={!!errors.email}
              />
              {errors.email && <FieldError>{errors.email.message}</FieldError>}
            </Field>

            {/* ========== Password ========= */}
            <Field className="mb-3">
              <FieldLabel htmlFor="password">Contraseña</FieldLabel>
              <div className="relative">
                <Input
                  {...register("password")}
                  id="password"
                  placeholder="Ingresa tu contraseña"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  disabled={isLoading}
                  aria-invalid={!!errors.password}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Ocultar contraseña" : "Ver contraseña"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary hover:text-on-surface transition-colors p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <FieldError>{errors.password.message}</FieldError>}
            </Field>

            <div
              onClick={() => setTypeSelected('recover-password')}
              className="underline text-foreground underline-offset-4 hover:text-primary mb-6 text-sm text-end cursor-pointer"
            >
              ¿Olvidaste tu contraseña?
            </div>

            {/* ========== Submit ========= */}
            <Button type="submit" disabled={isLoading}>
              {isLoading && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
              Ingresar
            </Button>
          </div>
        </form>

        {/* ========== Sign Up ========= */}
        <p className="text-center text-sm text-foreground mt-4">
          {"¿No tienes cuenta?  "}
          <span
            onClick={() => setTypeSelected('sign-up')}
            className="underline underline-offset-4 hover:text-primary cursor-pointer font-semibold"
          >
            Regístrate
          </span>
        </p>
      </div>
    </div>
  );
};

export default SignInForm;
