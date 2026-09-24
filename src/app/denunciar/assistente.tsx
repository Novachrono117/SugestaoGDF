"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alerta, Botao } from "@/components/ui";
import type { Ponto } from "@/components/mapa-seletor";
import { resolverOrgaoSugerido } from "@/domain/orgao";
import { classificacaoSchema, novaDenunciaSchema } from "@/lib/validation/denuncia";
import type { SugestaoClassificacao } from "@/server/classificador/tipos";
import { PassoDescricao, PassoLocal, PassoSugestao } from "./passos";
import type { CategoriaOpcao, Foto, RegiaoOpcao } from "./tipos";

const PASSOS = ["Descrição", "Categoria", "Local", "Revisão"] as const;

type Props = {
  categorias: CategoriaOpcao[];
  regioes: RegiaoOpcao[];
  usuario: { nome: string } | null;
};

async function mensagemDeErro(res: Response): Promise<string> {
  const corpo = await res.json().catch(() => null);
  return corpo?.error?.message ?? "Algo deu errado. Tente novamente.";
}

export function AssistenteDenuncia({ categorias, regioes, usuario }: Props) {
  const router = useRouter();
  const [passo, setPasso] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const [descricao, setDescricao] = useState("");
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [sugestao, setSugestao] = useState<SugestaoClassificacao | null>(null);
  const [categoriaSlug, setCategoriaSlug] = useState("");
  const [ponto, setPonto] = useState<Ponto | null>(null);
  const [raCodigo, setRaCodigo] = useState("");
  const [endereco, setEndereco] = useState("");
  const [anonima, setAnonima] = useState(false);

  const categoria = categorias.find((c) => c.slug === categoriaSlug);
  const ra = regioes.find((r) => r.codigo === raCodigo);
  const orgaoProvavel = categoria && ra ? resolverOrgaoSugerido(categoria.orgao, ra.nome) : categoria?.orgao;

  function irPara(n: number) {
    setErro(null);
    setPasso(n);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function analisar() {
    const v = classificacaoSchema.safeParse({ descricao });
    if (!v.success) return setErro(v.error.issues[0].message);
    setOcupado(true);
    setErro(null);
    try {
      const res = await fetch("/api/v1/classificacoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ descricao }),
      });
      if (!res.ok) return setErro(await mensagemDeErro(res));
      const s: SugestaoClassificacao = await res.json();
      setSugestao(s);
      setCategoriaSlug(s.categoriaSlug);
      irPara(1);
    } catch {
      setErro("Sem conexão. Verifique sua internet e tente de novo.");
    } finally {
      setOcupado(false);
    }
  }

  function validarLocal() {
    const v = novaDenunciaSchema.safeParse({
      descricao,
      categoriaSlug,
      raCodigo,
      latitude: ponto?.lat,
      longitude: ponto?.lng,
      enderecoReferencia: endereco,
    });
    if (!ponto) return setErro("Marque o local do problema no mapa.");
    if (!v.success) return setErro(v.error.issues[0].message);
    irPara(3);
  }

  async function enviar() {
    if (!ponto) return;
    setOcupado(true);
    setErro(null);
    const form = new FormData();
    form.set("descricao", descricao);
    form.set("categoriaSlug", categoriaSlug);
    form.set("raCodigo", raCodigo);
    form.set("latitude", String(ponto.lat));
    form.set("longitude", String(ponto.lng));
    if (endereco.trim()) form.set("enderecoReferencia", endereco.trim());
    form.set("anonima", String(anonima || !usuario));
    for (const f of fotos) form.append("fotos", f.arquivo);
    try {
      const res = await fetch("/api/v1/denuncias", { method: "POST", body: form });
      if (!res.ok) return setErro(await mensagemDeErro(res));
      const { protocolo } = await res.json();
      fotos.forEach((f) => URL.revokeObjectURL(f.url));
      router.push(`/acompanhar/${protocolo}?nova=1`);
    } catch {
      setErro("Sem conexão. Sua denúncia não foi enviada; tente de novo.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <ol className="grid grid-cols-4 gap-2" aria-label="Etapas">
        {PASSOS.map((nome, i) => (
          <li key={nome} aria-current={i === passo ? "step" : undefined} className="flex flex-col gap-1">
            <span className={`h-1.5 rounded-full ${i <= passo ? "bg-blue-700" : "bg-slate-200"}`} />
            <span className={`text-xs ${i === passo ? "font-semibold text-blue-800" : "text-slate-500"}`}>
              {i + 1}. {nome}
            </span>
          </li>
        ))}
      </ol>

      {erro && <Alerta>{erro}</Alerta>}

      {passo === 0 && (
        <>
          <PassoDescricao descricao={descricao} onDescricao={setDescricao} fotos={fotos} onFotos={setFotos} />
          <Botao onClick={analisar} disabled={ocupado}>
            {ocupado ? "Analisando seu relato…" : "Continuar"}
          </Botao>
        </>
      )}

      {passo === 1 && sugestao && (
        <>
          <PassoSugestao sugestao={sugestao} categorias={categorias} categoriaSlug={categoriaSlug} onCategoria={setCategoriaSlug} />
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            <Botao variante="secundario" onClick={() => irPara(0)}>
              Voltar
            </Botao>
            <Botao onClick={() => irPara(2)} disabled={!categoriaSlug}>
              {categoriaSlug === sugestao.categoriaSlug ? "Sim, é isso" : "Continuar com a minha escolha"}
            </Botao>
          </div>
        </>
      )}

      {passo === 2 && (
        <>
          <PassoLocal
            categoria={{ slug: categoriaSlug, nome: categoria?.nome ?? "" }}
            logado={Boolean(usuario)}
            ponto={ponto}
            onPonto={setPonto}
            raCodigo={raCodigo}
            onRa={setRaCodigo}
            endereco={endereco}
            onEndereco={setEndereco}
            regioes={regioes}
          />
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            <Botao variante="secundario" onClick={() => irPara(1)}>
              Voltar
            </Botao>
            <Botao onClick={validarLocal}>Revisar</Botao>
          </div>
        </>
      )}

      {passo === 3 && (
        <>
          <dl className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
            {[
              ["Relato", descricao],
              ["Categoria", categoria?.nome],
              ["Órgão provável (o GDF decide)", orgaoProvavel ? `${orgaoProvavel.nome} (${orgaoProvavel.sigla})` : "—"],
              ["Região", ra?.nome],
              ["Referência", endereco || "—"],
              ["Fotos", fotos.length ? `${fotos.length} foto(s)` : "Nenhuma"],
            ].map(([rotulo, valor]) => (
              <div key={rotulo} className="grid gap-1 p-3 sm:grid-cols-3">
                <dt className="text-sm font-medium text-slate-600">{rotulo}</dt>
                <dd className="whitespace-pre-wrap break-words text-sm text-slate-900 sm:col-span-2">{valor}</dd>
              </div>
            ))}
          </dl>

          {usuario ? (
            <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3">
              <input type="checkbox" checked={anonima} onChange={(e) => setAnonima(e.target.checked)} className="mt-1 h-5 w-5" />
              <span className="text-sm text-slate-800">
                <strong>Enviar sem me identificar.</strong> A denúncia não ficará em “Minhas denúncias”; guarde o protocolo
                para acompanhar.
              </span>
            </label>
          ) : (
            <Alerta tipo="info">
              Você está enviando <strong>sem se identificar</strong>. Guarde o protocolo para acompanhar.{" "}
              <Link href="/entrar?voltar=/denunciar" className="font-semibold underline">
                Entrar
              </Link>{" "}
              para ver em “Minhas denúncias” (o texto preenchido será perdido).
            </Alerta>
          )}

          <p className="text-xs text-slate-500">
            Seus dados pessoais não são enviados ao GDF nem aparecem no mapa público.
          </p>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            <Botao variante="secundario" onClick={() => irPara(2)} disabled={ocupado}>
              Voltar
            </Botao>
            <Botao onClick={enviar} disabled={ocupado}>
              {ocupado ? "Enviando…" : "Enviar denúncia"}
            </Botao>
          </div>
        </>
      )}
    </div>
  );
}
