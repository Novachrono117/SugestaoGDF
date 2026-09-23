# Roadmap — Voz DF

## Fase 1 — MVP web (demonstração da atividade)

Objetivo: fluxo completo cidadão → painel funcionando localmente com dados fictícios.

1. Scaffold Next.js + TypeScript + Tailwind + ESLint; configurar Vitest.
2. Prisma com SQLite; schema de `docs/ARQUITETURA.md`; seed a partir de `data/*.json` + usuários fictícios (1 admin, 1 gestor de RA, 1 gestor de órgão, 1 cidadão).
3. `src/domain/status.ts` (máquina de estados) e `src/domain/protocolo.ts` com testes.
4. Autenticação (Auth.js credenciais) e middleware de autorização por perfil/escopo.
5. Cidadão: home, nova denúncia (wizard com mapa Leaflet e upload), confirmação com protocolo, consulta por protocolo, "minhas denúncias".
6. Painel: fila com filtros, detalhe com histórico, ações de transição, indicadores simples (contagem por RA/categoria/status).
7. Mapa público com marcadores por status (sem dados pessoais).
8. Teste E2E (Playwright): criar denúncia → gestor encaminha → órgão resolve → cidadão vê "Resolvida".

**Critério de pronto:** o fluxo do item 8 passa e roda com `npm run dev` numa máquina limpa seguindo o README.

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

- Integração com Participa DF / 162.
- Chatbot WhatsApp; QR Codes em equipamentos públicos.
- Sugestão de categoria por IA **com revisão humana** e avaliação de precisão antes de uso.
