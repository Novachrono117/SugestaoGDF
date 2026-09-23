// Composição das dependências do app (só a borda — rotas e páginas — importa este módulo).
import { criarClassificador, type Classificador } from "./classificador";
import { db } from "./db";
import type { CriarDenunciaDeps } from "./denuncias/criar";
import { serverEnv } from "./env";
import { HttpGovGateway } from "./gov-gateway";

let classificador: Classificador | undefined;

export function obterClassificador(): Classificador {
  classificador ??= criarClassificador();
  return classificador;
}

export function depsDenuncia(): CriarDenunciaDeps {
  const env = serverEnv();
  return {
    db,
    classificador: obterClassificador(),
    appUrl: env.APP_URL,
    gateway: new HttpGovGateway({ url: env.GDF_WEBHOOK_URL, chave: env.GDF_WEBHOOK_KEY, timeoutMs: env.GDF_TIMEOUT_MS }),
  };
}
