/**
 * Utilidades para validación y formateo de RUT chileno (Cédula de Identidad / RUN).
 * Basado en el algoritmo oficial de Módulo 11 utilizado por el Registro Civil y el SII de Chile.
 */

/**
 * Limpia una cadena de RUT dejando solo números y el dígito K (en mayúscula).
 */
export function cleanRut(rut: string | null | undefined): string {
    if (!rut || typeof rut !== 'string') return '';
    return rut.replace(/[^0-9kK]/g, '').toUpperCase();
}

/**
 * Calcula el dígito verificador esperado para un cuerpo de RUT utilizando el Algoritmo Módulo 11.
 * @param cuerpo Cadena o número con los dígitos del cuerpo del RUT (sin DV).
 * @returns Dígito verificador ('0'-'9' o 'K').
 */
export function calculateDv(cuerpo: string | number): string {
    const digits = String(cuerpo).replace(/\D/g, '');
    if (!digits) return '';

    let sum = 0;
    let multiplier = 2;

    for (let i = digits.length - 1; i >= 0; i--) {
        sum += parseInt(digits[i], 10) * multiplier;
        multiplier = multiplier === 7 ? 2 : multiplier + 1;
    }

    const remainder = sum % 11;
    const dv = 11 - remainder;

    if (dv === 11) return '0';
    if (dv === 10) return 'K';
    return String(dv);
}

export interface RutValidationResult {
    isValid: boolean;
    clean: string;
    formatted: string;
    cuerpo: string;
    dv: string;
    expectedDv?: string;
    message?: string;
}

/**
 * Valida un RUT chileno de forma detallada.
 */
export function validateRutDetailed(rut: string | null | undefined): RutValidationResult {
    const cleaned = cleanRut(rut);

    if (!cleaned) {
        return {
            isValid: false,
            clean: '',
            formatted: '',
            cuerpo: '',
            dv: '',
            message: 'El RUT es obligatorio.'
        };
    }

    // Un RUT chileno estándar tiene entre 7 y 8 dígitos de cuerpo más 1 dígito verificador (total 8 a 9 caracteres)
    if (cleaned.length < 8 || cleaned.length > 9) {
        return {
            isValid: false,
            clean: cleaned,
            formatted: cleaned,
            cuerpo: cleaned.slice(0, -1),
            dv: cleaned.slice(-1),
            message: 'El RUT debe tener entre 8 y 9 caracteres (ej: 12345678-9).'
        };
    }

    const cuerpo = cleaned.slice(0, -1);
    const dv = cleaned.slice(-1);

    if (!/^\d+$/.test(cuerpo)) {
        return {
            isValid: false,
            clean: cleaned,
            formatted: cleaned,
            cuerpo,
            dv,
            message: 'El cuerpo del RUT solo debe contener números.'
        };
    }

    const expectedDv = calculateDv(cuerpo);
    const isValid = expectedDv === dv;

    const formatted = formatRut(cleaned, true);

    return {
        isValid,
        clean: cleaned,
        formatted,
        cuerpo,
        dv,
        expectedDv,
        message: isValid
            ? 'RUT válido'
            : `El dígito verificador es incorrecto (debería ser ${expectedDv}).`
    };
}

/**
 * Valida si un RUT chileno es válido según el algoritmo Módulo 11.
 * Retorna true si es válido, false en caso contrario.
 */
export function validateRut(rut: string | null | undefined): boolean {
    return validateRutDetailed(rut).isValid;
}

/**
 * Formatea un RUT al estándar chileno.
 * @param rut RUT en cualquier formato (con o sin puntos/guion).
 * @param withDots Si es true genera '12.345.678-9', si es false genera '12345678-9'. Por defecto false.
 */
export function formatRut(rut: string | null | undefined, withDots = false): string {
    const cleaned = cleanRut(rut);
    if (!cleaned) return '';
    if (cleaned.length === 1) return cleaned;

    const cuerpo = cleaned.slice(0, -1);
    const dv = cleaned.slice(-1);

    if (!withDots) {
        return `${cuerpo}-${dv}`;
    }

    const formattedCuerpo = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${formattedCuerpo}-${dv}`;
}
