import Link from "next/link";
import { BotaoSair } from "@/app/(auth)/navegacao";
import { obterUsuarioAtual } from "@/server/auth/sessao";

export async function Cabecalho() {
  const usuario = await obterUsuarioAtual();
  return (
    <header className="border-b border-slate-200 bg-white">
      <nav className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="text-lg font-bold text-blue-800">
          Voz DF
        </Link>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {usuario?.papel === "OPERADOR_GDF" && (
            <Link href="/simulador-gdf" className="font-medium text-slate-700 hover:text-blue-700">
              Simulador GDF
            </Link>
          )}
          <Link href="/mapa" className="font-medium text-slate-700 hover:text-blue-700">
            Mapa
          </Link>
          <Link href="/acompanhar" className="font-medium text-slate-700 hover:text-blue-700">
            Acompanhar
          </Link>
          {usuario ? (
            <>
              <Link href="/minhas-denuncias" className="font-medium text-slate-700 hover:text-blue-700">
                Minhas denúncias
              </Link>
              <span className="text-slate-600" aria-label="Usuário conectado">
                {usuario.nome}
              </span>
              <BotaoSair />
            </>
          ) : (
            <>
              <Link href="/entrar" className="font-medium text-slate-700 hover:text-blue-700">
                Entrar
              </Link>
              <Link href="/cadastro" className="rounded-lg bg-blue-700 px-3 py-1.5 font-semibold text-white hover:bg-blue-800">
                Criar conta
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
