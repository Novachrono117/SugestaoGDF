# Deploy — Voz DF

Guia para publicar o Voz DF em um servidor próprio (VPS) com Docker. Criar a conta no provedor, registrar
o domínio e configurar DNS/SMTP ficam com quem for publicar; o repositório já traz o resto.

## Como fica

```
Internet ──443/80──► Caddy (HTTPS automático) ──► app (Next.js standalone, porta 3000) ──► Postgres
                                                      │ volume "uploads" (fotos)
                        migrador (roda e sai a cada deploy: migrações → limites das RAs → seed)
                        agendador (a cada 5 min: POST /api/v1/integracao/gdf/reenviar, pela rede interna)
```

- `Dockerfile`: alvo `app` (≈ 400 MB, usuário sem privilégios, health check em `/api/health`) e alvo `migrador`.
- `compose.producao.yml`: Postgres, migrador, app, agendador e Caddy. Só o Caddy publica portas; banco e app ficam na rede interna.
- `deploy/Caddyfile`: certificado Let's Encrypt, HSTS, limite de 20 MB por requisição.
- O `docker-compose.yml` da raiz continua sendo **só de desenvolvimento**.

Verificado localmente em 25/09/2026 com `DOMINIO=localhost`: build das imagens, migração + seed (37 RAs com
limites), health check, cabeçalhos de segurança, redirecionamento HTTP→HTTPS, login com cookie `secure`,
denúncia com foto (processada pelo `sharp` nativo dentro da imagem e gravada renomeada) e envio ao simulador;
redeploy sem migrações pendentes. O callback do simulador não fecha com `localhost` (ver "Solução de problemas").
Em 28/09/2026, de novo: CSP com nonce passando pelo Caddy, seed com `SEED_USUARIOS_DEMO=false`, conta de operador
criada com `usuario:criar` dentro do container, contato no aviso de privacidade e o agendador rodando a cada ciclo.

## Pré-requisitos

- Servidor Linux com Docker (Compose v2) e **≥ 2 GB de RAM** (o `next build` dentro do Docker usa bastante memória;
  com menos, gere as imagens em outra máquina e envie para um registry).
- Domínio com registro **A** apontando para o IP do servidor; portas **80 e 443** liberadas no firewall.
- Opcional: conta em um provedor SMTP (Brevo, Mailgun, Amazon SES…) com SPF/DKIM do domínio configurados.

## Primeiro deploy

```bash
git clone <repo> voz-df && cd voz-df
cp .env.producao.example .env.producao
# gere cada segredo (use hex — caracteres especiais quebram a DATABASE_URL montada pelo compose):
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# preencha no .env.producao: DOMINIO, POSTGRES_PASSWORD, AUTH_SECRET, GDF_WEBHOOK_KEY, GDF_CALLBACK_KEY,
# TAREFAS_KEY (reenvio automático), SEED_SENHA_DEMO e CONTATO_PRIVACIDADE
docker compose -f compose.producao.yml --env-file .env.producao up -d --build
curl https://SEU-DOMINIO/api/health     # {"ok":true}
```

Entre com `operador@vozdf.example` (senha = `SEED_SENHA_DEMO`) para usar o Simulador GDF.

## Atualizar

```bash
git pull
docker compose -f compose.producao.yml --env-file .env.producao up -d --build
```

O migrador roda de novo (idempotente) antes do app novo subir. O app para com `SIGTERM` e tem 30 s para
terminar requisições e tarefas `after()` (envio de e-mails) pendentes.

## Contas

Para a demonstração, o seed cria `operador@vozdf.example` e `cidada@vozdf.example` (senha `SEED_SENHA_DEMO`).
Num uso real, crie contas nominais e remova as fictícias. O comando roda na imagem do migrador (tem os scripts);
a senha é digitada sem aparecer na tela — nunca na linha de comando.

```bash
C="docker compose -f compose.producao.yml --env-file .env.producao"
$C run --rm migrador npm run usuario:criar -- --nome "Maria Souza" --email maria@exemplo.gov.br --papel OPERADOR_GDF
$C run --rm migrador npm run usuario:remover -- --email operador@vozdf.example
$C run --rm migrador npm run usuario:remover -- --email cidada@vozdf.example
# e no .env.producao: SEED_USUARIOS_DEMO=false (senão o próximo deploy recria as fictícias)
```

Sem terminal interativo (CI, script), passe a senha pela variável `NOVA_SENHA` (`$C run --rm -e NOVA_SENHA migrador ...`).
Remover uma conta tem o mesmo efeito de "Excluir conta": as denúncias dela ficam anônimas.

## Backup

```bash
# banco
docker compose -f compose.producao.yml --env-file .env.producao exec -T postgres \
  sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > backup-$(date +%F).sql
# fotos
docker run --rm -v voz-df-producao_uploads:/dados -v "$PWD":/destino alpine \
  tar czf /destino/uploads-$(date +%F).tgz -C /dados .
```

