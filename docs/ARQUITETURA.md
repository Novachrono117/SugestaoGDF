# Arquitetura — Voz DF

## 1. Visão geral

O Voz DF é a **porta de entrada** da denúncia, não o sistema de gestão do governo:

1. O cidadão descreve o problema com as próprias palavras (texto + foto + local), sem precisar saber qual órgão é responsável.
2. Uma IA local **sugere** a categoria e o órgão responsável; o cidadão confirma ou troca a categoria.
3. O Voz DF envia a denúncia como **JSON para o GDF** (push). **Quem decide o órgão responsável é o GDF** — a IA só sugere.
4. O GDF devolve a decisão e as mudanças de status (callback); o cidadão acompanha pelo protocolo.
5. Quando o GDF marca **Resolvida**, o autor (com conta) confirma ou **contesta com justificativa** — contestar reabre a denúncia e ela volta ao GDF.
6. O operador do GDF avalia se a IA acertou a categoria; isso mede a acurácia real e orienta melhorias (não treina o modelo sozinho).

```
[Navegador / PWA / App mobile (fase 3)]
              │ HTTPS
              ▼
   Next.js (App Router) — Voz DF
   ├─ Páginas do cidadão (público + "minhas denúncias")
   ├─ API REST (/api/v1/*)            ← mesma API será usada pelo app mobile
   ├─ Classificador ──► Ollama (LLM local)   | fallback: regras por palavra-chave
   └─ GovGateway ──push JSON──► GDF          ◄──callback status── GDF
              │
     Camada de domínio (src/domain): status, protocolo, payload
              │
     Prisma ─► PostgreSQL (dev/testes via docker compose; prod: gerenciado)
     Fotos  ─► disco local (dev) / S3-compatível (prod)

   Simulador GDF (/simulador-gdf) — SOMENTE para demonstração: faz o papel do
   governo (recebe o JSON, decide o órgão, devolve status). Módulo isolado.
```

Monolito modular: um único deploy. Sem microserviços nem filas no MVP.

Estrutura de pastas:
```
src/
  app/                 rotas (cidadão, api/v1, simulador-gdf)
  domain/              regras puras e testáveis (status, protocolo, payload GDF)
  server/              acesso a dados, autorização, storage, classificador, gateway
  simulador-gdf/       simulação do lado do governo (não faz parte do produto)
  components/          UI
  lib/validation/      schemas Zod compartilhados
prisma/
  schema.prisma
  seed.ts              lê data/*.json
scripts/
  eval-classificador.ts   mede a acurácia da IA em casos fictícios rotulados
```

## 2. Integração com o GDF (decisão e contexto)

**Situação real (pesquisa em 23/09/2026):**
- O GDF (Ouvidoria-Geral / OUV-DF / Participa DF / 162) **não publica API** para registro ou consulta de manifestações.
- O modelo real mais próximo é a **API do Fala.BR (CGU)**: REST + JSON + OAuth 2.0, com ciclo registrar → encaminhar → responder → situação. Só é liberada a órgãos aderentes (estados/DF/municípios podem aderir gratuitamente).
- O padrão aberto de mercado é o **Open311 GeoReport v2** (congelado; sem uso conhecido no Brasil).

**Decisão:** push + callback, isolados atrás da interface `GovGateway` (`src/server/gov-gateway/`).
- **Envio (push):** `POST {GDF_WEBHOOK_URL}` com o payload abaixo e `Authorization: Bearer {GDF_WEBHOOK_KEY}`. Cada envio é registrado em `EnvioGdf`; falhas ficam com erro e são reenviadas.
- **Retorno (callback):** o GDF chama `POST /api/v1/integracao/gdf/eventos` com `Authorization: Bearer {GDF_CALLBACK_KEY}`. Idempotente por `eventoId`.
- No MVP o destino é o **Simulador GDF**. Numa integração real troca-se só o gateway (ex.: `FalaBrGateway`; como o Fala.BR não documenta webhooks, o retorno lá seria por consulta periódica).
- **Minimização de dados (LGPD):** o payload **não leva dados pessoais** do denunciante. O GDF responde ao cidadão por meio do Voz DF (callback + protocolo), então não precisa de nome, e-mail ou CPF.

