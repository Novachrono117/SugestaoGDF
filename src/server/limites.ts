// Limites de uso por processo (docs/ARQUITETURA.md §9).
import { criarRateLimiter } from "./rate-limit";

const MINUTO = 60_000;

export const limites = {
  loginPorEmail: criarRateLimiter({ limite: 5, janelaMs: 15 * MINUTO }),
  loginPorIp: criarRateLimiter({ limite: 30, janelaMs: 15 * MINUTO }),
  cadastroPorIp: criarRateLimiter({ limite: 5, janelaMs: 60 * MINUTO }),
  denunciaPorOrigem: criarRateLimiter({ limite: 5, janelaMs: 60 * MINUTO }),
  classificacaoPorIp: criarRateLimiter({ limite: 30, janelaMs: 10 * MINUTO }),
};
