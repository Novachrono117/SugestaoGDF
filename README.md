# Voz DF — Rede Central de Denúncias do Distrito Federal

> Nome provisório. Projeto acadêmico (UC 6 — Laboratório Juventudes da Aprendizagem). Não é um serviço oficial do GDF.

O cidadão descreve um problema urbano com as próprias palavras (texto, foto, local no mapa). Uma **IA local sugere** a categoria e o órgão provável; o cidadão confirma. A denúncia vai como **JSON para o GDF**, que **decide** o órgão responsável e devolve o status — o cidadão acompanha pelo protocolo. No MVP o lado do governo é um **Simulador GDF**.

## Estado atual

Fase 1 (MVP web) concluída — ver `docs/ROADMAP.md`. Prontos: domínio (status, protocolo, contrato JSON), IA com fallback, integração push + callback, login, fotos sem EXIF, assistente de denúncia, acompanhamento por protocolo, "Minhas denúncias", Simulador GDF, confirmação/contestação da resolução pelo cidadão e avaliação da IA pelo operador, mapa público e teste E2E do fluxo completo.

Fase 2 concluída: Postgres via Docker, detecção automática da RA pelo mapa, e-mail a cada mudança de status, apoios a denúncias próximas (evita duplicatas), página de transparência + CSV do operador, **PWA** (instalável, câmera no celular, rascunho salvo no aparelho e tela offline), **acessibilidade WCAG 2.1 AA** verificada no E2E (`docs/ACESSIBILIDADE.md`) e **deploy com Docker** (`docs/DEPLOY.md`).

**Instalar como app:** no celular, abra o site e use "Adicionar à tela inicial" (Android/Chrome oferece "Instalar app"). Precisa de HTTPS; `localhost` vale como seguro para testar no computador. O service worker só é registrado no build de produção (`npm run build && npm start`), não no `npm run dev`.

## Como rodar (máquina limpa)

Requisitos: **Node.js 22+** e **Docker** (Postgres e Mailpit). Opcional: **[Ollama](https://ollama.com)** para a IA (sem ele, o app usa um classificador por palavras-chave).

```bash
npm install
cp .env.example .env        # PowerShell: Copy-Item .env.example .env
```

Preencha no `.env`: `POSTGRES_PASSWORD` (e a mesma senha dentro de `DATABASE_URL`), `AUTH_SECRET`, `GDF_WEBHOOK_KEY`, `GDF_CALLBACK_KEY` (valores longos e aleatórios — o próprio arquivo mostra como gerar) e `SEED_SENHA_DEMO` (senha dos usuários fictícios).

```bash
docker compose up -d        # Postgres (localhost:5432) + Mailpit (e-mails em http://localhost:8025)
npm run db:migrate          # aplica as migrações no Postgres e gera o Prisma Client
npm run ras:baixar          # opcional: limites oficiais das RAs (detecção automática no mapa)
npm run db:seed             # 37 RAs, órgãos, categorias e 2 usuários fictícios
ollama pull qwen3.5:4b      # opcional: modelo usado pela IA (~3,4 GB)
npm run dev                 # http://localhost:3000
```

Usuários fictícios (senha = `SEED_SENHA_DEMO`): `operador@vozdf.example` (acessa o Simulador GDF) e `cidada@vozdf.example`.

## Comandos

| Comando | O quê |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `docker compose up -d` / `down` | Sobe/para Postgres e Mailpit (dados do Postgres ficam no volume). Os e-mails do app (um por mudança de status) aparecem em http://localhost:8025 |
| `npm test` | Testes (Vitest; integração com Postgres real — cada arquivo usa uma cópia descartável do banco) |
| `npm run test:e2e` | E2E (Playwright, viewport de celular): banco `vozdf_e2e` e build `.next-e2e` isolados, porta 3100, IA por regras. Usa o Edge instalado; sem Edge: `PLAYWRIGHT_CHANNEL=""` + `npx playwright install chromium` |
| `npm run lint` / `npm run typecheck` | Qualidade |
| `npm run db:migrate` | Aplica migrações **e** gera o client (no Prisma 7 o `migrate dev` não gera sozinho). Pare o `npm run dev` antes |
| `npm run ras:baixar` | Baixa os limites oficiais das 37 RAs (IDE-DF/SEDUH) para `data/cache/` — **não versionado** (licença não declarada pela fonte). Sem ele, a RA é escolhida manualmente |
| `npm run db:seed` | Dados de referência + usuários fictícios (idempotente); grava os limites se o cache existir |
| `npx tsx scripts/gerar-icones.mts` | Regera os ícones do PWA (`public/icons/`, `src/app/icon.svg`, `src/app/apple-icon.png`) — só se o desenho mudar |
| `npm run eval:classificador -- qwen3.5:4b` | Mede acurácia/latência da IA em 48 casos fictícios (`-- --fonte=gdf qwen3.5:4b`: nos casos avaliados pelo operador) |

## Deploy

Imagem Docker (Next.js standalone) + `compose.producao.yml` com Postgres, migrações/seed automáticos e Caddy
(HTTPS Let's Encrypt). Passo a passo, backup, IA sem GPU e pendências antes de abrir ao público: [`docs/DEPLOY.md`](docs/DEPLOY.md).

```bash
cp .env.producao.example .env.producao   # preencha domínio e segredos
docker compose -f compose.producao.yml --env-file .env.producao up -d --build
```

## Estrutura

```
ATIVIDADE.md                 Entregáveis da atividade (Etapas 1–5)
CLAUDE.md / AGENTS.md        Instruções para desenvolvimento assistido
docs/ARQUITETURA.md          Stack, integração com o GDF, IA, dados, estados, segurança
docs/ROADMAP.md              Fases: MVP web → PWA → app mobile
docs/ACESSIBILIDADE.md       WCAG 2.1 AA: o que é testado, o que foi corrigido, checagem manual
docs/DEPLOY.md               Publicar em servidor com Docker (Caddy + HTTPS), backup, pendências
Dockerfile, compose.producao.yml, deploy/   Imagem e stack de produção
data/                        RAs, categorias/órgãos e casos de avaliação da IA (seed)
prisma/                      Schema, migrações e seed
src/domain/                  Regras puras (status, protocolo, payload do GDF)
src/server/                  Classificador, gateway GDF, auth, fotos, serviços
src/simulador-gdf/           Simulação do lado do governo (só demonstração)
src/app/                     Páginas e API (/api/v1)
```
