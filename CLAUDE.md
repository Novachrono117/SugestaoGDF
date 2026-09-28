# CLAUDE.md — Voz DF

Leia `docs/ARQUITETURA.md` e `docs/ROADMAP.md` antes de implementar qualquer coisa.

Regras do Next.js 16 (a doc da versão instalada fica em `node_modules/next/dist/docs/`):
@AGENTS.md

## Contexto
- Web app de denúncias cidadãs do DF, segmentado pelas 37 Regiões Administrativas e por categoria. O cidadão só descreve o problema; uma IA local **sugere** categoria/órgão; a denúncia é enviada como JSON ao GDF, que **decide** o órgão e devolve o status. O lado do GDF é um simulador no MVP.
- Projeto acadêmico: priorize um MVP demonstrável e simples de rodar localmente. Evite infraestrutura que não seja necessária para a fase atual.
- Idioma da interface e do domínio: **português (pt-BR)**. Código (variáveis, funções) em inglês; termos de domínio podem manter nomes em português quando mais claros (ex.: `RegiaoAdministrativa`) — manter consistência depois de escolhido.

## Stack (decidida — não trocar sem justificar)
- Next.js (App Router) + TypeScript (strict) + React
- Prisma ORM + **PostgreSQL** em todos os ambientes (dev/testes/E2E via `docker compose`; desde a Fase 2 — antes era SQLite)
- Zod para validação em todas as fronteiras (forms, route handlers, server actions)
- Auth.js (NextAuth) com credenciais; senhas com hash (bcrypt/argon2)
- Leaflet + OpenStreetMap para mapas (sem chave paga)
- IA: LLM local via Ollama (modelo configurável em `OLLAMA_MODEL`) com fallback por regras; sem API paga
- Tailwind CSS
- Testes: Vitest (unidade/integração) e Playwright (fluxos principais)

## Regras do domínio (invariantes)
- Toda denúncia pertence a exatamente **uma RA** e **uma categoria**.
- Protocolo único e legível: `DF-AAAA-NNNNNN`, gerado no servidor.
- Transições de status só pelas permitidas em `docs/ARQUITETURA.md` (máquina de estados centralizada em `src/domain/status.ts`, com testes).
- Toda mudança de status gera um registro de histórico (`EventoDenuncia`) com ator e data — nunca sobrescrever histórico.
- **A IA só sugere.** O órgão responsável (`Denuncia.orgaoResponsavelId`) é definido apenas pelo GDF via callback; a sugestão fica separada em `SugestaoIA`.
- Payload enviado ao GDF não contém dados pessoais do denunciante.
- Autorização **sempre no servidor**; callback do GDF só com chave de API válida e idempotente por `eventoId`.

## Privacidade / LGPD
- Mapa e páginas públicas **nunca** exibem nome, e-mail, CPF ou telefone do denunciante.
- Denúncia anônima é permitida (sem vínculo com usuário).
- Remover metadados EXIF (incl. GPS) das fotos antes de armazenar.
- Não logar dados pessoais nem conteúdo de senha/token.
- Dados de seed e testes são fictícios.

## Segurança
- Uploads: validar tipo real (magic bytes) e tamanho (máx. 5 MB), renomear arquivo, não servir do mesmo caminho do código.
- Rate limit na criação de denúncias e no login.
- Sem segredos no repositório; usar `.env` (e manter `.env.example` atualizado).

