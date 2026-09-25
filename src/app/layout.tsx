import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Cabecalho } from "@/components/cabecalho";
import { RegistrarServiceWorker } from "@/components/registrar-sw";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Voz DF",
  description: "Rede Central de Denúncias do Distrito Federal (projeto acadêmico)",
  applicationName: "Voz DF",
  appleWebApp: { capable: true, title: "Voz DF", statusBarStyle: "default" },
  // Ícones pela convenção de arquivos: src/app/icon.svg e src/app/apple-icon.png (scripts/gerar-icones.mts).
};

export const viewport: Viewport = { themeColor: "#1d4ed8" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <Cabecalho />
        {children}
        <RegistrarServiceWorker />
      </body>
    </html>
  );
}