### Payload de envio (v1)

Nomes em pt-BR; entre parênteses o campo equivalente no Open311.

```json
{
  "versao": "1",
  "protocolo": "DF-2026-000123",            // (service_request_id)
  "criadoEm": "2026-09-23T14:05:00.000Z",   // (requested_datetime)
  "descricao": "Poste apagado há uma semana na quadra 12", // (description)
  "categoria": { "slug": "iluminacao-publica", "nome": "Iluminação pública" }, // (service_code) — confirmada pelo cidadão
  "local": {
    "latitude": -15.8267, "longitude": -48.1128,  // (lat, long)
    "enderecoReferencia": "QNM 12, perto da escola", // (address_string)
    "ra": { "codigo": "RA-IX", "nome": "Ceilândia" }
  },
  "anexos": [{ "url": "https://.../api/v1/anexos/<token>", "mime": "image/jpeg" }], // (media_url)
  "sugestaoIA": {
    "categoriaSlug": "iluminacao-publica",
    "orgao": { "sigla": "CEB-IPES", "nome": "CEB Iluminação Pública e Serviços" },
    "confianca": 0.86,
    "justificativa": "Relato de poste sem luz em via pública.",
    "origem": "LLM",                      // LLM | REGRAS
    "modelo": "<nome do modelo>",
    "cidadaoConfirmou": true              // false = cidadão trocou a categoria sugerida
  },
  "anonima": true,
  "callbackUrl": "https://.../api/v1/integracao/gdf/eventos"
}
```

### Payload de callback (GDF → Voz DF)

```json
{
  "eventoId": "gdf-evt-0001",     // idempotência
  "protocolo": "DF-2026-000123",
  "status": "ENCAMINHADA",
  "orgaoSigla": "CEB-IPES",       // obrigatório em ENCAMINHADA (decisão do GDF)
  "texto": "Encaminhada à CEB-IPES.", // obrigatório em NAO_PROCEDENTE / DUPLICADA / RESOLVIDA
  "ocorridoEm": "2026-09-23T15:00:00.000Z"
}
```

O mesmo endpoint de callback aceita também a **avaliação da IA pelo operador**:

```json
{
  "eventoId": "gdf-ia-0001",
  "tipo": "AVALIACAO_IA",          // eventos sem "tipo" são mudanças de status
  "protocolo": "DF-2026-000123",
  "acertou": false,
  "categoriaCorretaSlug": "seguranca-espacos-publicos", // obrigatório quando acertou = false
  "ocorridoEm": "2026-09-23T15:05:00.000Z"
}
```

### Avaliação do cidadão (Voz DF → GDF)

`POST {GDF_WEBHOOK_URL}/{protocolo}/avaliacoes-cidadao` (mesma chave do push). Enviada quando o autor confirma ou contesta a resolução; falhas ficam pendentes em `AvaliacaoCidadao` e são reenviadas junto com as denúncias.

```json
{
  "versao": "1",
  "eventoId": "voz-aval-<id>",
  "protocolo": "DF-2026-000123",
  "avaliacao": "CONTESTADA",        // CONFIRMADA | CONTESTADA
  "justificativa": "O poste voltou a apagar no dia seguinte.", // obrigatória em CONTESTADA
  "ocorridoEm": "2026-10-01T12:00:00.000Z"
}
```

Erros no formato `{ error: { code, message } }`, sem stack trace.

## 3. IA de sugestão (classificador)

Interface única `Classificador` (`src/server/classificador/`) com duas implementações:

