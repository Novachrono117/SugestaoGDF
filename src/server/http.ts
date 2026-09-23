// Utilitários dos route handlers: formato de erro padrão e autenticação por chave de API.
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { ErroDominio } from "./erros";

export function erroJson(status: number, code: string, message: string): Response {
  return Response.json({ error: { code, message } }, { status });
}

/** Converte qualquer erro em resposta `{ error: { code, message } }`, sem stack trace. */
export function respostaDeErro(erro: unknown): Response {
  if (erro instanceof ErroDominio) return erroJson(erro.status, erro.code, erro.message);
  if (erro instanceof z.ZodError) {
    const detalhe = erro.issues.map((i) => `${i.path.join(".") || "(corpo)"}: ${i.message}`).join("; ");
    return erroJson(422, "DADOS_INVALIDOS", detalhe);
  }
  if (erro instanceof SyntaxError) return erroJson(400, "JSON_INVALIDO", "Corpo da requisição não é JSON válido.");
  console.error("[api] erro inesperado:", erro instanceof Error ? erro.name : "desconhecido");
  return erroJson(500, "ERRO_INTERNO", "Erro interno. Tente novamente.");
}

/** Compara `Authorization: Bearer <chave>` em tempo constante. */
export function chaveValida(request: Request, esperada: string): boolean {
  const header = request.headers.get("authorization") ?? "";
  const recebida = header.startsWith("Bearer ") ? header.slice(7) : "";
  const a = Buffer.from(recebida);
  const b = Buffer.from(esperada);
  return a.length === b.length && timingSafeEqual(a, b);
}
