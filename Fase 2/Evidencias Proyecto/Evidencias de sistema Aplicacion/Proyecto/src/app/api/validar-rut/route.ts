import { NextRequest, NextResponse } from "next/server";
import { validateRutDetailed } from "@/lib/rut";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const rut = searchParams.get("rut");

    if (!rut) {
        return NextResponse.json(
            { valido: false, mensaje: "Debe proporcionar el parámetro 'rut'" },
            { status: 400 }
        );
    }

    const resultado = validateRutDetailed(rut);

    return NextResponse.json({
        valido: resultado.isValid,
        mensaje: resultado.message,
        rutLimpio: resultado.clean,
        rutFormateado: resultado.formatted,
        cuerpo: resultado.cuerpo,
        dvIngresado: resultado.dv,
        dvEsperado: resultado.expectedDv,
    });
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const rut = body?.rut;

        if (!rut || typeof rut !== "string") {
            return NextResponse.json(
                { valido: false, mensaje: "Debe proporcionar el campo 'rut' en el cuerpo JSON" },
                { status: 400 }
            );
        }

        const resultado = validateRutDetailed(rut);

        return NextResponse.json({
            valido: resultado.isValid,
            mensaje: resultado.message,
            rutLimpio: resultado.clean,
            rutFormateado: resultado.formatted,
            cuerpo: resultado.cuerpo,
            dvIngresado: resultado.dv,
            dvEsperado: resultado.expectedDv,
        });
    } catch {
        return NextResponse.json(
            { valido: false, mensaje: "Formato de petición JSON inválido" },
            { status: 400 }
        );
    }
}