| Implementação | Quando | Como |
|---|---|---|
| `OllamaClassificador` | `OLLAMA_URL` acessível | LLM local via Ollama (`/api/chat`, `format` = JSON Schema, `temperature: 0`). A categoria é restrita a um `enum` com os slugs ativos — o modelo não consegue inventar categoria. |
| `RegrasClassificador` | fallback (Ollama fora do ar, timeout, resposta inválida) | Palavras-chave por categoria. Fraco, mas a demo nunca quebra. |

- O **órgão sugerido** é derivado da categoria (`Categoria.orgaoPadrao`); `ADM-RA` vira "Administração Regional – <RA da denúncia>".
- Saída sempre validada com Zod; confiança em `[0, 1]`; `origem` registra qual implementação respondeu.
- **Por que local:** sem custo, sem chave, e o texto do cidadão não sai da máquina (LGPD). Limite: precisa do Ollama instalado onde o app roda; em deploy serverless (Vercel) não há GPU → cai no fallback ou exige um servidor com Ollama.
- **Viabilidade medida, não presumida:** `npm run eval:classificador -- <modelos>` roda os casos fictícios de `data/casos-classificador.json` e reporta acurácia e latência por modelo.

  Medição de 23/09/2026 (48 casos, 16 categorias; notebook com RTX 5070 Laptop 8 GB, Ollama 0.34.3, `think: false`, `temperature: 0`):

  | Classificador | Acurácia | Acerto entre as 3 sugestões | Latência p50 / p95 |
  |---|---|---|---|
  | Regras (fallback) | 58,3% | 70,8% | ~0 ms |
  | `gemma3:4b` | 75,0% | 79,2% | 1,1 s / 1,5 s |
  | **`qwen3.5:4b` (padrão)** | **93,8%** | **97,9%** | 1,3 s / 1,6 s |

  Limitação: casos escritos pela equipe, não denúncias reais — o número real tende a ser menor. Refazer a medição ao trocar de modelo, de prompt ou de lista de categorias.
- No envio, o servidor **reclassifica** a descrição (não confia na sugestão vinda do navegador) e grava em `SugestaoIA`.
- **Confiança:** o modelo devolve uma confiança autodeclarada que se mostrou pouco informativa (praticamente sempre 0,95). Ela é gravada (`SugestaoIA.confianca`) e segue no JSON, mas **não é exibida** nas telas.
- **Avaliação pelo operador (feedback):** no Simulador GDF, "A IA acertou?" (sim/não + categoria correta) → callback `AVALIACAO_IA` → `SugestaoIA.acertouSegundoGdf` / `categoriaCorretaId`. Isso **não treina o modelo**: serve para (1) medir a acurácia em casos reais — `npm run eval:classificador -- --fonte=gdf <modelo>` usa essas avaliações como gabarito — e (2) orientar mudanças de prompt/modelo/categorias, comparando antes/depois. Uso dos casos corrigidos como exemplos no prompt: fase 2, só se a medição mostrar ganho.
- **Escopo atual: só texto.** As fotos não são enviadas ao modelo; seguem apenas para armazenamento (sem EXIF) e como link no JSON do GDF.

### Extensão futura: fotos (não implementado)

Decisão de 23/09/2026: manter só texto na Fase 1 (texto já mede 93,8%; foto é opcional; ganho não medido). Se for retomado:

- **Viabilidade:** o `qwen3.5:4b` já instalado aceita imagem (capacidade "vision" no Ollama) — não precisa de outro modelo. A imagem vai no campo `images` (base64) da mensagem em `/api/chat`; mandar a versão já processada (sem EXIF, reduzida) para não pesar a latência.
- **Onde muda:**
  - `Classificador.classificar(descricao)` → `classificar({ descricao, imagens? })` em `src/server/classificador/tipos.ts` (regras ignoram imagens).
  - `OllamaClassificador`: anexar `images` na mensagem do usuário; ajustar o prompt ("use a foto só como apoio ao relato").
  - Fluxo do assistente: hoje as fotos só sobem no envio final. Para a sugestão usar a foto, é preciso subir/processar antes (ex.: `POST /api/v1/classificacoes` multipart) — reavaliar rate limit e tamanho.
  - `criarDenuncia` reclassifica com as mesmas fotos já processadas.
