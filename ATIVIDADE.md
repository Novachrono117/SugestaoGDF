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
- Registro em poucos toques, com **foto e localização no mapa**, sem o cidadão precisar saber qual órgão acionar;
- **Encaminhamento automático** por categoria e RA;
- **Mapa público** dos problemas (sem dados pessoais) e acompanhamento por número de protocolo;
- Agrupamento de denúncias repetidas do mesmo local, mostrando "apoios" da comunidade;
- **Painel de gestão** para o GDF ver tudo unificado, priorizar e registrar as ações tomadas.

---

## Etapa 2 — Brainstorming (12 ideias)

| # | Ideia | Observação |
|---|-------|------------|
| 1 | **Web app/app de denúncias com foto e GPS, dividido por RA e categoria** | ✅ **Escolhida** |
| 2 | Painel de gestão (dashboard) para o GDF priorizar e decidir ações | Parte da escolhida |
| 3 | Mapa colaborativo público com os problemas e seu status | Parte da escolhida |
| 4 | Chatbot no WhatsApp para registrar denúncia conversando | Fase futura |
| 5 | QR Codes em postes, paradas e praças para denunciar aquele ponto | Fase futura |
| 6 | Notificações automáticas quando a denúncia muda de status | Parte da escolhida |
| 7 | "Apoiar" denúncia existente (evita duplicadas e mostra urgência) | Parte da escolhida |
| 8 | IA para sugerir a categoria a partir da foto/texto | Fase futura, com revisão humana |
| 9 | Sensores de nível em bueiros para alertar alagamento | Caro; fora do escopo |
| 10 | Portal de transparência com ranking de resolução por RA | Parte da escolhida |
| 11 | Alertas para a população (ex.: área alagada, via interditada) | Fase futura |
| 12 | Gamificação: selo de "cidadão ativo" por denúncias válidas | Avaliar riscos de abuso |

**Proposta mais viável:** a ideia 1 combinada com 2, 3, 6, 7 e 10 — funciona com tecnologia acessível (celular + internet), não exige equipamento novo e começa como site, podendo virar aplicativo depois.

---

## Etapa 3 — Planejamento da Solução

| Item | Resposta |
|------|----------|
| **Nome da solução** | Voz DF — Rede Central de Denúncias do Distrito Federal |
| **Problema que será resolvido** | Falta de um canal único e eficiente para denúncias e solicitações ao GDF, e falta de visão unificada para o governo decidir as ações. |
| **Público beneficiado** | Moradores das 35 RAs do DF e os gestores do GDF (Administrações Regionais, secretarias e órgãos executores). |
| **Como a tecnologia irá funcionar?** | 1) O cidadão abre o site, escolhe a **categoria** (ex.: iluminação), marca o **local no mapa** (a RA é identificada), escreve uma descrição e anexa foto. 2) Recebe um **número de protocolo**. 3) O sistema **encaminha** a denúncia ao órgão responsável e à Administração da RA. 4) O gestor vê tudo no **painel** (filtros por RA, categoria, status, mapa de calor), define prioridade, encaminha e registra a ação. 5) O cidadão acompanha o status e é notificado até a resolução. |
| **Quais recursos tecnológicos serão utilizados?** | Site responsivo (Next.js/React + TypeScript), banco de dados PostgreSQL, mapa com OpenStreetMap/Leaflet, geolocalização do celular, armazenamento de fotos em nuvem, login seguro, e-mail/notificações. Fase 2: PWA (instalável). Fase 3: aplicativo Android/iOS (React Native/Expo). |
| **Quem utilizará a solução?** | **Cidadão** (registra e acompanha), **Gestor da RA** (vê as denúncias da sua região), **Órgão executor** (vê o que é de sua responsabilidade), **Administrador GDF** (visão geral e relatórios). |
| **Quais benefícios serão gerados?** | Canal único e fácil; menos denúncias perdidas ou duplicadas; transparência e prestação de contas; dados por região para o GDF priorizar investimentos; mais confiança e participação da população. |
| **Quais desafios existirão para sua implementação?** | Integração com os sistemas já existentes (Participa DF/162); adesão dos órgãos; proteção de dados pessoais (**LGPD**) e opção de denúncia anônima; denúncias falsas ou ofensivas (moderação); inclusão de quem tem pouco acesso à internet; custo de hospedagem e manutenção; capacidade de resposta dos órgãos. |

