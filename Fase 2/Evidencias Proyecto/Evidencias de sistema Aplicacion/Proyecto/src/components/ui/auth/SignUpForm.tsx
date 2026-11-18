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
import { LoaderCircle, CheckCircle2, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";
import { AuthFormProps } from "./AuthForm";
import { supabase } from "@/lib/supabase"; 
import { useRouter } from "next/navigation"; 
import { validateRut, validateRutDetailed, formatRut, cleanRut } from "@/lib/rut";
import { cn } from "cn";

const SignUpForm = ({ setTypeSelected }: AuthFormProps) => {

    const [isLoading, setisLoading] = useState<boolean>(false)
    const router = useRouter();

    // ============ Form Schema ============
    const formSchema = z.object({
        rut: z
            .string()
            .min(1, 'El RUT es obligatorio')
            .refine((val) => validateRut(val), {
                message: 'El RUT ingresado no es válido (verifica el dígito verificador)',
            }),
        nombres: z.string().min(2, 'Ingresa tus nombres'),
        apellidos: z.string().min(2, 'Ingresa tus apellidos'),
        email: z.string().email('Por favor ingresa un correo válido. Ejemplo: user@mail.com'),
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
        }
    })

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

            // El registro y la verificación de la whitelist son manejados
            // automáticamente por un Trigger en la base de datos de Supabase.
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: user.email,
                password: user.password,
                options: {
                    data: {
                        nombres: user.nombres,
                        apellidos: user.apellidos,
                        rut: rutNormalizado,
                        telefono: user.telefono,
                        codigo_invitacion: user.codigo_invitacion
                    }
                }
            });

            if (authError) throw authError;

            // Si la cuenta se crea y se autologuea inmediatamente
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

        } catch (error: any) {
            toast.error(error.message || 'Error al registrar el usuario', { duration: 4000 });
        } finally {
            setisLoading(false);
        }
    }

    return (
        <div>
            <div className="w-full backdrop-blur-xl rounded-4xl pb-4">

                <div className="text-center">
                    <h1 className="lg:text-5xl md:text-4xl text-3xl font-semibold text-center my-4">
                        Crear Cuenta
                    </h1>

                    <p className="text-sm text-muted-foreground mb-8">
                        Ingresa tus datos para registrarte
                    </p>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="mx-4">
                    <div className="grid gap-2">

                        {/* ========== RUT ========= */}
                        <Field className="mb-3">
                            <div className="flex items-center justify-between">
                                <FieldLabel htmlFor="rut">RUT</FieldLabel>
                                {isRutValid && (
                                    <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                                        <CheckCircle2 className="w-3.5 h-3.5" /> RUT válido
                                    </span>
                                )}
                            </div>
                            <div className="relative">
                                <Input
                                    {...register("rut", {
                                        onBlur: (e) => {
                                            const cleaned = cleanRut(e.target.value);
                                            if (cleaned.length >= 8) {
                                                const formatted = formatRut(cleaned, false);
                                                setValue("rut", formatted, { shouldValidate: true });
                                            }
                                        }
                                    })}
                                    id="rut"
                                    placeholder="12345678-9"
                                    type="text"
                                    disabled={isLoading}
                                    aria-invalid={!!errors.rut || showRutError}
                                    className={cn(
                                        "pr-9 transition-colors",
                                        isRutValid && "border-emerald-500 focus-visible:border-emerald-600 focus-visible:ring-emerald-500/20 text-emerald-950",
                                        showRutError && "border-destructive focus-visible:border-destructive text-destructive"
                                    )}
                                />
                                {isRutComplete && (
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                        {isRutValid ? (
                                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                        ) : (
                                            <AlertCircle className="h-4 w-4 text-destructive" />
                                        )}
                                    </div>
                                )}
                            </div>
                            {errors.rut ? (
                                <FieldError>{errors.rut.message}</FieldError>
                            ) : showRutError && rutDetails ? (
                                <p className="text-xs text-destructive mt-1 flex items-center gap-1 font-medium">
                                    <AlertCircle className="w-3.5 h-3.5" /> {rutDetails.message}
                                </p>
                            ) : null}
                        </Field>

                        {/* ========== Nombres ========= */}
                        <Field className="mb-3">
                            <FieldLabel htmlFor="nombres">Nombres</FieldLabel>
                            <Input
                                {...register("nombres")}
                                id="nombres"
                                placeholder="Ej: Juan Pablo"
                                type="text"
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
                                placeholder="name@example.com"
                                type="email"
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
                                type="text"
                                disabled={isLoading}
                                aria-invalid={!!errors.telefono}
                            />
                            {errors.telefono && <FieldError>{errors.telefono.message}</FieldError>}
                        </Field>

                        {/* ========== Password ========= */}
                        <Field className="mb-3">
                            <FieldLabel htmlFor="password">Contraseña</FieldLabel>
                            <Input
                                {...register("password")}
                                id="password"
                                placeholder="*****"
                                type="password"
                                disabled={isLoading}
                                aria-invalid={!!errors.password}
                            />
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
                                disabled={isLoading}
                                aria-invalid={!!errors.codigo_invitacion}
                            />
                            {errors.codigo_invitacion && <FieldError>{errors.codigo_invitacion.message}</FieldError>}
                        </Field>

                        {/* ========== Submit ========= */}
                        <Button className="mt-6" type="submit" disabled={isLoading}>
                            {isLoading && (
                                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            Crear cuenta
                        </Button>

                    </div>
                </form>

                {/* ========== Sign In ========= */}
                <p className="text-center text-sm mt-6 text-black">
                    ¿Ya tienes una cuenta?{" "}
                    <span
                        onClick={() => !isLoading && setTypeSelected('sign-in')}
                        className="underline underline-offset-4 hover:text-primary cursor-pointer font-medium transition-colors"
                    >
                        Inicia Sesión
                    </span>
                </p>

            </div>
        </div>
    );
}

export default SignUpForm;