- **Estratégia recomendada:** foto como **apoio**, não como padrão — reclassificar com imagem só quando a confiança do texto for baixa ou o texto for curto/vago. Evita pagar a latência extra em toda denúncia.
- **Medir antes de adotar:** montar um conjunto de fotos fictícias rotuladas (sem pessoas nem placas) e estender `scripts/eval-classificador.ts` para comparar texto vs. texto+foto em acurácia e latência p50/p95.
- **Privacidade:** continua local (a foto não sai do servidor), mas o modelo passa a "ver" rostos/placas; a justificativa gerada não deve descrevê-los (instruir no prompt e testar).

## 4. Perfis e permissões

| Perfil | Vê | Pode |
|---|---|---|
| (anônimo) | Mapa público; consulta por protocolo | Criar denúncia anônima |
| `CIDADAO` | Mapa público; as próprias denúncias | Criar denúncia; acompanhar as suas; confirmar ou contestar a resolução (até 30 dias) |
| `OPERADOR_GDF` | Simulador GDF | Operar o simulador (demonstração); avaliar se a IA acertou |
| Integração GDF (chave de API) | — | Enviar eventos de status via callback |

Verificação de permissão no servidor em toda leitura e escrita (não apenas esconder botões).

**Autenticação (implementação):**
- Auth.js / `next-auth@5.0.0-beta.32` com provider de credenciais e sessão JWT em cookie `httpOnly` (8 h). O token guarda só o id do usuário.
- **Autorização numa DAL** (`src/server/auth/sessao.ts`), como recomenda o guia do Next 16: cada checagem relê o usuário no banco, então papel revogado ou conta removida perde acesso na hora. Sem `proxy.ts` no MVP (seria só checagem otimista).
- Cadastro público cria sempre `CIDADAO`; `OPERADOR_GDF` só via seed.
- Login não revela se o e-mail existe (mesma resposta e tempo de bcrypt equivalente).
- Parâmetro `voltar` aceita só caminhos internos (sem open redirect).
- **Risco:** a v5 do Auth.js segue em beta e o projeto passou a ser mantido pela equipe do Better Auth. A autenticação está isolada em `src/auth.ts` + `src/server/auth/`, o que limita o custo de trocar de biblioteca.

## 5. Modelo de dados

```
RegiaoAdministrativa  id, codigo ("RA-IX"), numero (9), nome, slug, limite? (GeoJSON oficial)
Orgao                 id, sigla (única), nome
Categoria             id, slug, nome, descricao, orgaoPadraoId, ativa
Usuario               id, nome, email (único), senhaHash, papel (CIDADAO|OPERADOR_GDF), criadoEm

Denuncia
  id, protocolo (único), descricao
  categoriaId, raId
  orgaoResponsavelId?   (definido pelo GDF no callback; nunca pela IA)
  latitude, longitude, enderecoReferencia?
  status, autorId? (null = anônima)
  criadoEm, atualizadoEm, resolvidoEm?

SugestaoIA        id, denunciaId (único), categoriaId, orgaoId, confianca, justificativa,
                  origem (LLM|REGRAS), modelo, cidadaoConfirmou, criadoEm,
                  acertouSegundoGdf?, categoriaCorretaId?, avaliadoPeloGdfEm?   (feedback do operador)
AvaliacaoCidadao  id, denunciaId, tipo (CONFIRMADA|CONTESTADA), justificativa?, criadoEm,
                  enviadoEm?, tentativas, ultimoErro?     (também é a fila de envio ao GDF)
Anexo             id, denunciaId, token (único, aleatório), caminho, mime, tamanho, criadoEm
EventoDenuncia    id, denunciaId, ator (SISTEMA|GDF|CIDADAO), autorId?, tipo,
                  statusDe?, statusPara?, texto?, publico, eventoExternoId? (único), criadoEm
EnvioGdf          id, denunciaId (único), tentativas, ultimoErro?, enviadoEm?, idExterno?, atualizadoEm
ContadorProtocolo ano (PK), ultimo           (geração atômica do protocolo)

-- módulo simulador-gdf (demonstração) --
ManifestacaoGdf   id, protocolo (único), payload (JSON), status, orgaoDecididoSigla?,
                  avaliacaoCidadao?, justificativaCidadao?, iaAcertou?, categoriaCorretaSlug?, recebidoEm, atualizadoEm
```

