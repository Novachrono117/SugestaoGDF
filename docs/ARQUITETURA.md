# Arquitetura — Voz DF

## 1. Visão geral

```
[Navegador / PWA / App mobile (fase 3)]
              │ HTTPS
              ▼
   Next.js (App Router)
   ├─ Páginas do cidadão (público)
   ├─ Painel de gestão (/painel, autenticado)
   └─ API REST (/api/v1/*)  ← mesma API será usada pelo app mobile
              │
     Camada de domínio (src/domain): regras, máquina de estados, roteamento
              │
     Prisma ─► SQLite (dev) / PostgreSQL (prod)
     Storage de fotos ─► disco local (dev) / S3-compatível (prod)
```

Monolito modular: um único deploy. Sem microserviços, filas ou IA no MVP.

Estrutura de pastas sugerida:
```
src/
  app/                 rotas (cidadão, painel, api/v1)
  domain/              regras puras e testáveis (status, protocolo, roteamento)
  server/              acesso a dados, autorização, storage
  components/          UI
  lib/validation/      schemas Zod compartilhados
prisma/
  schema.prisma
  seed.ts              lê data/*.json
```

## 2. Perfis e permissões

| Perfil | Vê | Pode |
|---|---|---|
| `CIDADAO` | Mapa público; as próprias denúncias | Criar denúncia, apoiar denúncia existente, comentar a própria |
| (anônimo) | Mapa público; consulta por protocolo | Criar denúncia anônima |
| `GESTOR_RA` | Denúncias da(s) RA(s) atribuída(s) | Triar, priorizar, encaminhar a órgão, marcar duplicada/não procedente |
| `GESTOR_ORGAO` | Denúncias encaminhadas ao seu órgão | Registrar providência, marcar em execução/resolvida |
| `ADMIN_GDF` | Tudo | Tudo acima + gerenciar usuários, categorias, órgãos e relatórios |

Verificação de permissão no servidor em toda leitura e escrita (não apenas esconder botões).

## 3. Modelo de dados (inicial)

```
RegiaoAdministrativa  id, codigo ("RA-IX"), numero (9), nome, slug
Categoria             id, slug, nome, descricao, orgaoPadraoId?, ativa
Orgao                 id, sigla, nome
Usuario               id, nome, email (único), senhaHash, papel, criadoEm
UsuarioRA             usuarioId, raId              (escopo de GESTOR_RA)
UsuarioOrgao          usuarioId, orgaoId           (escopo de GESTOR_ORGAO)

Denuncia
  id, protocolo (único), titulo, descricao
  categoriaId, raId, orgaoResponsavelId?
  latitude, longitude, enderecoReferencia?
  status, prioridade (BAIXA|MEDIA|ALTA|URGENTE)
  autorId? (null = anônima)
  duplicadaDeId?  (aponta para a denúncia principal)
  criadoEm, atualizadoEm, resolvidoEm?

Anexo            id, denunciaId, caminho, mime, tamanho, criadoEm
Apoio            denunciaId, usuarioId, criadoEm   (PK composta; 1 apoio por usuário)
EventoDenuncia   id, denunciaId, autorId?, tipo, statusDe?, statusPara?, texto?, publico (bool), criadoEm
```

Índices: `Denuncia(raId, status)`, `Denuncia(categoriaId, status)`, `Denuncia(orgaoResponsavelId, status)`, `Denuncia(criadoEm)`.

## 4. Máquina de estados

```
RECEBIDA ──► EM_TRIAGEM ──► ENCAMINHADA ──► EM_EXECUCAO ──► RESOLVIDA
                │               │                │
                ├──► NAO_PROCEDENTE ◄────────────┘
                └──► DUPLICADA (exige duplicadaDeId)
RESOLVIDA ──► REABERTA ──► EM_TRIAGEM   (cidadão contesta em até 30 dias)
```

| Transição | Quem |
|---|---|
| RECEBIDA → EM_TRIAGEM | GESTOR_RA, ADMIN_GDF |
| EM_TRIAGEM → ENCAMINHADA (define órgão) | GESTOR_RA, ADMIN_GDF |
| EM_TRIAGEM → NAO_PROCEDENTE / DUPLICADA | GESTOR_RA, ADMIN_GDF (justificativa obrigatória) |
| ENCAMINHADA → EM_EXECUCAO | GESTOR_ORGAO, ADMIN_GDF |
| EM_EXECUCAO → RESOLVIDA / NAO_PROCEDENTE | GESTOR_ORGAO, ADMIN_GDF (texto da providência obrigatório) |
| RESOLVIDA → REABERTA | Autor da denúncia |

Implementar como tabela de transições em `src/domain/status.ts`, com testes cobrindo transições válidas e inválidas.

## 5. Fluxos principais

**Criar denúncia:** categoria → local no mapa + seleção/confirmação da RA → descrição + até 3 fotos → revisão → servidor valida (Zod), gera protocolo, define `orgaoResponsavelId` padrão pela categoria, grava `EventoDenuncia(CRIADA)` → exibe protocolo.

**Sugestão de duplicata:** antes de enviar, buscar denúncias abertas da mesma categoria num raio de ~100 m; se houver, oferecer "Apoiar esta" em vez de criar nova.

**Triagem no painel:** fila filtrada pelo escopo do usuário → detalhe → ação (prioridade, encaminhar, duplicada, não procedente) → evento registrado.

**Detecção automática da RA (fase 2):** point-in-polygon com os limites oficiais das RAs (Geoportal DF/SEDUH — verificar licença e formato). No MVP a RA é escolhida pelo usuário.

## 6. API (v1, para web e futuro app)

```
GET    /api/v1/regioes
GET    /api/v1/categorias
POST   /api/v1/denuncias                 criar (auth opcional)
GET    /api/v1/denuncias/{protocolo}     consulta pública (sem dados pessoais)
GET    /api/v1/denuncias/mapa?ra=&categoria=&bbox=   pontos públicos, paginado
POST   /api/v1/denuncias/{id}/apoios
GET    /api/v1/painel/denuncias?ra=&categoria=&status=&prioridade=&page=   (escopo por perfil)
POST   /api/v1/painel/denuncias/{id}/transicoes   { para, justificativa?, orgaoId?, duplicadaDeId? }
GET    /api/v1/painel/indicadores?ra=&periodo=
```

Respostas de erro no formato `{ error: { code, message } }`, sem stack trace.

## 7. Segurança e LGPD

- Dados pessoais só visíveis a perfis do painel com necessidade; nunca no mapa público.
- EXIF removido das imagens; nome de arquivo aleatório; tipo e tamanho validados.
- Rate limit: criação de denúncia (ex.: 5/hora por IP/usuário) e login.
- Senhas com hash; sessões com cookie `httpOnly`, `secure`, `sameSite=lax`.
- Moderação: texto com dados de terceiros ou ofensivo pode ser ocultado do público (mantido no histórico interno).
- Aviso fixo: emergências → 190 (PMDF) / 193 (CBMDF); este canal não substitui o atendimento de emergência.

## 8. Integração com canais existentes

O GDF já possui o Participa DF e a Central 162 (Ouvidoria-Geral). Uma versão real deveria integrar-se a esses canais, não competir com eles. Não há integração no MVP; tratar como item de roadmap a validar com a Ouvidoria.
