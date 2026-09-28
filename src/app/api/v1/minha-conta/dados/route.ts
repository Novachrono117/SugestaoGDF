// LGPD art. 18 (acesso/portabilidade): baixa em JSON tudo o que está ligado à conta logada.
import { usuarioOuErro } from "@/server/auth/sessao";
import { exportarDadosDoTitular } from "@/server/conta/direitos-titular";
import { db } from "@/server/db";

export async function GET() {
  const { usuario, erro } = await usuarioOuErro();
  if (erro) return erro;
  const dados = await exportarDadosDoTitular(db, usuario.id);
  return new Response(JSON.stringify(dados, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="meus-dados-voz-df.json"',
      "Cache-Control": "no-store",
    },
  });
}
