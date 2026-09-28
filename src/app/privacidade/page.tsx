import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Cartao } from "@/components/ui";
import { serverEnv } from "@/server/env";

export const metadata: Metadata = { title: "Aviso de privacidade — Voz DF" };

// Descreve o que o código faz de fato — ao mudar coleta, envio ou retenção, atualizar aqui e a data.
const ATUALIZADO_EM = "28/09/2026";

const DADOS: [dado: string, quando: string, paraQue: string][] = [
  ["Nome e e-mail", "Ao criar a conta", "Entrar na conta, mostrar suas denúncias e avisar por e-mail quando o status mudar"],
  ["Senha", "Ao criar a conta", "Entrar na conta. Guardamos só um código irreversível (hash), nunca a senha"],
  ["Relato, categoria e referência do endereço", "Ao fazer a denúncia", "Registrar o problema e encaminhar ao GDF"],
  ["Local no mapa (ponto exato) e Região Administrativa", "Ao fazer a denúncia", "O GDF saber onde está o problema"],
  ["Fotos", "Se você anexar", "Mostrar o problema ao GDF. Removemos localização e outros dados escondidos da imagem"],
  ["Avaliação da solução (e a justificativa, se contestar)", "Quando o GDF marca como resolvida", "Informar ao GDF se o problema foi mesmo resolvido"],
  ["Apoios (“também tenho esse problema”)", "Se você apoiar uma denúncia", "Mostrar ao GDF quantas pessoas são afetadas (só o total)"],
];

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold text-slate-900">{titulo}</h2>
      <div className="flex flex-col gap-2 text-sm leading-relaxed text-slate-700">{children}</div>
    </section>
  );
}

export default function PrivacidadePage() {
  const contato = serverEnv().CONTATO_PRIVACIDADE;
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Aviso de privacidade</h1>
        <p className="mt-1 text-sm text-slate-600">Atualizado em {ATUALIZADO_EM}. Lei Geral de Proteção de Dados (Lei 13.709/2018).</p>
      </div>

      <Cartao className="flex flex-col gap-6">
        <Secao titulo="Quem somos">
          <p>
            O Voz DF é um <strong>projeto acadêmico</strong> e <strong>não é um serviço oficial do GDF</strong>. A equipe do
            projeto é a responsável pelos dados tratados aqui. A integração com o governo é simulada.
          </p>
        </Secao>

        <Secao titulo="Quais dados usamos e para quê">
          <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Dados tratados (tabela)">
            <table className="w-full min-w-[34rem] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                <tr>
                  <th scope="col" className="px-3 py-2">Dado</th>
                  <th scope="col" className="px-3 py-2">Quando</th>
                  <th scope="col" className="px-3 py-2">Para quê</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {DADOS.map(([dado, quando, paraQue]) => (
                  <tr key={dado}>
                    <th scope="row" className="px-3 py-2 font-medium text-slate-900">{dado}</th>
                    <td className="px-3 py-2">{quando}</td>
                    <td className="px-3 py-2">{paraQue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            Você pode denunciar <strong>sem conta</strong>: aí a denúncia não fica ligada a ninguém. Base legal: o seu
            consentimento (art. 7º, I), dado ao criar a conta e ao enviar a denúncia.
          </p>
        </Secao>

        <Secao titulo="O que o GDF recebe">
          <p>
            O relato, a categoria, o local exato, a referência do endereço, as fotos, a sugestão da IA e, se houver, sua
            avaliação da solução. <strong>Seu nome e seu e-mail não são enviados.</strong>
          </p>
          <p>
            Tudo o que você escreve no relato chega ao GDF: evite nomes, telefones ou placas de outras pessoas.
          </p>
        </Secao>

        <Secao titulo="O que fica público">
          <p>
            Qualquer pessoa com o protocolo vê categoria, região, status e o histórico de andamento — <strong>não</strong> o
            relato, as fotos nem quem enviou. No mapa público o ponto aparece com precisão reduzida (cerca de 100 m). A
            página de transparência mostra apenas totais.
          </p>
        </Secao>

        <Secao titulo="Quem mais participa">
          <ul className="list-disc pl-5">
            <li>
              <strong>IA:</strong> o relato é analisado por um modelo que roda no nosso próprio servidor, não por uma empresa
              de IA. As fotos não são analisadas.
            </li>
            <li>
              <strong>Mapa:</strong> as imagens do mapa vêm do OpenStreetMap. Ao abrir o mapa, seu navegador pede essas
              imagens aos servidores deles, que recebem seu endereço IP e a região exibida.
            </li>
            <li>
              <strong>E-mail:</strong> os avisos de status são enviados por um provedor de e-mail e contêm só o protocolo, o
              status e o link — nunca o relato.
            </li>
          </ul>
        </Secao>

        <Secao titulo="Cookies e dados no seu aparelho">
          <p>
            Usamos só o cookie de sessão, para manter você conectado. Não há publicidade nem ferramentas de rastreamento.
            O rascunho de uma denúncia não enviada fica no seu próprio aparelho por até 7 dias e é apagado quando você
            envia, descarta ou sai da conta.
          </p>
        </Secao>

        <Secao titulo="Por quanto tempo">
          <p>
            A conta fica ativa até você excluí-la. Ao excluir, apagamos nome, e-mail, senha, apoios e avisos pendentes; as
            denúncias já entregues ao GDF continuam, mas <strong>sem ligação com você</strong>. Por ser um ambiente de
            demonstração, a base pode ser apagada ao fim do projeto.
          </p>
        </Secao>

        <Secao titulo="Seus direitos">
          <ul className="list-disc pl-5">
            <li>
              <strong>Ver e baixar seus dados</strong> e <strong>excluir sua conta</strong>: em{" "}
              <Link href="/minha-conta" className="font-semibold text-blue-700 underline">
                Minha conta
              </Link>
              .
            </li>
            <li>Parar de receber e-mails: também em Minha conta.</li>
            <li>Corrigir dados, tirar dúvidas ou pedir qualquer outro direito da LGPD: pelo contato abaixo.</li>
          </ul>
          <p>
            {contato ? (
              <>
                Contato: <a href={`mailto:${contato}`} className="font-semibold text-blue-700 underline">{contato}</a>.
              </>
            ) : (
              <>Contato: fale com a equipe responsável pelo projeto acadêmico.</>
            )}{" "}
            Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).
          </p>
        </Secao>

        <Secao titulo="Segurança">
          <p>
            Conexão criptografada (HTTPS), senhas guardadas como hash, fotos sem metadados, acesso às fotos só por link
            secreto e limites de tentativas de login.
          </p>
        </Secao>
      </Cartao>
    </main>
  );
}
