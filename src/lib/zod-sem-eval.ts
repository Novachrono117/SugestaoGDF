// Importar ANTES de qualquer schema usado no navegador. O Zod 4 testa `new Function("")` para decidir se
// usa o parser otimizado; com a nossa CSP (sem 'unsafe-eval', src/proxy.ts) o teste falha em silêncio,
// mas gera uma violação de CSP a cada página. jitless: usa direto o parser comum, sem a sondagem.
import { z } from "zod";

z.config({ jitless: true });