Guarde os backups fora do servidor: eles contêm relatos e e-mails de cidadãos (dados pessoais — LGPD).

## Variáveis por ambiente

| Variável | Desenvolvimento (`.env`) | E2E (`scripts/e2e-servidor.mjs`) | Produção (`.env.producao`) |
|---|---|---|---|
| Banco | Postgres do `docker-compose.yml` | banco `vozdf_e2e` recriado a cada execução | Postgres interno do `compose.producao.yml` |
| `APP_URL` / `AUTH_URL` | `http://localhost:3000` | `http://localhost:3100` | `https://DOMINIO` (montado pelo compose) |
| `AUTH_TRUST_HOST` | — | — | `true` (atrás do Caddy) |
| IA (`OLLAMA_MODEL`) | `qwen3.5:4b` | vazio (regras, determinístico) | vazio, ou Ollama em outra máquina |
| E-mail | Mailpit | Mailpit | SMTP real, ou vazio (fila) |
| GDF | Simulador do próprio app | Simulador | Simulador (MVP) ou `GDF_WEBHOOK_URL` real |

## IA em produção

Hospedagem comum não tem GPU. Sem `OLLAMA_MODEL`, o app usa o **classificador por regras**, que acertou
58% dos casos de avaliação, contra 94% do `qwen3.5:4b` (`npm run eval:classificador`). O cidadão sempre confirma
ou troca a categoria, então o fluxo funciona. Para ter o LLM:

- rode o Ollama numa VM/máquina com GPU e aponte `OLLAMA_URL` para ela;
- **não exponha a porta 11434 na internet**: o Ollama não tem autenticação. Use rede privada, VPN ou firewall
  liberando só o IP do servidor do app. O relato do cidadão trafega até lá.

## Outras plataformas (Render, Railway, Fly.io…)

Use o `Dockerfile` (alvo `app`) com Postgres gerenciado:

- comando de *release/pre-deploy*: a imagem do alvo `migrador` (ou `npx prisma migrate deploy && npx prisma db seed`);
- disco persistente montado em `/app/uploads`;
- **uma instância só**: rate limit e fotos ficam na própria instância (ver pendências);
- a plataforma já faz o papel do Caddy (HTTPS); defina `AUTH_TRUST_HOST=true`. O app usa o **último** IP do
  `X-Forwarded-For` como IP do cliente: confira que há só um proxy na frente, senão o rate limit por IP perde efeito.

## Solução de problemas

| Sintoma | Causa provável |
|---|---|
| Caddy não emite certificado | DNS ainda não propagou, ou portas 80/443 fechadas |
| Simulador: "Não foi possível avisar o Voz DF" | O callback vai para `https://DOMINIO`; com `DOMINIO=localhost` (teste local) não há rota de volta. Com domínio real, confira se o servidor alcança o próprio domínio |
| Service worker não registra no teste local | O navegador recusa service worker com certificado não confiável (CA interna do Caddy); com Let's Encrypt funciona |
| `Configuração inválida no .env` nos logs do app | Variável obrigatória vazia ou curta demais (chaves ≥ 32 caracteres) |
| Build falha com "heap out of memory" | Pouca RAM no servidor: gere a imagem em outra máquina |

## Antes de um uso público real

Resolvido no código (28/09/2026); falta só o que depende de quem publica:

- ✅ **Aviso de privacidade (LGPD):** `/privacidade` (link no rodapé, no cadastro e no assistente), aceite explícito no
  cadastro, "Baixar meus dados" e "Excluir conta" em Minha conta. **Falta preencher `CONTATO_PRIVACIDADE`** (canal
  do titular) e, num uso real, revisar o texto com quem responde juridicamente pelo serviço.
- ✅ **Usuários de demonstração:** num uso real, `SEED_USUARIOS_DEMO=false` e contas nominais (ver "Contas" acima).
- ✅ **Content-Security-Policy** com nonce por requisição (`src/proxy.ts`), verificada no E2E sem violações.
- ✅ **Reenvio automático:** com `TAREFAS_KEY` preenchida, o serviço `agendador` chama o reenvio a cada 5 min
  (`AGENDADOR_INTERVALO_S`) pela rede interna. Numa plataforma sem compose, use o cron dela:
  `POST https://DOMINIO/api/v1/integracao/gdf/reenviar` com `Authorization: Bearer <TAREFAS_KEY>`.
- **Fora do código:** preencher `CONTATO_PRIVACIDADE`, revisar o aviso de privacidade com quem responde
  juridicamente pelo serviço e configurar um SMTP real (com SPF/DKIM).
- **Só se houver escala horizontal** (mais de uma instância): trocar rate limit em memória por store compartilhado e as fotos
  por storage S3-compatível (ver `docs/ROADMAP.md`, "Adiados").
