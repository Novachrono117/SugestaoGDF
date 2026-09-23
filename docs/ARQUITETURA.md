# Arquitetura — Voz DF

## 1. Visão geral

O Voz DF é a **porta de entrada** da denúncia, não o sistema de gestão do governo:

1. O cidadão descreve o problema com as próprias palavras (texto + foto + local), sem precisar saber qual órgão é responsável.
2. Uma IA local **sugere** a categoria e o órgão responsável; o cidadão confirma ou troca a categoria.
3. O Voz DF envia a denúncia como **JSON para o GDF** (push). **Quem decide o órgão responsável é o GDF** — a IA só sugere.
4. O GDF devolve a decisão e as mudanças de status (callback); o cidadão acompanha pelo protocolo.

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
     Prisma ─► SQLite (dev) / PostgreSQL (prod)
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

Erros no formato `{ error: { code, message } }`, sem stack trace.

## 3. IA de sugestão (classificador)

Interface única `Classificador` (`src/server/classificador/`) com duas implementações:

| Implementação | Quando | Como |
|---|---|---|
| `OllamaClassificador` | `OLLAMA_URL` acessível | LLM local via Ollama (`/api/chat`, `format` = JSON Schema, `temperature: 0`). A categoria é restrita a um `enum` com os slugs ativos — o modelo não consegue inventar categoria. |
| `RegrasClassificador` | fallback (Ollama fora do ar, timeout, resposta inválida) | Palavras-chave por categoria. Fraco, mas a demo nunca quebra. |

- O **órgão sugerido** é derivado da categoria (`Categoria.orgaoPadrao`); `ADM-RA` vira "Administração Regional de <RA da denúncia>".
- Saída sempre validada com Zod; confiança em `[0, 1]`; `origem` registra qual implementação respondeu.
- **Por que local:** sem custo, sem chave, e o texto do cidadão não sai da máquina (LGPD). Limite: precisa do Ollama instalado onde o app roda; em deploy serverless (Vercel) não há GPU → cai no fallback ou exige um servidor com Ollama.
- **Viabilidade medida, não presumida:** `npm run eval:classificador` roda os casos fictícios de `data/casos-classificador.json` e reporta acurácia e latência por modelo. O modelo padrão só é fixado depois dessa medição.
- No envio, o servidor **reclassifica** a descrição (não confia na sugestão vinda do navegador) e grava em `SugestaoIA`.

## 4. Perfis e permissões

| Perfil | Vê | Pode |
|---|---|---|
| (anônimo) | Mapa público; consulta por protocolo | Criar denúncia anônima |
| `CIDADAO` | Mapa público; as próprias denúncias | Criar denúncia; acompanhar as suas |
| `OPERADOR_GDF` | Simulador GDF | Operar o simulador (demonstração) |
| Integração GDF (chave de API) | — | Enviar eventos de status via callback |

Verificação de permissão no servidor em toda leitura e escrita (não apenas esconder botões).

## 5. Modelo de dados

```
RegiaoAdministrativa  id, codigo ("RA-IX"), numero (9), nome, slug
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
                  origem (LLM|REGRAS), modelo, cidadaoConfirmou, criadoEm
Anexo             id, denunciaId, token (único, aleatório), caminho, mime, tamanho, criadoEm
EventoDenuncia    id, denunciaId, ator (SISTEMA|GDF|CIDADAO), autorId?, tipo,
                  statusDe?, statusPara?, texto?, publico, eventoExternoId? (único), criadoEm
EnvioGdf          id, denunciaId (único), tentativas, ultimoErro?, enviadoEm?, atualizadoEm
ContadorProtocolo ano (PK), ultimo           (geração atômica do protocolo)

-- módulo simulador-gdf (demonstração) --
ManifestacaoGdf   id, protocolo (único), payload (JSON), status, orgaoDecididoSigla?, recebidoEm, atualizadoEm
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
```

| Transição | Ator | Exige |
|---|---|---|
| RECEBIDA → ENVIADA_GDF | SISTEMA | envio aceito pelo GDF |
| demais | GDF (callback) | `ENCAMINHADA`: `orgaoSigla`; `NAO_PROCEDENTE`, `DUPLICADA`, `RESOLVIDA`: `texto` |

Estados finais: `RESOLVIDA`, `NAO_PROCEDENTE`, `DUPLICADA`. Reabertura pelo cidadão fica para a fase 2 (precisa de reenvio ao GDF).

## 7. Fluxos principais

**Criar denúncia (wizard):**
① Descrição + até 3 fotos → ② IA sugere categoria (e órgão, só informativo) → cidadão confirma ou troca → ③ local no mapa + RA (seleção no MVP) → ④ revisar e enviar.
Servidor: valida (Zod) → reclassifica → transação {protocolo, `Denuncia(RECEBIDA)`, `SugestaoIA`, `EventoDenuncia(CRIADA)`, `EnvioGdf`} → tenta o push → exibe protocolo.

**Envio ao GDF:** push síncrono após criar (timeout curto). Se falhar, a denúncia fica `RECEBIDA` com `EnvioGdf.ultimoErro`; `POST /api/v1/integracao/gdf/reenviar` (operador) ou nova tentativa na próxima criação reprocessa os pendentes.

**Retorno do GDF:** callback → valida chave e payload → ignora `eventoId` repetido → valida transição → atualiza `Denuncia` + grava `EventoDenuncia(ator=GDF)`.

**Detecção automática da RA (fase 2):** point-in-polygon com os limites oficiais (Geoportal DF/SEDUH — verificar licença). No MVP a RA é escolhida pelo usuário.

## 8. API (v1)

```
GET    /api/v1/regioes
GET    /api/v1/categorias
POST   /api/v1/classificacoes                 { descricao } → sugestão (rate limit)
POST   /api/v1/denuncias                      criar (auth opcional; multipart com fotos)
GET    /api/v1/denuncias/{protocolo}          consulta pública (sem dados pessoais)
GET    /api/v1/denuncias/mapa?ra=&categoria=  pontos públicos
GET    /api/v1/anexos/{token}                 foto (token aleatório, sem EXIF)
POST   /api/v1/integracao/gdf/eventos         callback do GDF (chave de API)
POST   /api/v1/integracao/gdf/reenviar        reprocessa envios pendentes (OPERADOR_GDF)

-- simulador (demonstração) --
POST   /api/simulador-gdf/manifestacoes       recebe o push (chave de API)
```

## 9. Segurança e LGPD

- Dados pessoais nunca no mapa público, na consulta por protocolo nem no payload enviado ao GDF.
- IA local: o texto do cidadão não é enviado a terceiros.
- EXIF removido das imagens; arquivo renomeado; tipo real (magic bytes) e tamanho (≤ 5 MB) validados; fotos fora de `src/` e servidas só por token.
- Chaves de integração (`GDF_WEBHOOK_KEY`, `GDF_CALLBACK_KEY`) só em `.env`; comparação em tempo constante.
- Rate limit: criação de denúncia (ex.: 5/hora por IP/usuário), classificação e login.
- Senhas com hash (bcrypt); sessão em cookie `httpOnly`, `secure`, `sameSite=lax`.
- Aviso fixo: emergências → 190 (PMDF) / 193 (CBMDF); este canal não substitui o atendimento de emergência.

## 10. Relação com os canais existentes

O Participa DF e a Central 162 já existem. O Voz DF é pensado como **canal de entrada simplificado que alimenta** o sistema do governo (via API), não como concorrente. A integração real depende de o GDF expor uma API (ou aderir à API do Fala.BR) — no MVP ela é simulada.
