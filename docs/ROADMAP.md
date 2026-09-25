# Roadmap — Voz DF

## Fase 1 — MVP web (demonstração da atividade)

Objetivo: fluxo completo cidadão → IA sugere → JSON ao GDF (simulado) → GDF decide → cidadão acompanha, rodando localmente com dados fictícios.

1. Scaffold Next.js + TypeScript + Tailwind + ESLint; configurar Vitest.
2. Prisma com SQLite; schema de `docs/ARQUITETURA.md`; seed a partir de `data/*.json` + usuários fictícios (1 operador GDF, 1 cidadão).
3. Domínio com testes: `status.ts` (máquina de estados), `protocolo.ts`, `payload-gdf.ts` (monta o JSON de envio).
4. Classificador: interface + fallback por regras + Ollama; `scripts/eval-classificador.ts` com casos fictícios rotulados → **medir viabilidade e escolher o modelo**.
5. Integração: `GovGateway` (push + registro em `EnvioGdf` + reenvio) e callback `/api/v1/integracao/gdf/eventos`.
6. Autenticação (Auth.js credenciais) para cidadão e operador do simulador.
7. Cidadão: home, wizard (descrição/foto → sugestão da IA → confirmação → mapa Leaflet + RA → revisão), confirmação com protocolo, consulta por protocolo, "minhas denúncias".
8. Simulador GDF: lista do que chegou, sugestão da IA em destaque, decidir órgão e status (dispara o callback), contagens por RA/categoria/status.
   - ✅ Extra: o autor confirma ou contesta (com justificativa) a resolução; contestação reabre e volta ao GDF.
   - ✅ Extra: operador avalia se a IA acertou (feedback) → acurácia real no simulador e `eval:classificador -- --fonte=gdf`.
9. Mapa público com marcadores por status (sem dados pessoais).
10. Teste E2E (Playwright): criar denúncia → chega no simulador → "GDF" encaminha e resolve → cidadão vê "Resolvida" pelo protocolo.

**Critério de pronto:** o fluxo do item 10 passa e roda com `npm run dev` numa máquina limpa seguindo o README (com e sem Ollama instalado).

**Status (23/09/2026):** itens 1–10 concluídos. `npm run test:e2e` cobre o fluxo completo (inclusive confirmação e contestação pelo cidadão) em viewport de celular. Pendente para fechar o critério: validar o README numa **máquina limpa** (ex.: notebook de outro integrante).

## Fase 2 — Produto web + PWA

Plano definido em 24/09/2026. Ordem = dependências primeiro, depois valor para o cidadão/demo.
Cada etapa fecha com: testes (unidade/integração + E2E quando houver tela) → verificação no navegador → docs → commit.

| # | Etapa | Por que nesta posição | Risco principal / mitigação |
|---|---|---|---|
| 1 ✅ | **PostgreSQL via Docker** (dev, testes e E2E) + Mailpit no compose | Base de tudo: trocar o banco depois de criar mais tabelas custaria refazer migrações duas vezes | Migrações do SQLite não servem no Postgres → nova migração-base; testes passam a usar *template database* (cópia rápida por arquivo de teste) |
| 2 ✅ | **Detecção automática da RA** (ponto no polígono) | Tira um passo do assistente; independente das demais | Depende dos limites oficiais das RAs (Geoportal DF/SEDUH): licença, formato e se já incluem Arapoanga/Água Quente. Seleção manual continua como fallback e para corrigir perto das divisas |
| 3 ✅ | **E-mail a cada mudança de status** | Fecha o retorno ao cidadão (queixa central do problema) | Fila no banco (outbox) + reenvio; SMTP falso (Mailpit) no dev; só para quem tem conta; conteúdo mínimo (protocolo, status, link — sem relato) |
| 4 ✅ | **Duplicatas por proximidade + apoios** | Evita retrabalho no GDF e mostra urgência | Muda schema e contrato (GDF precisa saber o total de apoios); apoiar exige login (anti-spam) |
| 5 ✅ | **Transparência e relatórios** | Usa dados das etapas anteriores | Página pública só com agregados (sem dados pessoais); CSV para o operador |
| 6 ✅ | **PWA** (instalável, câmera, rascunho offline) | Só faz sentido com as telas estáveis | Rascunho no `localStorage` (por aparelho); service worker mínimo |
| 7 | **Acessibilidade WCAG 2.1 AA** | Auditoria depois que as telas pararem de mudar | axe-core no E2E + correções |
| 8 | **Preparar deploy** (Dockerfile, `.env` por ambiente, guia) | Último: empacota o que existe | Criar contas e publicar é com o usuário. LLM em hospedagem sem GPU → fallback por regras ou VM com Ollama |

**Checkpoint (25/09/2026):** etapas 1–6 concluídas (137 testes de unidade/integração e 6 E2E verdes, incluindo transparência/CSV e PWA offline).
Próximo: etapa 7 (acessibilidade), depois 8 (deploy). Se o Ollama falhar (CUDA após suspensão), reiniciar o driver de vídeo (Win+Ctrl+Shift+B) ou o Windows.

PWA — fora do escopo por decisão: fotos no rascunho (exigiria IndexedDB), envio em segundo plano (Background Sync não existe no Safari/iOS) e push notifications (o e-mail já cobre o retorno; push exigiria chaves VAPID e guardar inscrições).

**Adiados, com justificativa:**
- *Storage S3-compatível:* só quando houver deploy com mais de uma instância; no deploy único, disco persistente basta.
- *PostGIS:* 35 polígonos e buscas num raio de ~100 m se resolvem em JS/SQL simples; PostGIS só com volume real.
- *Rate limit compartilhado:* o atual é em memória e vale para uma instância; trocar só com escala horizontal.
- *Moderação:* nenhum texto do cidadão é público (só categoria/status/RA); reavaliar se um dia o relato for exibido.

Paralelo, fora do código: **validar o README numa máquina limpa** (integrante do grupo) antes da apresentação.

## Fase 3 — App mobile

- React Native (Expo) consumindo a mesma `/api/v1`.
- Autenticação por token para o app; push notifications.
- Só iniciar quando a API da Fase 2 estiver estável.

## Futuro (avaliar necessidade antes)

- Integração real com o GDF (API própria ou adesão à API do Fala.BR/CGU) — ver `docs/ARQUITETURA.md` §2.
- Chatbot WhatsApp; QR Codes em equipamentos públicos.
- IA: sugerir também prioridade e detectar duplicatas por texto/foto — sempre como sugestão, com avaliação de precisão antes de uso.
- **IA aprendendo com o feedback do GDF**: usar casos corrigidos pelo operador como exemplos no prompt (few-shot por similaridade) — só após medir ganho com `eval:classificador -- --fonte=gdf`. Fine-tuning apenas se houver volume e ganho comprovado.
- **IA analisando as fotos** (decisão adiada em 23/09/2026; hoje a IA lê só o texto). Plano e pontos de mudança em `docs/ARQUITETURA.md` §3 "Extensão futura: fotos". Só adotar se a medição mostrar ganho sobre o texto sozinho.
