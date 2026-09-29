// Limites de uso por processo (docs/ARQUITETURA.md §9).
import { criarRateLimiter } from "./rate-limit";

const MINUTO = 60_000;

/**
 * RATE_LIMIT_FATOR multiplica todos os limites (1–100; padrão 1). Para eventos em que muita gente
 * acessa pela mesma rede — a mesma saída de internet vira o mesmo IP (`npm run demo` usa 20).
 */
export function fatorDosLimites(valor = process.env.RATE_LIMIT_FATOR): number {
  const n = Number(valor);
  return Number.isInteger(n) && n >= 1 && n <= 100 ? n : 1;
}

export function criarLimites(fator = fatorDosLimites()) {
  const limite = (base: number, janelaMs: number) => criarRateLimiter({ limite: base * fator, janelaMs });
  return {
    // Por e-mail NÃO multiplica: cada pessoa tem o seu, e é a trava contra adivinhar a senha de alguém.
    loginPorEmail: criarRateLimiter({ limite: 5, janelaMs: 15 * MINUTO }),
    loginPorIp: limite(30, 15 * MINUTO),
    cadastroPorIp: limite(5, 60 * MINUTO),
    denunciaPorOrigem: limite(5, 60 * MINUTO),
    classificacaoPorIp: limite(30, 10 * MINUTO),
    apoioPorUsuario: limite(30, 60 * MINUTO),
  };
}

export const limites = criarLimites();
