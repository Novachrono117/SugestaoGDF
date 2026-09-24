import { afterAll, describe, expect, it } from "vitest";
import { cadastroSchema, loginSchema } from "@/lib/validation/auth";
import { criarBancoDeTeste } from "@/test/db";
import { criarRateLimiter } from "../rate-limit";
import { buscarUsuarioSessao, cadastrarCidadao, verificarCredenciais } from "./usuarios";

const banco = await criarBancoDeTeste();
afterAll(() => banco.fechar());

describe("cadastro e login", () => {
  const dados = cadastroSchema.parse({ nome: " Maria ", email: " Maria@Exemplo.Example ", senha: "senha-forte-1" });

  it("normaliza e-mail e cria sempre como CIDADAO, com senha em hash", async () => {
    const u = await cadastrarCidadao(banco.db, dados);
    expect(u).toMatchObject({ nome: "Maria", email: "maria@exemplo.example", papel: "CIDADAO" });
    const salvo = await banco.db.usuario.findUniqueOrThrow({ where: { id: u.id } });
    expect(salvo.senhaHash).not.toContain("senha-forte-1");
    expect(salvo.senhaHash).toMatch(/^\$2[aby]\$10\$/);
  });

  it("recusa e-mail duplicado", async () => {
    await expect(cadastrarCidadao(banco.db, dados)).rejects.toMatchObject({ code: "EMAIL_EM_USO", status: 409 });
  });

  it("autentica só com a senha certa", async () => {
    const login = loginSchema.parse({ email: "MARIA@exemplo.example", senha: "senha-forte-1" });
    const u = await verificarCredenciais(banco.db, login.email, login.senha);
    expect(u?.email).toBe("maria@exemplo.example");
    expect(await verificarCredenciais(banco.db, login.email, "errada")).toBeNull();
    expect(await verificarCredenciais(banco.db, "ninguem@exemplo.example", "senha-forte-1")).toBeNull();
  });

  it("busca o usuário da sessão sem expor o hash", async () => {
    const u = await verificarCredenciais(banco.db, "maria@exemplo.example", "senha-forte-1");
    const sessao = await buscarUsuarioSessao(banco.db, u!.id);
    expect(sessao).not.toHaveProperty("senhaHash");
  });

  it("valida senha curta e acima de 72 bytes", () => {
    expect(cadastroSchema.safeParse({ ...dados, senha: "curta" }).success).toBe(false);
    expect(cadastroSchema.safeParse({ ...dados, senha: "ç".repeat(37) }).success).toBe(false); // 74 bytes
  });
});

describe("criarRateLimiter", () => {
  it("bloqueia após o limite e libera na próxima janela", () => {
    let t = 0;
    const rl = criarRateLimiter({ limite: 2, janelaMs: 1000, agora: () => t });
    expect(rl.consumir("a").ok).toBe(true);
    expect(rl.consumir("a").ok).toBe(true);
    expect(rl.consumir("a")).toEqual({ ok: false, tentarNovamenteEmMs: 1000 });
    expect(rl.consumir("b").ok).toBe(true); // chaves independentes
    t = 1000;
    expect(rl.consumir("a").ok).toBe(true);
  });
});
