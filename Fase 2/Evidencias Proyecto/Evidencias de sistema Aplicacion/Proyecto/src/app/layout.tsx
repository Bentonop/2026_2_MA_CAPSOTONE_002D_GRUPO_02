import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Cuerpo y Alma | Academia de Danza y Movimiento",
  description: "Plataforma de gestión de clases, reservas y asistencia QR de Academia Cuerpo y Alma.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" data-scroll-behavior="smooth" className={`${plusJakartaSans.variable}`}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,100..700,0..1,0&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen flex flex-col bg-surface text-on-surface font-sans">
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: "#1E201D",
              color: "#FFFFFF",
              border: "1px solid rgba(212, 167, 44, 0.3)",
              borderRadius: "12px",
              fontSize: "14px",
            },
          }}
        />
        {children}
      </body>
    </html>
  );
}
