# Voz DF — Rede Central de Denúncias do Distrito Federal

> Nome provisório. Projeto acadêmico (UC 6 — Laboratório Juventudes da Aprendizagem). Não é um serviço oficial do GDF.

O cidadão descreve um problema urbano com as próprias palavras (texto, foto, local no mapa). Uma **IA local sugere** a categoria e o órgão provável; o cidadão confirma. A denúncia vai como **JSON para o GDF**, que **decide** o órgão responsável e devolve o status — o cidadão acompanha pelo protocolo. No MVP o lado do governo é um **Simulador GDF**.

## Estado atual

Fase 1 (MVP web) em andamento — ver `docs/ROADMAP.md`. Prontos: domínio (status, protocolo, contrato JSON), IA com fallback, integração push + callback, login, fotos sem EXIF, assistente de denúncia, acompanhamento por protocolo, "Minhas denúncias", Simulador GDF, confirmação/contestação da resolução pelo cidadão e avaliação da IA pelo operador, mapa público. Falta: teste E2E.

## Como rodar (máquina limpa)

Requisitos: **Node.js 22+**. Opcional: **[Ollama](https://ollama.com)** para a IA (sem ele, o app usa um classificador por palavras-chave).

```bash
npm install
cp .env.example .env        # PowerShell: Copy-Item .env.example .env
```

Preencha no `.env`: `AUTH_SECRET`, `GDF_WEBHOOK_KEY`, `GDF_CALLBACK_KEY` (valores longos e aleatórios — o próprio arquivo mostra como gerar) e `SEED_SENHA_DEMO` (senha dos usuários fictícios).

```bash
npm run db:migrate          # cria o banco SQLite (dev.db) e gera o Prisma Client
npm run db:seed             # 35 RAs, órgãos, categorias e 2 usuários fictícios
ollama pull qwen3.5:4b      # opcional: modelo usado pela IA (~3,4 GB)
npm run dev                 # http://localhost:3000
```

Usuários fictícios (senha = `SEED_SENHA_DEMO`): `operador@vozdf.example` (acessa o Simulador GDF) e `cidada@vozdf.example`.

## Comandos

| Comando | O quê |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm test` | Testes (Vitest; inclui integração com SQLite real) |
| `npm run lint` / `npm run typecheck` | Qualidade |
| `npm run db:migrate` | Aplica migrações **e** gera o client (no Prisma 7 o `migrate dev` não gera sozinho). Pare o `npm run dev` antes |
| `npm run db:seed` | Dados de referência + usuários fictícios (idempotente) |
| `npm run eval:classificador -- qwen3.5:4b` | Mede acurácia/latência da IA em 48 casos fictícios (`-- --fonte=gdf qwen3.5:4b`: nos casos avaliados pelo operador) |

## Estrutura

```
ATIVIDADE.md                 Entregáveis da atividade (Etapas 1–5)
CLAUDE.md / AGENTS.md        Instruções para desenvolvimento assistido
docs/ARQUITETURA.md          Stack, integração com o GDF, IA, dados, estados, segurança
docs/ROADMAP.md              Fases: MVP web → PWA → app mobile
data/                        RAs, categorias/órgãos e casos de avaliação da IA (seed)
prisma/                      Schema, migrações e seed
src/domain/                  Regras puras (status, protocolo, payload do GDF)
src/server/                  Classificador, gateway GDF, auth, fotos, serviços
src/simulador-gdf/           Simulação do lado do governo (só demonstração)
src/app/                     Páginas e API (/api/v1)
```