## Comandos
- `docker compose up -d` — Postgres + Mailpit (SMTP falso, http://localhost:8025) para desenvolvimento
- `npm run dev` — servidor local (http://localhost:3000)
- `npm run lint` / `npm run typecheck` / `npm test`
- `npm run test:e2e` — Playwright (fluxo completo, PWA e acessibilidade com axe-core; banco `vozdf_e2e` e build isolados). Tela nova → incluir em `e2e/acessibilidade.spec.ts`
- `npm run db:migrate -- --name <nome>` — `prisma migrate dev`; o hook `postdb:migrate` roda `prisma generate` (no Prisma 7 o migrate não gera o client sozinho)
- `npm run ras:baixar` — baixa os limites oficiais das RAs (IDE-DF) para `data/cache/` (fora do git: licença não declarada); rodar `db:seed` depois
- `npm run db:seed` — dados de referência + usuários fictícios (idempotente); grava os limites se o cache existir
- `docker compose -f compose.producao.yml --env-file .env.producao up -d --build` — stack de produção (ver `docs/DEPLOY.md`)
- `npm run eval:classificador -- <modelo>` — acurácia/latência da IA (casos fictícios); `-- --fonte=gdf <modelo>` usa as avaliações do operador como gabarito

## Armadilhas conhecidas
- next-auth v5: `auth()` lê a sessão de `headers()`. Não usar `signIn`/`signOut` com redirect dentro de server action (renderiza o destino sem o cookie novo → loop); usar `redirect: false` + navegação completa no cliente (`src/app/(auth)/navegacao.tsx`).
- Ordenar nomes com acento em JS (`localeCompare("pt-BR")`): a collation do banco pode variar entre ambientes.
- O singleton do Prisma fica em `globalThis` no dev: após `db:migrate`, reiniciar o `npm run dev`.
- Testes criam bancos `vozdf_test_*` (cópia de template) e o E2E usa `vozdf_e2e`; `src/test/pg-admin.ts` recusa apagar qualquer outro nome.
- Ollama pode quebrar o CUDA após suspensão do notebook ("cudaMalloc failed"): o app cai no fallback por regras; resolver com Win+Ctrl+Shift+B (reinicia o driver) ou reboot.
- Action que apaga o próprio usuário (excluir conta): terminar com `redirect()` para uma página pública. Sem isso o Next re-renderiza a página atual (protegida) e manda para `/entrar` antes de o cliente ver a resposta.
- Mudou o que se coleta, para onde vai ou quanto tempo fica? Atualizar `src/app/privacidade/page.tsx` (e a data) no mesmo commit.
- Form com `useActionState` + `revalidatePath`: não remontar com `key` (apaga a mensagem de sucesso); ajustar estado durante o render.
- `<select>` dentro de grid no celular: usar `w-full min-w-0` (a opção mais longa alarga a página).
- E2E: fechar os contextos criados com `browser.newContext()` (helper `novaPagina`) e esperar mensagens **específicas** (a anterior pode continuar na tela).
- Ícones: usar só a convenção de arquivos (`src/app/icon.svg`, `src/app/apple-icon.png`). Declarar `icons` no `metadata` faz o Next ignorar os arquivos (some o `<link rel="icon">`).
- Service worker só registra em produção (`src/components/registrar-sw.tsx`): testar PWA/offline pelo E2E ou `npm run build && npm start`, não no `npm run dev`.
- Estado vindo do `localStorage` (rascunho): não ler no render inicial (diverge do HTML do servidor). O assistente remonta com `key` após hidratar (`useSyncExternalStore`) e só salva depois disso — antes, o estado vazio apagaria o rascunho.
- `output: "standalone"`: o E2E roda o `server.js` standalone (mesmo artefato da imagem), não `next start` (sem suporte nesse modo). O `server.js` muda o cwd para a própria pasta → caminhos em env (ex.: `UPLOAD_DIR`) devem ser absolutos. Arquivo lido em runtime precisa ser `import` estático (ler via `process.cwd()` escapa do rastreamento do build).
- `src/server/db.ts` cria o Prisma Client ao ser importado e exige `DATABASE_URL`: o build Docker usa uma URL fictícia só no `RUN` do build. Página que consultar o banco no build quebra o build de propósito.
- IP do cliente (rate limit) = **último** item do `X-Forwarded-For` (o do nosso proxy); os anteriores são forjáveis. Não expor o app sem proxy na frente.
- Pouca memória livre derruba o `next build` do E2E ("heap out of memory"): as VMs do Docker/WSL consomem vários GB.

## Definição de pronto
Lint, typecheck e testes passando; fluxo testado manualmente no navegador; README/CLAUDE.md atualizados se comandos ou arquitetura mudarem.
