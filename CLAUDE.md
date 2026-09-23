# CLAUDE.md — Voz DF

Leia `docs/ARQUITETURA.md` e `docs/ROADMAP.md` antes de implementar qualquer coisa.

## Contexto
- Web app de denúncias cidadãs do DF, segmentado pelas 35 Regiões Administrativas e por categoria, com painel de gestão para o GDF.
- Projeto acadêmico: priorize um MVP demonstrável e simples de rodar localmente. Evite infraestrutura que não seja necessária para a fase atual.
- Idioma da interface e do domínio: **português (pt-BR)**. Código (variáveis, funções) em inglês; termos de domínio podem manter nomes em português quando mais claros (ex.: `RegiaoAdministrativa`) — manter consistência depois de escolhido.

## Stack (decidida — não trocar sem justificar)
- Next.js (App Router) + TypeScript (strict) + React
- Prisma ORM; **SQLite no desenvolvimento**, PostgreSQL em produção
- Zod para validação em todas as fronteiras (forms, route handlers, server actions)
- Auth.js (NextAuth) com credenciais; senhas com hash (bcrypt/argon2)
- Leaflet + OpenStreetMap para mapas (sem chave paga)
- Tailwind CSS
- Testes: Vitest (unidade/integração) e Playwright (fluxos principais)

## Regras do domínio (invariantes)
- Toda denúncia pertence a exatamente **uma RA** e **uma categoria**.
- Protocolo único e legível: `DF-AAAA-NNNNNN`, gerado no servidor.
- Transições de status só pelas permitidas em `docs/ARQUITETURA.md` (máquina de estados centralizada em um único módulo, com testes).
- Toda mudança de status gera um registro de histórico (`EventoDenuncia`) com autor e data — nunca sobrescrever histórico.
- Autorização **sempre no servidor**: gestor de RA só vê a própria RA; órgão só vê o que foi encaminhado a ele.

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

## Comandos (atualizar quando o projeto for criado)
- `npm run dev` — servidor local
- `npm run lint` / `npm run typecheck` / `npm test`
- `npx prisma migrate dev` / `npx prisma db seed`

## Definição de pronto
Lint, typecheck e testes passando; fluxo testado manualmente no navegador; README/CLAUDE.md atualizados se comandos ou arquitetura mudarem.
