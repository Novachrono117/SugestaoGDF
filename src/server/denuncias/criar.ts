// Criação da denúncia: reclassifica no servidor, grava tudo numa transação e tenta enviar ao GDF.
import type { NovaDenuncia } from "@/lib/validation/denuncia";
import type { Classificador } from "../classificador";
import { ErroDominio } from "../erros";
import { gerarProtocolo } from "../protocolo";
import { enviarDenunciaAoGdf, type EnvioDeps } from "./envio-gdf";

export type CriarDenunciaDeps = EnvioDeps & { classificador: Classificador; agora?: () => Date };

export type AnexoSalvo = { token: string; caminho: string; mime: string; tamanho: number };

export type DenunciaCriada = {
  protocolo: string;
  enviadaAoGdf: boolean;
};

export async function criarDenuncia(
  deps: CriarDenunciaDeps,
  input: NovaDenuncia,
  autorId: string | null,
  anexos: AnexoSalvo[] = [],
): Promise<DenunciaCriada> {
  const { db, classificador } = deps;

  const [categoria, ra] = await Promise.all([
    db.categoria.findFirst({ where: { slug: input.categoriaSlug, ativa: true } }),
    db.regiaoAdministrativa.findUnique({ where: { codigo: input.raCodigo } }),
  ]);
  if (!categoria) throw new ErroDominio("CATEGORIA_INVALIDA", "Categoria inexistente ou inativa.", 422);
  if (!ra) throw new ErroDominio("RA_INVALIDA", "Região Administrativa inexistente.", 422);

  // Não confia na sugestão exibida no navegador: reclassifica aqui (temperature 0 → mesmo resultado).
  const sugestao = await classificador.classificar(input.descricao);
  const [categoriaSugerida, orgaoSugerido] = await Promise.all([
    db.categoria.findUnique({ where: { slug: sugestao.categoriaSlug } }),
    db.orgao.findUnique({ where: { sigla: sugestao.orgaoSigla } }),
  ]);
  if (!categoriaSugerida || !orgaoSugerido) {
    throw new Error(`Sugestão aponta para categoria/órgão inexistente: ${sugestao.categoriaSlug}/${sugestao.orgaoSigla}`);
  }

  const agora = deps.agora?.() ?? new Date();
  const denuncia = await db.$transaction(async (tx) => {
    const protocolo = await gerarProtocolo(tx, agora);
    return tx.denuncia.create({
      data: {
        protocolo,
        descricao: input.descricao,
        categoriaId: categoria.id,
        raId: ra.id,
        latitude: input.latitude,
        longitude: input.longitude,
        enderecoReferencia: input.enderecoReferencia,
        autorId,
        criadoEm: agora,
        sugestao: {
          create: {
            categoriaId: categoriaSugerida.id,
            orgaoId: orgaoSugerido.id,
            confianca: sugestao.confianca,
            justificativa: sugestao.justificativa,
            origem: sugestao.origem,
            modelo: sugestao.modelo,
            cidadaoConfirmou: sugestao.categoriaSlug === categoria.slug,
          },
        },
        anexos: { create: anexos },
        eventos: {
          create: {
            ator: autorId ? "CIDADAO" : "SISTEMA",
            autorId,
            tipo: "CRIADA",
            statusPara: "RECEBIDA",
            texto: "Denúncia registrada.",
          },
        },
        envio: { create: {} },
      },
      select: { id: true, protocolo: true },
    });
  });

  // Fora da transação: uma falha de rede com o GDF não desfaz a denúncia (fica pendente de reenvio).
  const envio = await enviarDenunciaAoGdf(deps, denuncia.id);
  return { protocolo: denuncia.protocolo, enviadaAoGdf: envio.enviada };
}
