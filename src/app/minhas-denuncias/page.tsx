import type { Metadata } from "next";
import Link from "next/link";
import { SeloStatus, formatarData } from "@/components/status";
import { Cartao } from "@/components/ui";
import { exigirUsuario } from "@/server/auth/sessao";
import { db } from "@/server/db";
import { listarDoAutor } from "@/server/denuncias/consulta";

export const metadata: Metadata = { title: "Minhas denúncias — Voz DF" };

export default async function MinhasDenunciasPage() {
  const usuario = await exigirUsuario(undefined, "/minhas-denuncias");
  const denuncias = await listarDoAutor(db, usuario.id);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Minhas denúncias</h1>
        <Link href="/denunciar" className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800">
          Nova denúncia
        </Link>
      </div>

      {denuncias.length === 0 ? (
        <Cartao>
          <p className="text-slate-700">Você ainda não fez denúncias com esta conta.</p>
          <p className="mt-1 text-sm text-slate-500">Denúncias enviadas sem identificação não aparecem aqui.</p>
        </Cartao>
      ) : (
        <ul className="flex flex-col gap-3">
          {denuncias.map((d) => (
            <li key={d.protocolo}>
              <Link
                href={`/acompanhar/${d.protocolo}`}
                className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-sm font-semibold text-slate-900">{d.protocolo}</span>
                  <SeloStatus status={d.status} />
                </div>
                <p className="mt-2 line-clamp-2 text-slate-800">{d.descricao}</p>
                <p className="mt-2 text-xs text-slate-500">
                  {d.categoria.nome} · {d.ra.nome} · {formatarData(d.criadoEm)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
