// Criação de denúncia. Aceita multipart/form-data (com fotos em "fotos") ou JSON.
// Login opcional; `anonima=true` não vincula o autor mesmo se houver sessão.
import { z } from "zod";
import { novaDenunciaSchema } from "@/lib/validation/denuncia";
import { MAX_FOTOS, removerFotos, salvarFotos, type FotoSalva } from "@/server/anexos/fotos";
import { obterUsuarioAtual } from "@/server/auth/sessao";
import { depsDenuncia } from "@/server/container";
import { criarDenuncia } from "@/server/denuncias/criar";
import { serverEnv } from "@/server/env";
import { erroJson, respostaDeErro } from "@/server/http";
import { limites } from "@/server/limites";
import { ipDoCliente } from "@/server/rate-limit";

const corpoSchema = novaDenunciaSchema.extend({
  anonima: z.union([z.boolean(), z.enum(["true", "false"]).transform((v) => v === "true")]).default(false),
});

async function lerCorpo(request: Request): Promise<{ campos: unknown; fotos: File[] }> {
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data")) {
    return { campos: await request.json(), fotos: [] };
  }
  const form = await request.formData();
  const fotos = form.getAll("fotos").filter((v): v is File => v instanceof File && v.size > 0);
  const campos = Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string"));
  return { campos, fotos };
}

export async function POST(request: Request) {
  const env = serverEnv();
  const maxBytes = env.MAX_UPLOAD_MB * 1024 * 1024;
  // Barra corpos gigantes antes de ler: fotos + 1 MB de folga para os campos.
  const tamanho = Number(request.headers.get("content-length") ?? 0);
  if (tamanho > MAX_FOTOS * maxBytes + 1024 * 1024) {
    return erroJson(413, "CORPO_GRANDE", `Envio muito grande (máx. ${MAX_FOTOS} fotos de ${env.MAX_UPLOAD_MB} MB).`);
  }

  let fotosSalvas: FotoSalva[] = [];
  try {
    const { campos, fotos } = await lerCorpo(request);
    const { anonima, ...input } = corpoSchema.parse(campos);
    const usuario = anonima ? null : await obterUsuarioAtual();

    if (!limites.denunciaPorOrigem.consumir(usuario?.id ?? ipDoCliente(request.headers)).ok) {
      return erroJson(429, "LIMITE_EXCEDIDO", "Muitas denúncias em pouco tempo. Tente mais tarde.");
    }

    fotosSalvas = await salvarFotos(fotos, { uploadDir: env.UPLOAD_DIR, maxBytes });
    const criada = await criarDenuncia(depsDenuncia(), input, usuario?.id ?? null, fotosSalvas);
    return Response.json(criada, { status: 201 });
  } catch (erro) {
    // Falhou depois de gravar as fotos: não deixa arquivo órfão no disco.
    if (fotosSalvas.length) await removerFotos(env.UPLOAD_DIR, fotosSalvas);
    return respostaDeErro(erro);
  }
}
