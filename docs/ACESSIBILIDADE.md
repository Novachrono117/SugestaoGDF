# Acessibilidade — Voz DF

Meta: **WCAG 2.1 nível AA** (referência também do eMAG, o modelo de acessibilidade do governo federal).

## O que é verificado automaticamente

`npm run test:e2e` roda `e2e/acessibilidade.spec.ts` (axe-core, regras `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`) no viewport de celular:

- Páginas públicas: início, entrar (inclusive com erro), cadastro, acompanhar, consulta por protocolo, mapa, transparência e a página offline do PWA.
- Assistente de denúncia: os 4 passos, **percorridos só com teclado** (inclusive marcar o local no mapa).
- Área logada: minhas denúncias, minha conta, detalhe do autor; simulador (lista e decisão).
- Link "Pular para o conteúdo" (primeiro Tab da página).
- **Reflow (1.4.10):** nenhuma tela principal rola na horizontal a 320 px de largura (≈ zoom de 400%).

Ferramentas automáticas acham só parte dos problemas (estimativa comum: 30–50%). O restante está na lista manual abaixo.

## Corrigido na auditoria (25/09/2026)

| Problema | Critério | Correção |
|---|---|---|
| Local da denúncia só podia ser marcado com clique/toque no mapa (sem GPS, quem usa teclado ou leitor de tela não conseguia enviar) | 2.1.1 Teclado (A) | Botão "Marcar o centro do mapa" + mira visível quando o mapa está em foco; setas movem o mapa (teclado nativo do Leaflet); instrução no texto do passo |
| Ao trocar de passo no assistente, o foco ficava no botão antigo (leitor de tela não anunciava o passo novo) | 2.4.3 Ordem do foco (A) / 4.1.3 | Foco vai para o título oculto "Passo X de 4: …" |
| Até 8 links no cabeçalho antes do conteúdo em toda página | 2.4.1 Pular blocos (A) | Link "Pular para o conteúdo", visível ao receber foco |
| Tabelas da transparência rolavam na horizontal no celular sem acesso pelo teclado | 2.1.1 (axe `scrollable-region-focusable`) | Região rolável focável e rotulada |
| Mapa público só com marcadores visuais (28/09/2026) | 1.1.1 Conteúdo não textual (A) | "Ver as N denúncias em lista" abaixo do mapa: tabela com protocolo (link), categoria, região, situação, data e apoios, com os mesmos filtros; funciona sem JavaScript |

Já existia desde a Fase 1: `lang="pt-BR"`, títulos de página distintos, labels associados a todos os campos, erros com `role="alert"`, avisos com `aria-live`, foco visível nos botões, alvos de toque ≥ 44 px nos botões principais, status sempre com texto (não só cor), fotos com texto alternativo.

## Verificação manual (antes da apresentação)

Não automatizável; **ainda não executada** com tecnologia assistiva real:

- [ ] **NVDA** (Windows, gratuito) no Edge/Chrome: fazer uma denúncia do início ao fim e acompanhar pelo protocolo.
- [ ] **TalkBack** (Android): o mesmo fluxo no celular, incluindo a câmera.
- [ ] Zoom de 200% no navegador do computador: textos e botões legíveis, nada cortado.
- [ ] Preferência de fonte grande do sistema no celular.

## Limitações conhecidas

- **Blocos do mapa (OpenStreetMap):** imagens de terceiros, sem descrição; o local marcado é anunciado em texto ("Local marcado: …").
