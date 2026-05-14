import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ANKA Joyería — Dashboard",
  description: "Resultados de marketing y ventas",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className={`${geist.className} min-h-full bg-[#faf9f7]`}>{children}</body>
    </html>
  );
}
