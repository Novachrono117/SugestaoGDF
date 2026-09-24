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

- PostgreSQL (+ PostGIS se houver consultas espaciais) e storage S3-compatível.
- Detecção automática da RA por polígono.
- Sugestão de duplicatas por proximidade; apoios.
- Notificações por e-mail a cada mudança de status.
- PWA: manifest, instalação, câmera, rascunho offline da denúncia.
- Relatórios: tempo médio de resolução por RA/órgão; exportação CSV.
- Acessibilidade (WCAG 2.1 AA) revisada; rate limit; moderação.
- Deploy (ex.: Vercel/Render + Postgres gerenciado) com `.env` por ambiente.

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
