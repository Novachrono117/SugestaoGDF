import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
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
        <a
          href="#conteudo"
          // Fora da tela até receber foco (sr-only + not-sr-only zeraria o padding do botão).
          className="fixed left-4 top-3 z-50 -translate-y-[200%] rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white focus:translate-y-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
        >
          Pular para o conteúdo
        </a>
        <Cabecalho />
        <div id="conteudo" tabIndex={-1} className="flex flex-1 flex-col focus:outline-none">
          {children}
        </div>
        <footer className="border-t border-slate-200 bg-white">
          <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-4 text-sm text-slate-600">
            <Link href="/privacidade" className="font-medium underline hover:text-blue-700">
              Aviso de privacidade
            </Link>
            <Link href="/transparencia" className="font-medium underline hover:text-blue-700">
              Transparência
            </Link>          </div>
        </footer>
        <RegistrarServiceWorker />
      </body>
    </html>
  );
}
