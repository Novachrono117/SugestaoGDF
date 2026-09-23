# Voz DF — Rede Central de Denúncias do Distrito Federal

> Nome provisório. Projeto acadêmico (UC 6 — Laboratório Juventudes da Aprendizagem). Não é um serviço oficial do GDF.

Plataforma web (e futuramente app) onde o cidadão registra denúncias sobre problemas urbanos, organizadas por **Região Administrativa (RA)** e **categoria**, e onde o GDF visualiza tudo em um painel único para priorizar e registrar as ações tomadas.

## Estado atual

Fase 0 — documentação e dados de referência. Ainda não há código de aplicação.

## Estrutura

```
ATIVIDADE.md                   Entregáveis da atividade (Etapas 1–5)
CLAUDE.md                      Instruções para desenvolvimento assistido (Claude Code)
docs/ARQUITETURA.md            Stack, modelo de dados, fluxos, perfis e segurança
docs/ROADMAP.md                Fases: MVP web → PWA → app mobile
data/regioes-administrativas.json   35 RAs do DF (seed)
data/categorias.json           Categorias de denúncia e órgão sugerido (seed)
```

## Próximo passo

Iniciar a Fase 1 descrita em `docs/ROADMAP.md` (scaffold Next.js + Prisma + seed).
