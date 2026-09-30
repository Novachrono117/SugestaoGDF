# Demo da apresentação — Voz DF

Três cenários, do melhor para o de reserva. O mesmo comando (`npm run demo`) serve para todos: ele tenta o túnel,
mostra os endereços da rede local e, se nada disso servir, você apresenta sozinho pelo notebook.

| Cenário | Internet do notebook | Como a turma entra |
|---|---|---|
| **1. Túnel pelo 4G** | Roteador do seu celular | QR "Qualquer rede" (endereço `https://…trycloudflare.com`) |
| **2. Wi-Fi de lá** | Wi-Fi da faculdade | QR "Qualquer rede" se o túnel subir; senão, QR "Mesma rede" (só funciona se a rede deixar celulares falarem entre si) |
| **3. Só você** | Qualquer uma (ou nenhuma) | Ninguém: demo no projetor, pelo `http://localhost:3000` |

O túnel usa HTTP/2 na porta 443 (TCP), porque redes de faculdade bloqueiam o QUIC (UDP), que é o padrão do `cloudflared`: foi o que aconteceu no dia da apresentação. O endereço do túnel **muda a cada vez que ele sobe**: o QR é gerado na hora, na página que abre sozinha (`.tmp/demo-qr.html`).

## Hoje à noite

- [ ] `docker compose up -d` e `npm run demo:preparar` (banco `vozdf_demo` novo: 16 denúncias fictícias + build). Leva ~3 min.
- [ ] `npm run demo`, abrir o QR **pelo seu celular no 4G** e fazer uma denúncia até o fim. Se o Windows perguntar se libera o Node na rede, **permitir** (redes privadas e públicas).
- [ ] Entrar como operador (`operador@vozdf.example`, senha = `SEED_SENHA_DEMO` do seu `.env`) e ver a denúncia no Simulador.
- [ ] Ctrl+C. Deixar o notebook carregando.

## Amanhã, 30 min antes

1. Notebook **na tomada**, "Nunca suspender" enquanto estiver ligado, notificações desligadas (modo foco).
2. Abrir o Docker Desktop e esperar ficar verde → `docker compose up -d`.
3. Escolher a internet: 4G do celular (cenário 1) ou Wi-Fi de lá (cenário 2).
4. `npm run demo` e ler o terminal:
   - `IA local ativa (qwen3.5:4b)` → ótimo. Se aparecer **INDISPONÍVEL**, ver "Se der errado".
   - `Túnel OK: https://…` → cenário 1/2 com QR "Qualquer rede". `Túnel indisponível` → trocar a internet e rodar de novo, ou seguir com a rede local/só você.
5. Em outro terminal: `npm run demo:verificar -- <endereço do túnel>` — ensaia sozinho o caminho da turma (cadastro,
   denúncia com a IA, operador vê no simulador) em ~20 s. Todas as linhas `ok`? Depois abra o QR pelo **seu**
   celular no 4G para ver com os próprios olhos.
6. Deixar abertas no navegador do notebook: a página dos QR codes, o **Simulador GDF** (logado como operador) e o **Mapa**.

> Quer começar do zero (tirar as denúncias do ensaio)? `npm run demo:preparar` antes do passo 4.

## Roteiro (5 min) — com a turma testando

Mesmos tópicos do `ATIVIDADE.md` (Etapa 5); o que muda é a demonstração, que vira participação.

