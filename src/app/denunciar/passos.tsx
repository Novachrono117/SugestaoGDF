"use client";

import dynamic from "next/dynamic";
import { useRef, useState, type ChangeEvent } from "react";
import { Alerta, Botao, Campo } from "@/components/ui";
import type { Ponto } from "@/components/mapa-seletor";
import { LIMITES_DF } from "@/lib/validation/denuncia";
import type { SugestaoClassificacao } from "@/server/classificador/tipos";
import type { DenunciaProxima } from "@/server/denuncias/apoios";
import { CartaoDuplicatas } from "./duplicatas";
import { FOTOS, type CategoriaOpcao, type Foto, type RegiaoOpcao } from "./tipos";

const TIPOS_ACEITOS: readonly string[] = FOTOS.tiposAceitos;
const MAX_FOTOS = FOTOS.max;
const MAX_MB = FOTOS.maxMbPadrao;
const ESTILO_BOTAO_FOTO =
  "h-24 w-24 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 text-center text-xs font-medium text-slate-600 hover:border-blue-500 hover:text-blue-700 focus-within:ring-2 focus-within:ring-blue-600";

const MapaSeletor = dynamic(() => import("@/components/mapa-seletor"), {
  ssr: false,
  loading: () => <div className="h-72 w-full animate-pulse rounded-xl bg-slate-200 sm:h-96" aria-hidden />,
});