---

## Etapa 4 — Protótipo (telas)

O protótipo será o próprio site em desenvolvimento, com dados fictícios. Telas previstas:

**Área do cidadão**
1. **Tela inicial** — botão "Fazer denúncia", campo "Acompanhar protocolo", mapa público da minha RA e aviso de emergência (190/193).
2. **Cadastro/Login** — nome, e-mail/CPF, senha; opção "denunciar sem me identificar" (com aviso de que não receberá notificações).
3. **Nova denúncia (passo a passo)** — ① Categoria → ② Local no mapa (RA detectada automaticamente) → ③ Descrição + foto → ④ Revisar e enviar.
4. **Confirmação** — número de protocolo (ex.: `DF-2026-000123`) e prazo estimado.
5. **Minhas denúncias** — lista com status: Recebida → Em triagem → Encaminhada → Em execução → Resolvida.

**Painel do GDF**
6. **Visão geral** — totais por status, por RA e por categoria; mapa de calor.
7. **Fila de denúncias** — filtros (RA, categoria, status, prioridade, data); denúncias semelhantes agrupadas.
8. **Detalhe da denúncia** — fotos, local, histórico; ações: definir prioridade, encaminhar ao órgão, registrar providência, marcar como resolvida/não procedente/duplicada.
9. **Relatórios** — tempo médio de resolução por RA e por órgão; exportação.

**Resultado esperado:** o cidadão denuncia em menos de 2 minutos e acompanha a solução; o GDF enxerga todas as demandas em um só lugar e decide com base em dados.

---

## Etapa 5 — Roteiro da Apresentação (≈5 min)

| Tempo | Tópico | Fala-chave |
|-------|--------|------------|
| 0:00–0:40 | **Qual problema escolhemos?** | "Quem aqui já viu um poste apagado ou lixo acumulado e não soube para quem reclamar?" — o problema é a falta de um canal eficiente de denúncias. |
| 0:40–1:20 | **Por que é importante?** | Problemas pequenos viram grandes (dengue, acidentes, insegurança). Sem retorno, a população desiste; sem dados, o governo prioriza no escuro. |
| 1:20–1:50 | **Como surgiu a ideia?** | Da experiência do grupo nas nossas RAs e do brainstorming: juntamos denúncia + mapa + painel de gestão em uma ideia só. |
| 1:50–3:10 | **Como a solução funciona?** | Demonstração: fazer uma denúncia (categoria → mapa → foto → protocolo) e ver ela chegar no painel do GDF, filtrada por RA. |
| 3:10–3:50 | **Tecnologias usadas** | Site responsivo, banco de dados, mapa (OpenStreetMap), geolocalização, fotos na nuvem; depois vira aplicativo. |
| 3:50–4:30 | **Benefícios** | Canal único, transparência, menos retrabalho, decisões baseadas em dados por região. |
| 4:30–5:00 | **É viável? Por quê?** | Sim: usa o celular que a população já tem, tecnologias gratuitas/abertas, começa pequeno (algumas categorias e RAs) e pode se integrar aos canais que o GDF já possui (Participa DF/162). |

---

### Fontes consultadas
- Ouvidoria-Geral do DF — Canais de atendimento: https://www.ouvidoria.df.gov.br/canais-de-atendimento/
- Ouvidoria-Geral do DF — Canal 162: https://ouvidoria.df.gov.br/canal-atendimento-162/
- SEDUH — Criação das RAs Arapoanga e Água Quente: https://www.seduh.df.gov.br/w/aprovada-a-criacao-das-regioes-administrativas-de-arapoanga-e-agua-quente
- Regiões administrativas do DF (lista das 35 RAs): https://en.wikipedia.org/wiki/Administrative_regions_of_the_Federal_District_(Brazil)
