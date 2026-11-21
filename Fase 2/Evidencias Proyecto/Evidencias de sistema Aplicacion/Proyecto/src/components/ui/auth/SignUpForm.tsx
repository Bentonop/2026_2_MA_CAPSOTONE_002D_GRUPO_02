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

import { useState, useMemo } from "react";
import { Eye, EyeOff, LoaderCircle, CheckCircle2, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";
import BrandLogo from "@/components/ui/BrandLogo";
import { AuthFormProps } from "./AuthForm";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { validateRut, validateRutDetailed, formatRut, cleanRut } from "@/lib/rut";
import { cn } from "@/lib/utils";

const SignUpForm = ({ setTypeSelected }: AuthFormProps) => {
  const [isLoading, setisLoading] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const router = useRouter();

  // ============ Form Schema ============
  const formSchema = z.object({
    rut: z
      .string()
      .min(1, 'El RUT es obligatorio')
      .refine((val) => validateRut(val), {
        message: 'El RUT ingresado no es válido (verifica el dígito verificador)',
      }),
    nombres: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
    apellidos: z.string().min(3, 'Los apellidos deben tener al menos 3 caracteres'),
    email: z.string().email('Por favor ingresa un correo válido con @ (ejemplo: usuario@mail.com)'),
    password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
    telefono: z.string().min(8, 'Ingresa un número de teléfono válido'),
    codigo_invitacion: z.string().min(6, 'El código de invitación debe tener al menos 6 caracteres'),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    mode: "onChange",
    defaultValues: {
      rut: '',
      nombres: '',
      apellidos: '',
      email: '',
      password: '',
      telefono: '',
      codigo_invitacion: '',
    },
  });

  const { handleSubmit, formState, register, watch, setValue } = form;
  const { errors } = formState;

  // Validación y feedback en tiempo real del RUT
  const rutValue = watch("rut");
  const rutDetails = useMemo(() => {
    if (!rutValue || rutValue.trim() === '') return null;
    return validateRutDetailed(rutValue);
  }, [rutValue]);

  const cleanedRutLength = cleanRut(rutValue).length;
  const isRutComplete = cleanedRutLength >= 8;
  const isRutValid = !!rutDetails?.isValid;
  const showRutError = !isRutValid && isRutComplete;

  // ============ Sign Up ===========
  const onSubmit = async (user: z.infer<typeof formSchema>) => {
    setisLoading(true);

    try {
      if (!supabase) throw new Error("Error de conexión con la base de datos.");

      const rutNormalizado = formatRut(user.rut, false);

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: user.email.trim(),
        password: user.password,
        options: {
          data: {
            nombres: user.nombres.trim(),
            apellidos: user.apellidos.trim(),
            rut: rutNormalizado,
            telefono: user.telefono.trim(),
            codigo_invitacion: user.codigo_invitacion.trim(),
          },
        },
      });

      if (authError) throw authError;

      if (authData.session) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', authData.user!.id)
          .single();

        toast.success('¡Cuenta creada exitosamente!', { duration: 2500 });

        if (profile?.role === 'administrador') router.push('/admin/dashboard');
        else if (profile?.role === 'profesor') router.push('/profesor/dashboard');
        else router.push('/alumno/dashboard');
      } else {
        toast.success('¡Cuenta creada exitosamente! Revisa tu correo.', { duration: 4000 });
        setTypeSelected('sign-in');
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Error al registrar el usuario';
      toast.error(msg, { duration: 4000 });
    } finally {
      setisLoading(false);
    }
  };

  return (
    <div>
      <div className="w-full backdrop-blur-xl rounded-4xl pb-4">
        <div className="text-center mb-6">
          <BrandLogo size="lg" showText={true} className="mb-2" />
          <h2 className="text-2xl font-bold tracking-tight text-on-surface mt-3">Crear Cuenta</h2>
          <p className="text-sm text-secondary mt-1">
            Ingresa tus datos y tu código de invitación para registrarte.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="mx-4">
          <div className="grid gap-2">
            {/* ========== RUT ========= */}
            <Field className="mb-3">
              <div className="flex items-center justify-between">
                <FieldLabel htmlFor="rut">RUT Chileno</FieldLabel>
                {rutDetails && isRutComplete && (
                  <span
                    className={cn(
                      "text-[11px] font-semibold flex items-center gap-1 transition-colors",
                      isRutValid ? "text-emerald-500" : "text-alert"
                    )}
                  >
                    {isRutValid ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        RUT Válido
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-3.5 h-3.5" />
                        DV Incorrecto
                      </>
                    )}
                  </span>
                )}
              </div>
              <div className="relative">
                <Input
                  {...register("rut", {
                    onBlur: (event) => {
                      const cleaned = cleanRut(event.target.value);
                      if (cleaned.length >= 8) {
                        setValue("rut", formatRut(cleaned, false), { shouldValidate: true });
                      }
                    },
                  })}
                  id="rut"
                  placeholder="12345678-9"
                  type="text"
                  disabled={isLoading}
                  aria-invalid={!!errors.rut || showRutError}
                  className={cn(
                    "pr-9 transition-colors",
                    isRutValid && "border-emerald-500/50 focus:border-emerald-500",
                    showRutError && "border-alert/60 focus:border-alert"
                  )}
                />
                {rutDetails && isRutComplete && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    {isRutValid ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-alert" />
                    )}
                  </div>
                )}
              </div>
              {errors.rut && <FieldError>{errors.rut.message}</FieldError>}
              {!errors.rut && showRutError && rutDetails?.message && (
                <p className="text-[11px] text-alert mt-1 font-medium">{rutDetails.message}</p>
              )}
            </Field>

            {/* ========== Nombres ========= */}
            <Field className="mb-3">
              <FieldLabel htmlFor="nombres">Nombres</FieldLabel>
              <Input
                {...register("nombres")}
                id="nombres"
                placeholder="Ej: Juan Pablo"
                type="text"
                autoComplete="given-name"
                disabled={isLoading}
                aria-invalid={!!errors.nombres}
              />
              {errors.nombres && <FieldError>{errors.nombres.message}</FieldError>}
            </Field>

            {/* ========== Apellidos ========= */}
            <Field className="mb-3">
              <FieldLabel htmlFor="apellidos">Apellidos</FieldLabel>
              <Input
                {...register("apellidos")}
                id="apellidos"
                placeholder="Ej: Pérez Gómez"
                type="text"
                autoComplete="family-name"
                disabled={isLoading}
                aria-invalid={!!errors.apellidos}
              />
              {errors.apellidos && <FieldError>{errors.apellidos.message}</FieldError>}
            </Field>

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

            {/* ========== Teléfono ========= */}
            <Field className="mb-3">
              <FieldLabel htmlFor="telefono">Teléfono</FieldLabel>
              <Input
                {...register("telefono")}
                id="telefono"
                placeholder="+56 9 1234 5678"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                disabled={isLoading}
                aria-invalid={!!errors.telefono}
              />
              {errors.telefono && <FieldError>{errors.telefono.message}</FieldError>}
            </Field>

            {/* ========== Password ========= */}
            <Field className="mb-3">
              <FieldLabel htmlFor="password">Contraseña</FieldLabel>
              <div className="relative">
                <Input
                  {...register("password")}
                  id="password"
                  placeholder="Mínimo 6 caracteres"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
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

            {/* ========== Código de Invitación ========= */}
            <Field className="mb-3">
              <FieldLabel htmlFor="codigo_invitacion">Código de Invitación</FieldLabel>
              <Input
                {...register("codigo_invitacion")}
                id="codigo_invitacion"
                placeholder="Ej: 123456"
                type="text"
                inputMode="numeric"
                disabled={isLoading}
                aria-invalid={!!errors.codigo_invitacion}
              />
              {errors.codigo_invitacion && <FieldError>{errors.codigo_invitacion.message}</FieldError>}
            </Field>

            {/* ========== Submit ========= */}
            <Button className="mt-6" type="submit" disabled={isLoading}>
              {isLoading && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
              Crear cuenta
            </Button>
          </div>
        </form>

        {/* ========== Sign In ========= */}
        <p className="text-center text-sm mt-6 text-foreground">
          ¿Ya tienes una cuenta?{" "}
          <span
            onClick={() => !isLoading && setTypeSelected('sign-in')}
            className="underline underline-offset-4 hover:text-primary cursor-pointer font-semibold"
          >
            Inicia Sesión
          </span>
        </p>
      </div>
    </div>
  );
};

export default SignUpForm;
