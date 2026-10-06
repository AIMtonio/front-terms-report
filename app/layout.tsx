import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Generador de Autorizaciones",
  description: "Genera de forma masiva las autorizaciones de consulta y reporte en PDF.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
