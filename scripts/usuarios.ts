// Administração de contas (fora da interface pública), ex.: criar operadores reais e remover os fictícios.
//   npm run usuario:criar -- --nome "Maria Souza" --email maria@exemplo.gov.br --papel OPERADOR_GDF
//   npm run usuario:remover -- --email operador@vozdf.example
// A senha nunca vai na linha de comando (ficaria no histórico): é digitada sem eco no terminal, ou lida
// da variável NOVA_SENHA quando não há terminal interativo (ex.: docker compose run -e NOVA_SENHA ...).
// Em produção: docker compose -f compose.producao.yml --env-file .env.producao run --rm migrador npm run usuario:criar -- ...
import "dotenv/config";
import { createInterface } from "node:readline";
import { parseArgs } from "node:util";
import { z } from "zod";
import { cadastroSchema } from "../src/lib/validation/auth";
import { criarUsuario } from "../src/server/auth/usuarios";
import { removerUsuario } from "../src/server/conta/direitos-titular";
import { HttpGovGateway } from "../src/server/gov-gateway";
import { createPrismaClient } from "../src/server/prisma";

function perguntarSemEco(pergunta: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  const saida = rl as unknown as { _writeToOutput: (s: string) => void };
  let mostrandoPergunta = true;
  saida._writeToOutput = (s) => {
    if (mostrandoPergunta) process.stdout.write(s);
    else if (s.includes("\n")) process.stdout.write("\n");
  };
  return new Promise((resolve) => {
    rl.question(pergunta, (resposta) => {
      rl.close();
      resolve(resposta);
    });
    mostrandoPergunta = false;
  });
}

async function lerSenha(): Promise<string> {
  if (process.env.NOVA_SENHA) return process.env.NOVA_SENHA;
  if (!process.stdin.isTTY) throw new Error("Sem terminal interativo: passe a senha em NOVA_SENHA.");
  const senha = await perguntarSemEco("Senha (não aparece na tela): ");
  if ((await perguntarSemEco("Repita a senha: ")) !== senha) throw new Error("As senhas não conferem.");
  return senha;
}

async function main() {
  const [comando, ...resto] = process.argv.slice(2);
  const { values } = parseArgs({
    args: resto,
    options: { nome: { type: "string" }, email: { type: "string" }, papel: { type: "string", default: "CIDADAO" } },
  });
  const db = createPrismaClient();
  try {
    if (comando === "criar") {
      const papel = z.enum(["CIDADAO", "OPERADOR_GDF"]).parse(values.papel);
      const dados = cadastroSchema.parse({ nome: values.nome, email: values.email, senha: await lerSenha() });
      const u = await criarUsuario(db, dados, papel);
      console.log(`Conta criada: ${u.email} (${u.papel}).`);
    } else if (comando === "remover") {
      const email = z.email().parse(values.email?.trim().toLowerCase());
      const u = await db.usuario.findUnique({ where: { email }, select: { id: true } });
      if (!u) throw new Error(`Não existe conta com ${email}.`);
      // Gateway real: o novo total de apoios das denúncias que a conta apoiava é informado ao GDF.
      const gateway = new HttpGovGateway({
        url: z.url().parse(process.env.GDF_WEBHOOK_URL),
        chave: z.string().min(32).parse(process.env.GDF_WEBHOOK_KEY),
        timeoutMs: 5000,
      });
      await removerUsuario({ db, gateway }, u.id);
      console.log(`Conta removida: ${email}. Denúncias dela ficaram anônimas.`);
    } else {
      throw new Error('Comando: "criar" ou "remover" (veja o topo de scripts/usuarios.ts).');
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((erro) => {
  // Só a mensagem: nunca ecoar a senha (erros de validação do Zod não incluem o valor recebido).
  console.error(erro instanceof z.ZodError ? erro.issues.map((i) => `${i.path.join(".") || "valor"}: ${i.message}`).join("\n") : String(erro instanceof Error ? erro.message : erro));
  process.exit(1);
});