Índices: `Denuncia(raId, status)`, `Denuncia(categoriaId, status)`, `Denuncia(criadoEm)`, `Denuncia(autorId)`.

Protocolo `DF-AAAA-NNNNNN`: incremento de `ContadorProtocolo` dentro da mesma transação que cria a denúncia (sem `count() + 1`, que duplica em concorrência).

## 6. Máquina de estados

O status no Voz DF **espelha** o que o GDF informa. Tabela única em `src/domain/status.ts`, com testes.

```
RECEBIDA ──(SISTEMA: push ok)──► ENVIADA_GDF
ENVIADA_GDF ──► EM_ANALISE | ENCAMINHADA | NAO_PROCEDENTE | DUPLICADA
EM_ANALISE  ──► ENCAMINHADA | NAO_PROCEDENTE | DUPLICADA
ENCAMINHADA ──► EM_EXECUCAO | NAO_PROCEDENTE | EM_ANALISE   (órgão devolve: não é competência dele)
EM_EXECUCAO ──► RESOLVIDA | NAO_PROCEDENTE
RESOLVIDA   ──(CIDADAO autor, até 30 dias, justificativa)──► REABERTA
REABERTA    ──► EM_ANALISE | ENCAMINHADA | NAO_PROCEDENTE
```

| Transição | Ator | Exige |
|---|---|---|
| RECEBIDA → ENVIADA_GDF | SISTEMA | envio aceito pelo GDF |
| RESOLVIDA → REABERTA | CIDADAO (só o autor, com conta) | justificativa (mín. 10 caracteres); prazo de 30 dias contado de quando o Voz DF **recebeu** a resolução |
| demais | GDF (callback) | `ENCAMINHADA`: `orgaoSigla`; `NAO_PROCEDENTE`, `DUPLICADA`, `RESOLVIDA`: `texto` |

Estados finais: `NAO_PROCEDENTE`, `DUPLICADA`. `RESOLVIDA` pode ser reaberta pelo autor; **confirmar** não muda o status (só registra `AvaliacaoCidadao` e avisa o GDF). Cada nova resolução abre um novo ciclo de avaliação. A justificativa da contestação **não** aparece na linha do tempo pública (pode citar terceiros) — fica com o autor e o GDF. Denúncias anônimas não podem ser avaliadas (o protocolo é sequencial; qualquer um poderia contestar).

## 7. Fluxos principais

**Criar denúncia (wizard):**
① Descrição + até 3 fotos → ② IA sugere categoria (e órgão, só informativo) → cidadão confirma ou troca → ③ local no mapa + RA (seleção no MVP) → ④ revisar e enviar.
Servidor: valida (Zod) → reclassifica → transação {protocolo, `Denuncia(RECEBIDA)`, `SugestaoIA`, `EventoDenuncia(CRIADA)`, `EnvioGdf`} → tenta o push → exibe protocolo.

**Envio ao GDF:** push síncrono após criar (timeout curto). Se falhar, a denúncia fica `RECEBIDA` com `EnvioGdf.ultimoErro`; `POST /api/v1/integracao/gdf/reenviar` (operador) ou nova tentativa na próxima criação reprocessa os pendentes.