| Tempo | O que fazer | O que falar |
|---|---|---|
| 0:00–0:40 | Slide/tela inicial | "Quem aqui já viu um poste apagado ou lixo acumulado e não soube para quem reclamar?" |
| 0:40–1:20 | — | Problema pequeno vira grande (dengue, acidente, insegurança); sem retorno o cidadão desiste; sem dados o governo prioriza no escuro. |
| 1:20–1:40 | **Mostrar a página dos QR codes** | "Peguem o celular e abram o QR: registrem um problema do seu bairro. Pode criar conta com qualquer e-mail ou mandar sem se identificar." |
| 1:40–2:40 | Enquanto eles digitam, **fazer uma você mesmo no projetor**: "o poste da minha rua está apagado" → IA sugere *Iluminação pública* → confirmar → tocar no mapa (a RA aparece sozinha) → enviar → protocolo | "Ninguém precisou saber que poste é com a CEB. A IA **só sugere**; o cidadão confirma." |
| 2:40–3:20 | **Simulador GDF** (F5): as denúncias da turma chegando. Abrir uma, mostrar o **JSON** e a sugestão da IA. Encaminhar → Em execução → **Resolvida** | "É isso que o governo receberia pela API, **sem nome nem e-mail** de quem denunciou. Quem decide o órgão é o GDF." Pedir para o dono daquela denúncia olhar o celular: o status mudou. |
| 3:20–3:50 | Mapa público e Transparência | Tecnologias: site responsivo que instala como app, PostgreSQL, OpenStreetMap, **IA local** (Qwen 3.5 no próprio notebook: sem custo e sem mandar texto para empresa nenhuma), API com JSON. |
| 3:50–4:30 | — | Benefícios: cidadão não precisa conhecer o governo; GDF recebe padronizado sem trocar de sistema; protocolo e status; **o cidadão confirma se foi resolvido**; LGPD. |
| 4:30–5:00 | — | Viabilidade: IA testada em 48 casos (ver números abaixo); tecnologias gratuitas; modelo igual ao Fala.BR (CGU). "A IA só sugere; quem decide é o governo." |

**Ao abrir denúncias da turma no telão:** dê uma olhada antes. O relato nunca aparece nas páginas públicas, mas o
simulador mostra o texto inteiro.

## Roteiro — só você (cenário 3)

Igual, sem o passo do QR (1:20–1:40 vira "Como surgiu a ideia"). Na demonstração, use uma denúncia já existente
para mostrar o ciclo: no Simulador há denúncias em cada etapa (Enviada, Em análise, Encaminhada, Em execução,
Resolvida, Não procedente). Faça a sua ao vivo e leve-a até **Resolvida**; depois entre como a cidadã
(`cidada@vozdf.example`, mesma senha do operador) numa aba anônima para mostrar o "Foi mesmo resolvido?".

## Números para a fala

Medidos neste notebook em 29/09/2026 (`npm run eval:classificador -- qwen3.5:4b`, 48 casos fictícios):

- Acerto da IA: **93,8%** (45 de 48; 97,9% considerando as 3 sugestões) — palavras-chave sozinhas: **58,3%**.
- Tempo por análise: **~1,2 s** no modelo, **~1,4 s** do clique até a sugestão aparecer no celular. Com 8 celulares
  ao mesmo tempo, cada um espera mais (fila na placa de vídeo), todos respondidos pela IA.
- O painel do Simulador mostra "acerto da IA segundo o GDF" das denúncias **fictícias** da demo (~100% em 13):
  para a fala, use o 93,8% da avaliação — é o número medido.

## Se der errado

| Sintoma | O que fazer |
|---|---|
| Terminal: `IA local INDISPONÍVEL` | Fechar e abrir o Ollama (ícone perto do relógio) e rodar `npm run demo` de novo. Se for CUDA (depois de suspender o notebook): **Win+Ctrl+Shift+B**. Sem tempo? Siga: o app usa palavras-chave e continua funcionando — vira argumento: "se a IA cair, o sistema não para". |
| `Túnel indisponível` | Trocar a internet do notebook (4G ↔ Wi-Fi) e rodar de novo. Senão, QR "Mesma rede" ou cenário 3. |
| QR "Mesma rede" não abre no celular | A rede isola os aparelhos, ou o firewall barrou o Node: cenário 3. |
| `O app não respondeu. O Docker (Postgres) está de pé?` | Abrir o Docker Desktop, esperar, `docker compose up -d`, rodar de novo. |
| Colegas veem "Muitas tentativas" | Não deveria (limites ×20 na demo). Se acontecer, siga com os que conseguiram. |
| Precisa aplicar uma correção de código com a demo no ar | Parar só o app (Ctrl+C na demo; o `cloudflared` separado pode seguir), `npm run demo:compilar` (não apaga o banco) e `npm run demo -- --tunel=<endereço atual>` (mantém o mesmo QR). |
| Mapa sem imagem de fundo | Internet fraca: tocar no mapa ainda marca o ponto, e a RA pode ser escolhida na lista. |

## Depois

Ctrl+C no terminal. As contas e denúncias da turma ficam só no banco `vozdf_demo` deste notebook; para apagar
(LGPD), rode `npm run demo:preparar` (recria vazio + fictícios) ou apague o banco `vozdf_demo`.
