# UC 6 — Atividade Prática: Identificando Problemas da Comunidade e Criando Soluções Tecnológicas

**Turma:** 2026.07.77 · **Instrutor:** Prof. Esp. José Nilton dos Santos · **Data:** 23/09/2026
**Solução proposta:** **Voz DF — Rede Central de Denúncias do Distrito Federal** *(nome provisório)*
**Problema escolhido:** nº 18 da lista — *Ausência de canais eficientes para denúncias e solicitações à administração pública* (abrange também os problemas 1, 3, 4, 5, 6, 9, 10, 11, 12 e 16 como **categorias** de denúncia).

---

## Etapa 1 — Ficha de Investigação

**1. Qual problema foi escolhido?**
A falta de um canal único, simples e transparente para o cidadão denunciar problemas urbanos e acompanhar se algo foi feito. Hoje a demanda se perde entre vários órgãos e o morador não sabe a quem recorrer.

**2. Onde esse problema acontece?**
Em todo o Distrito Federal, nas **35 Regiões Administrativas** (Plano Piloto, Ceilândia, Taguatinga, Samambaia, Sol Nascente/Pôr do Sol, Arapoanga, Água Quente etc.), com mais impacto nas RAs periféricas e de crescimento recente.

**3. Quem é afetado?**
- Moradores, trabalhadores e comerciantes de todas as RAs;
- Pessoas com deficiência, idosos e quem depende de transporte público;
- Os próprios gestores públicos (Administrações Regionais e secretarias), que não têm uma visão consolidada dos problemas para priorizar recursos.

**4. Quais são as principais causas?**
- Muitos canais separados (cada órgão com o seu), sem integração;
- O cidadão não sabe qual órgão é responsável por cada tipo de problema (lixo, poste, buraco, esgoto…);
- Falta de retorno: a pessoa denuncia e não fica sabendo o resultado, então desiste;
- Dados espalhados, sem mapa nem estatística por região para orientar decisões.

**5. Quais são as consequências para a comunidade?**
- Problemas se acumulam e se agravam (lixo vira foco de dengue, buraco vira acidente, rua escura vira ponto de insegurança);
- Denúncias repetidas sobre o mesmo problema, gerando retrabalho;
- Desconfiança no poder público e baixa participação da população;
- Recursos públicos aplicados sem base em dados reais.

**6. O que já é feito para tentar resolver essa situação?**
- O GDF tem a **Ouvidoria-Geral** com o portal **Participa DF** e a **Central 162**, onde se registram reclamações, denúncias, sugestões, elogios e pedidos de informação;
- Cada Administração Regional e vários órgãos têm ouvidoria própria;
- Emergências seguem pelos números 190 (PMDF) e 193 (CBMDF).

**7. O que ainda poderia ser melhorado?**
- Registro em poucos toques: o cidadão **descreve o problema com as próprias palavras**, com foto e localização no mapa, sem precisar saber qual órgão acionar;
- Uma **IA que sugere** a categoria e o órgão responsável (quem decide continua sendo o governo);
- **Mapa público** dos problemas (sem dados pessoais) e acompanhamento por número de protocolo;
- Agrupamento de denúncias repetidas do mesmo local, mostrando "apoios" da comunidade;
- **Entrega padronizada ao GDF**: cada denúncia chega ao sistema do governo como um pacote de dados (JSON via API), já organizada por RA e categoria e com a sugestão de órgão, e o status volta para o cidadão.

---

## Etapa 2 — Brainstorming (12 ideias)

| # | Ideia | Observação |
|---|-------|------------|
| 1 | **Web app/app de denúncias com foto e GPS, dividido por RA e categoria** | ✅ **Escolhida** |
| 2 | Painel de gestão (dashboard) para o GDF priorizar e decidir ações | Substituída por **integração via API**: o GDF recebe os dados no próprio sistema e decide |
| 3 | Mapa colaborativo público com os problemas e seu status | Parte da escolhida |
| 4 | Chatbot no WhatsApp para registrar denúncia conversando | Fase futura |
| 5 | QR Codes em postes, paradas e praças para denunciar aquele ponto | Fase futura |
| 6 | Notificações automáticas quando a denúncia muda de status | Parte da escolhida |
| 7 | "Apoiar" denúncia existente (evita duplicadas e mostra urgência) | Parte da escolhida |
| 8 | IA para sugerir a categoria a partir da foto/texto | ✅ **Parte da escolhida** (texto): a IA sugere, o cidadão confirma e o GDF decide |
| 9 | Sensores de nível em bueiros para alertar alagamento | Caro; fora do escopo |
| 10 | Portal de transparência com ranking de resolução por RA | Parte da escolhida |
| 11 | Alertas para a população (ex.: área alagada, via interditada) | Fase futura |
| 12 | Gamificação: selo de "cidadão ativo" por denúncias válidas | Avaliar riscos de abuso |