**Retorno do GDF:** callback → valida chave e payload → ignora `eventoId` repetido → valida transição → atualiza `Denuncia` + grava `EventoDenuncia(ator=GDF)`.

**Detecção automática da RA:** ao marcar o ponto (mapa ou GPS), `GET /api/v1/regioes/detectar` faz point-in-polygon (`src/domain/geo.ts`, ray casting com buracos e multipolígonos) nos limites oficiais e **pré-preenche** a RA; o cidadão pode trocar (perto de divisas o ponto pode estar impreciso). Sem limites carregados → seleção manual.
- **Fonte:** IDE-DF/SEDUH, geoserviço `Publico/LIMITES`, camada 1 (conferida em 24/09/2026: **37 RAs**, incluindo 26 de Setembro e Ponte Alta, sancionadas em 03/07/2026).
- **Licença não declarada** pela fonte → os polígonos **não são versionados**: `npm run ras:baixar` salva em `data/cache/` (gitignored), simplificados a ~10 m (357 KB), e o seed grava em `RegiaoAdministrativa.limite` (JSON). Citar a fonte em apresentações.

## 8. API (v1)

```
GET    /api/v1/regioes
GET    /api/v1/regioes/detectar?lat=&lng=     RA que contém o ponto (ou null)
GET    /api/v1/categorias
POST   /api/v1/classificacoes                 { descricao } → sugestão (rate limit)
POST   /api/v1/denuncias                      criar (auth opcional; multipart com fotos)
GET    /api/v1/denuncias/{protocolo}          consulta pública (sem dados pessoais)
GET    /api/v1/denuncias/mapa?ra=&categoria=&situacao=  pontos públicos (coordenadas ~100 m, sem relato)
GET    /api/v1/anexos/{token}                 foto (token aleatório, sem EXIF)
POST   /api/v1/integracao/gdf/eventos         callback do GDF: status ou AVALIACAO_IA (chave de API)
POST   /api/v1/integracao/gdf/reenviar        reprocessa envios pendentes (OPERADOR_GDF)

-- simulador (demonstração) --
POST   /api/simulador-gdf/manifestacoes       recebe o push (chave de API)
POST   /api/simulador-gdf/manifestacoes/{protocolo}/avaliacoes-cidadao   recebe confirmação/contestação
```

## 9. Segurança e LGPD

- Dados pessoais nunca no mapa público, na consulta por protocolo nem no payload enviado ao GDF.
- **Mapa público:** coordenadas arredondadas para 3 casas decimais (~100 m) — o ponto exato pode apontar a casa de quem denunciou ou de quem foi denunciado; sem relato nem referência; `NAO_PROCEDENTE` e `DUPLICADA` ficam fora.
- IA local: o texto do cidadão não é enviado a terceiros.
- EXIF removido das imagens; arquivo renomeado; tipo real (magic bytes) e tamanho (≤ 5 MB) validados; fotos fora de `src/` e servidas só por token.
- Chaves de integração (`GDF_WEBHOOK_KEY`, `GDF_CALLBACK_KEY`) só em `.env`; comparação em tempo constante.
- Rate limit em memória (`src/server/limites.ts`): login 5 tentativas/15 min por e-mail e 30/15 min por IP; cadastro 5/h por IP; denúncia 5/h por usuário ou IP; classificação 30/10 min por IP. Vale para um processo só — com várias instâncias, trocar por store compartilhado.
- Senhas com hash (bcrypt); sessão em cookie `httpOnly`, `secure`, `sameSite=lax`.
- Aviso fixo: emergências → 190 (PMDF) / 193 (CBMDF); este canal não substitui o atendimento de emergência.

## 10. Relação com os canais existentes

O Participa DF e a Central 162 já existem. O Voz DF é pensado como **canal de entrada simplificado que alimenta** o sistema do governo (via API), não como concorrente. A integração real depende de o GDF expor uma API (ou aderir à API do Fala.BR) — no MVP ela é simulada.