// ---------------------------------------------------------------- ① descrição + fotos
export function PassoDescricao({
  descricao,
  onDescricao,
  fotos,
  onFotos,
}: {
  descricao: string;
  onDescricao: (v: string) => void;
  fotos: Foto[];
  onFotos: (f: Foto[]) => void;
}) {
  const [erroFoto, setErroFoto] = useState<string | null>(null);

  function adicionar(e: ChangeEvent<HTMLInputElement>) {
    const novos = Array.from(e.target.files ?? []);
    e.target.value = ""; // permite escolher o mesmo arquivo de novo
    const invalido = novos.find((f) => !TIPOS_ACEITOS.includes(f.type) || f.size > MAX_MB * 1024 * 1024);
    if (invalido) return setErroFoto(`"${invalido.name}": use JPEG, PNG ou WebP de até ${MAX_MB} MB.`);
    if (fotos.length + novos.length > MAX_FOTOS) return setErroFoto(`Máximo de ${MAX_FOTOS} fotos.`);
    setErroFoto(null);
    onFotos([...fotos, ...novos.map((arquivo) => ({ arquivo, url: URL.createObjectURL(arquivo) }))]);
  }

  function remover(i: number) {
    URL.revokeObjectURL(fotos[i].url);
    onFotos(fotos.filter((_, j) => j !== i));
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <label htmlFor="descricao" className="text-base font-semibold text-slate-900">
          O que está acontecendo?
        </label>
        <p id="descricao-dica" className="text-sm text-slate-600">
          Conte com suas palavras. Não precisa saber qual órgão é responsável — a gente ajuda com isso.
        </p>
        <textarea
          id="descricao"
          value={descricao}
          onChange={(e) => onDescricao(e.target.value)}
          rows={5}
          maxLength={2000}
          aria-describedby="descricao-dica descricao-contador"
          placeholder="Ex.: O poste da minha rua está apagado há uma semana e a rua fica muito escura à noite."
          className="mt-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/30"
        />
        <p id="descricao-contador" className="text-right text-xs text-slate-500">
          {descricao.trim().length}/2000 {descricao.trim().length < 10 && "· mínimo 10 caracteres"}
        </p>
        <p className="text-xs text-slate-500">
          Evite colocar nomes, telefones ou placas de outras pessoas.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-base font-semibold text-slate-900">Fotos (opcional)</span>
        <p className="text-sm text-slate-600">
          Até {MAX_FOTOS} fotos. Removemos a localização e outros dados escondidos da imagem antes de salvar.
        </p>
        {erroFoto && <Alerta>{erroFoto}</Alerta>}
        <div className="flex flex-wrap gap-3">
          {fotos.map((f, i) => (
            <div key={f.url} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element -- prévia local (blob:) */}
              <img src={f.url} alt={`Foto ${i + 1}`} className="h-24 w-24 rounded-lg object-cover" />
              <button
                type="button"
                onClick={() => remover(i)}
                className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-white shadow"
                aria-label={`Remover foto ${i + 1}`}
              >
                ×
              </button>
            </div>
          ))}
          {fotos.length < MAX_FOTOS && (
            <>
              {/* Câmera só em tela de toque: no computador `capture` é ignorado e viraria um 2º "escolher arquivo". */}
              <label className={`${ESTILO_BOTAO_FOTO} hidden pointer-coarse:flex`}>
                <span className="text-2xl" aria-hidden>
                  📷
                </span>
                Câmera
                <input type="file" accept={TIPOS_ACEITOS.join(",")} capture="environment" onChange={adicionar} className="sr-only" />
              </label>
              <label className={`${ESTILO_BOTAO_FOTO} flex`}>
                <span className="text-2xl" aria-hidden>
                  +
                </span>
                Galeria
                <input type="file" accept={TIPOS_ACEITOS.join(",")} multiple onChange={adicionar} className="sr-only" />
              </label>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- ② sugestão da IA
export function PassoSugestao({
  sugestao,
  categorias,
  categoriaSlug,
  onCategoria,
}: {
  sugestao: SugestaoClassificacao;
  categorias: CategoriaOpcao[];
  categoriaSlug: string;
  onCategoria: (slug: string) => void;
}) {
  const [trocando, setTrocando] = useState(false);
  const porSlug = new Map(categorias.map((c) => [c.slug, c]));
  const sugerida = porSlug.get(sugestao.categoriaSlug);
  const escolhida = porSlug.get(categoriaSlug);
  const trocou = categoriaSlug !== sugestao.categoriaSlug;

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
        <p className="text-sm font-medium text-blue-900">
          {sugestao.origem === "LLM" ? "Nossa IA analisou seu relato" : "Sugestão automática (modo simplificado)"}
        </p>
        <p className="mt-2 text-lg font-bold text-slate-900">Parece ser: {sugerida?.nome ?? sugestao.categoriaSlug}</p>
        <p className="mt-1 text-sm text-slate-700">
          Órgão provável: <strong>{sugerida?.orgao.nome}</strong> ({sugerida?.orgao.sigla})
        </p>
        <p className="mt-2 text-sm italic text-slate-600">“{sugestao.justificativa}”</p>
        <p className="mt-3 text-xs text-slate-600">
          A IA só sugere. Quem decide o órgão responsável é o GDF.
        </p>
      </div>

      {trocou && escolhida && (
        <Alerta tipo="sucesso">
          Categoria escolhida por você: <strong>{escolhida.nome}</strong>
        </Alerta>
      )}

      {!trocando ? (
        <div className="flex flex-col gap-3">
          {sugestao.alternativas.length > 0 && (
            <div>
              <p className="mb-2 text-sm text-slate-700">Ou talvez seja:</p>
              <div className="flex flex-wrap gap-2">
                {sugestao.alternativas.map((slug) => (
                  <button
                    key={slug}
                    type="button"
                    onClick={() => onCategoria(slug)}
                    aria-pressed={categoriaSlug === slug}
                    className="min-h-11 rounded-full border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 hover:border-blue-500 aria-pressed:border-blue-700 aria-pressed:bg-blue-700 aria-pressed:text-white"
                  >
                    {porSlug.get(slug)?.nome ?? slug}
                  </button>
                ))}
              </div>
            </div>
          )}
          <button type="button" onClick={() => setTrocando(true)} className="self-start text-sm font-semibold text-blue-700 underline">
            Nenhuma dessas — escolher outra categoria
          </button>
        </div>
      ) : (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-semibold text-slate-900">Escolha a categoria</legend>
          {categorias.map((c) => (
            <label
              key={c.slug}
              className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 has-[:checked]:border-blue-600 has-[:checked]:bg-blue-50"
            >
              <input
                type="radio"
                name="categoria"
                value={c.slug}
                checked={categoriaSlug === c.slug}
                onChange={() => onCategoria(c.slug)}
                className="mt-1"
              />
              <span>
                <span className="block font-medium text-slate-900">{c.nome}</span>
                <span className="block text-xs text-slate-600">{c.descricao}</span>
              </span>
            </label>
          ))}
        </fieldset>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- ③ local
function dentroDoDf(p: Ponto) {
  return p.lat >= LIMITES_DF.latMin && p.lat <= LIMITES_DF.latMax && p.lng >= LIMITES_DF.lngMin && p.lng <= LIMITES_DF.lngMax;
}

export function PassoLocal({
  ponto,
  onPonto,
  raCodigo,
  onRa,
  endereco,
  onEndereco,
  regioes,
  categoria,
  logado,
}: {
  categoria: { slug: string; nome: string };
  logado: boolean;
  ponto: Ponto | null;
  onPonto: (p: Ponto) => void;
  raCodigo: string;
  onRa: (v: string) => void;
  endereco: string;
  onEndereco: (v: string) => void;
  regioes: RegiaoOpcao[];
}) {
  const [gps, setGps] = useState<{ estado: "ocioso" | "buscando" | "erro"; msg?: string }>({ estado: "ocioso" });
  const [centralizar, setCentralizar] = useState<Ponto | null>(null);
  const [deteccao, setDeteccao] = useState<{ estado: "ocioso" | "buscando" | "achou" | "nao-achou"; nome?: string }>({
    estado: "ocioso",
  });
  const ultimaConsulta = useRef(0);
  const [proximas, setProximas] = useState<DenunciaProxima[]>([]);
  const [ignorouDuplicatas, setIgnorouDuplicatas] = useState(false);

  // Sugere a RA pelo ponto (limites oficiais). Só sugere: o select continua editável.
  async function marcar(p: Ponto) {
    onPonto(p);
    const id = ++ultimaConsulta.current; // descarta respostas de cliques anteriores
    setDeteccao({ estado: "buscando" });
    // Possíveis duplicatas (mesma categoria, perto do ponto) — em paralelo com a detecção da RA.
    fetch(`/api/v1/denuncias/proximas?lat=${p.lat}&lng=${p.lng}&categoria=${encodeURIComponent(categoria.slug)}`)
      .then((r) => (r.ok ? (r.json() as Promise<DenunciaProxima[]>) : []))
      .then((lista) => {
        if (id === ultimaConsulta.current) {
          setProximas(lista);
          setIgnorouDuplicatas(false);
        }
      })
      .catch(() => {});
    try {
      const res = await fetch(`/api/v1/regioes/detectar?lat=${p.lat}&lng=${p.lng}`);
      const { ra } = (await res.json()) as { ra: { codigo: string; nome: string } | null };
      if (id !== ultimaConsulta.current) return;
      if (ra) {
        onRa(ra.codigo);
        setDeteccao({ estado: "achou", nome: ra.nome });
      } else {
        setDeteccao({ estado: "nao-achou" });
      }
    } catch {
      if (id === ultimaConsulta.current) setDeteccao({ estado: "nao-achou" });
    }
  }

  function usarMinhaLocalizacao() {
    if (!navigator.geolocation) return setGps({ estado: "erro", msg: "Seu navegador não informa a localização." });
    setGps({ estado: "buscando" });
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const p = { lat: coords.latitude, lng: coords.longitude };
        if (!dentroDoDf(p)) return setGps({ estado: "erro", msg: "Sua localização parece estar fora do DF. Marque no mapa." });
        setGps({ estado: "ocioso" });
        void marcar(p);
        setCentralizar(p);
      },
      () => setGps({ estado: "erro", msg: "Não foi possível obter sua localização. Marque no mapa." }),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  function selecionar(p: Ponto) {
    if (!dentroDoDf(p)) return setGps({ estado: "erro", msg: "Esse ponto está fora do DF." });
    setGps({ estado: "ocioso" });
    void marcar(p);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <span className="text-base font-semibold text-slate-900">Onde fica o problema?</span>
        <p className="text-sm text-slate-600">Toque no mapa para marcar o local, ou use sua localização atual.</p>
        <Botao type="button" variante="secundario" onClick={usarMinhaLocalizacao} disabled={gps.estado === "buscando"} className="self-start">
          {gps.estado === "buscando" ? "Buscando localização…" : "📍 Usar minha localização"}
        </Botao>
        {gps.estado === "erro" && <Alerta>{gps.msg}</Alerta>}
        <MapaSeletor ponto={ponto} onSelecionar={selecionar} centralizarEm={centralizar} />
        <p className="text-xs text-slate-500" aria-live="polite">
          {ponto ? `Local marcado: ${ponto.lat.toFixed(5)}, ${ponto.lng.toFixed(5)}` : "Nenhum local marcado ainda."}
        </p>
      </div>

      {proximas.length > 0 && !ignorouDuplicatas && (
        <CartaoDuplicatas
          itens={proximas}
          categoriaNome={categoria.nome}
          logado={logado}
          onIgnorar={() => setIgnorouDuplicatas(true)}
        />
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="ra" className="text-sm font-medium text-slate-800">
          Região Administrativa
        </label>
        <p id="ra-dica" className="text-xs text-slate-600" aria-live="polite">
          {deteccao.estado === "buscando" && "Identificando a região pelo mapa…"}
          {deteccao.estado === "achou" && (
            <>
              Identificamos <strong>{deteccao.nome}</strong> pelo local marcado. Se estiver errado, troque abaixo.
            </>
          )}
          {deteccao.estado === "nao-achou" && "Não conseguimos identificar a região por esse ponto. Selecione abaixo."}
        </p>
        <select
          id="ra"
          aria-describedby="ra-dica"
          value={raCodigo}
          onChange={(e) => onRa(e.target.value)}
          className="min-h-11 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/30"
        >
          <option value="">Selecione…</option>
          {regioes.map((r) => (
            <option key={r.codigo} value={r.codigo}>
              {r.nome}
            </option>
          ))}
        </select>
      </div>

      <Campo
        id="endereco"
        label="Ponto de referência (opcional)"
        value={endereco}
        onChange={(e) => onEndereco(e.target.value)}
        maxLength={300}
        placeholder="Ex.: QNM 12, em frente à escola"
      />
    </div>
  );
}