**Proposta mais viável:** a ideia 1 combinada com 3, 6, 8 e a integração via API (no lugar da ideia 2) — funciona com tecnologia acessível (celular + internet), não exige equipamento novo, não obriga o governo a trocar de sistema e começa como site, podendo virar aplicativo depois.

---

## Etapa 3 — Planejamento da Solução

| Item | Resposta |
|------|----------|
| **Nome da solução** | Voz DF — Rede Central de Denúncias do Distrito Federal |
| **Problema que será resolvido** | Falta de um canal único e simples para o cidadão denunciar problemas urbanos sem precisar saber qual órgão é responsável, e dificuldade do GDF em receber essas demandas de forma organizada. |
| **Público beneficiado** | Moradores das 35 RAs do DF e o GDF (Ouvidoria, Administrações Regionais e órgãos executores), que passa a receber as denúncias já organizadas. |
| **Como a tecnologia irá funcionar?** | 1) O cidadão abre o site e **descreve o problema com as próprias palavras** (ex.: "o poste da minha rua está apagado"), anexa foto e marca o **local no mapa** com a RA. 2) Uma **IA sugere a categoria** (ex.: Iluminação pública) e o **órgão provável** (ex.: CEB-IPES); o cidadão confirma ou troca com um toque. 3) Recebe um **número de protocolo** (ex.: `DF-2026-000123`). 4) O Voz DF **envia a denúncia ao GDF em formato JSON** (uma API): descrição, categoria, local, RA, fotos e a sugestão da IA, **sem dados pessoais** do denunciante. 5) **O GDF decide** o órgão responsável e informa cada mudança de status de volta ao Voz DF. 6) O cidadão acompanha pelo protocolo até a resolução. |
| **Quais recursos tecnológicos serão utilizados?** | Site responsivo (Next.js/React + TypeScript), banco de dados (SQLite no protótipo, PostgreSQL em produção), mapa com OpenStreetMap/Leaflet, **IA local** (modelo de linguagem Qwen 3.5 rodando no próprio servidor via Ollama, sem custo e sem enviar o texto a empresas externas), **API REST com JSON** para a integração com o GDF, login seguro. Fase 2: PWA (instalável). Fase 3: aplicativo Android/iOS (React Native/Expo). |
| **Quem utilizará a solução?** | **Cidadão** (registra e acompanha, com ou sem login — denúncia anônima é permitida) e o **sistema do GDF** (recebe as denúncias pela API e devolve o status). No protótipo, um **Simulador do GDF** faz o papel do governo. |
| **Quais benefícios serão gerados?** | O cidadão não precisa conhecer a estrutura do governo; denúncias chegam ao GDF padronizadas e com uma sugestão de órgão, reduzindo o tempo de triagem; o governo **não precisa trocar de sistema**, só receber os dados; transparência com protocolo e status; proteção de dados (o GDF recebe a denúncia sem dados pessoais). |
| **Quais desafios existirão para sua implementação?** | O GDF **ainda não disponibiliza uma API pública** para receber manifestações (pesquisa de 23/09/2026) — a integração real dependeria dele abrir uma API ou aderir à API do **Fala.BR** (CGU), que já segue esse modelo; a IA erra às vezes (por isso só sugere); proteção de dados (**LGPD**); denúncias falsas ou ofensivas; inclusão de quem tem pouco acesso à internet; custo de manter um servidor com IA. |

**Viabilidade da IA (testada):** em 48 denúncias fictícias escritas em linguagem do dia a dia, a IA local acertou a categoria em **93,8%** dos casos (97,9% considerando as 3 sugestões mostradas), respondendo em cerca de **1,3 segundo** num notebook comum com placa de vídeo. Uma regra simples por palavras-chave acertou 58,3%. Sem a IA disponível, o sistema usa essas palavras-chave e continua funcionando.

---

## Etapa 4 — Protótipo (telas)

O protótipo será o próprio site em desenvolvimento, com dados fictícios. Telas previstas:

**Área do cidadão**
1. **Tela inicial** — botão "Fazer denúncia", campo "Acompanhar protocolo", mapa público das denúncias e aviso de emergência (190/193).
2. **Cadastro/Login** — nome, e-mail, senha; opção "denunciar sem me identificar".
3. **Nova denúncia (passo a passo)** — ① "O que está acontecendo?" (texto livre + foto) → ② **Sugestão da IA**: categoria e órgão provável, com botão para confirmar ou trocar → ③ Local no mapa + RA → ④ Revisar e enviar.
4. **Confirmação** — número de protocolo (ex.: `DF-2026-000123`) e aviso de que a denúncia foi enviada ao GDF.
5. **Acompanhar / Minhas denúncias** — status: Recebida → Enviada ao GDF → Em análise → Encaminhada ao órgão → Em execução → Resolvida.

**Simulador do GDF (só para a demonstração)**
6. **Denúncias recebidas** — lista do que chegou pela API, com o JSON recebido e a sugestão da IA em destaque.
7. **Decisão** — o "GDF" aceita ou troca o órgão sugerido e atualiza o status (em análise, encaminhada, em execução, resolvida, não procedente); cada ação volta automaticamente para o cidadão.
8. **Visão geral** — totais por RA, categoria e status.

**Resultado esperado:** o cidadão denuncia em menos de 2 minutos sem precisar saber quem é o responsável; o GDF recebe tudo padronizado, com uma sugestão de órgão, e decide.

---

## Etapa 5 — Roteiro da Apresentação (≈5 min)

| Tempo | Tópico | Fala-chave |
|-------|--------|------------|
| 0:00–0:40 | **Qual problema escolhemos?** | "Quem aqui já viu um poste apagado ou lixo acumulado e não soube para quem reclamar?" — o problema é a falta de um canal eficiente de denúncias. |
| 0:40–1:20 | **Por que é importante?** | Problemas pequenos viram grandes (dengue, acidentes, insegurança). Sem retorno, a população desiste; sem dados, o governo prioriza no escuro. |
| 1:20–1:50 | **Como surgiu a ideia?** | Da experiência do grupo nas nossas RAs: ninguém sabe se buraco é com a Novacap ou com a Administração. Por isso o cidadão só descreve, e uma IA ajuda a descobrir o responsável. |
| 1:50–3:10 | **Como a solução funciona?** | Demonstração: escrever "o poste da minha rua está apagado" → a IA sugere *Iluminação pública / CEB-IPES* → confirmar, marcar no mapa → protocolo. No Simulador do GDF, a denúncia chega como JSON; o "GDF" encaminha e resolve; o cidadão vê "Resolvida" pelo protocolo. |
| 3:10–3:50 | **Tecnologias usadas** | Site responsivo, banco de dados, mapa (OpenStreetMap), **IA local** (Qwen 3.5 via Ollama, sem custo e sem mandar dados para fora) e **API com JSON** para o GDF; depois vira aplicativo. |
| 3:50–4:30 | **Benefícios** | Cidadão não precisa conhecer o governo; GDF recebe tudo padronizado, com sugestão de órgão, sem trocar de sistema; transparência pelo protocolo; LGPD (o GDF não recebe dados pessoais). |
| 4:30–5:00 | **É viável? Por quê?** | Sim: testamos a IA — **93,8% de acerto** em 48 casos, ~1 segundo por denúncia, num notebook comum. Tecnologias gratuitas/abertas. O GDF ainda não tem API pública, mas o governo federal já usa esse modelo (**Fala.BR**, da CGU), então a integração é realista. **A IA só sugere; quem decide é o governo.** |

---

### Fontes consultadas
- Ouvidoria-Geral do DF — Canais de atendimento: https://www.ouvidoria.df.gov.br/canais-de-atendimento/
- Ouvidoria-Geral do DF — Canal 162: https://ouvidoria.df.gov.br/canal-atendimento-162/
- SEDUH — Criação das RAs Arapoanga e Água Quente: https://www.seduh.df.gov.br/w/aprovada-a-criacao-das-regioes-administrativas-de-arapoanga-e-agua-quente
- Regiões administrativas do DF (lista das 35 RAs): https://en.wikipedia.org/wiki/Administrative_regions_of_the_Federal_District_(Brazil)
- Participa DF — o que é a Ouvidoria: https://www.participa.df.gov.br/static/o-que-e-ouvidoria
- Fala.BR (CGU) — API de integração: https://falabr.cgu.gov.br/help e https://wiki.cgu.gov.br/index.php?title=Fala.BR_-_API_Faq
- Open311 GeoReport v2 (padrão aberto de reporte urbano): https://wiki.open311.org/GeoReport_v2/
- Ollama — saídas estruturadas (JSON Schema): https://docs.ollama.com/capabilities/structured-outputs
