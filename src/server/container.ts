// Composição das dependências do app (só a borda — rotas e páginas — importa este módulo).
import { criarClassificador, type Classificador } from "./classificador";
import { db } from "./db";
import type { CriarDenunciaDeps } from "./denuncias/criar";
import { serverEnv } from "./env";
import { criarEnviadorSmtp, type EnviadorEmail } from "./email/notificacoes";
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

let enviador: EnviadorEmail | null | undefined;

/** null = SMTP não configurado (e-mails ficam na fila). */
export function obterEnviadorEmail(): EnviadorEmail | null {
  if (enviador === undefined) {
    const env = serverEnv();
    enviador = env.SMTP_HOST
      ? criarEnviadorSmtp({
          host: env.SMTP_HOST,
          port: env.SMTP_PORT,
          seguro: env.SMTP_SEGURO,
          usuario: env.SMTP_USUARIO,
          senha: env.SMTP_SENHA,
          remetente: env.EMAIL_REMETENTE,
        })
      : null;
  }
  return enviador;
}
