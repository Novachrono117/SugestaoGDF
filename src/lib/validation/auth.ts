import { z } from "zod";

const email = z.string().trim().toLowerCase().pipe(z.email("E-mail inválido."));

export const loginSchema = z.object({
  email,
  senha: z.string().min(1, "Informe a senha.").max(200),
});

export const cadastroSchema = z.object({
  nome: z.string().trim().min(2, "Informe seu nome.").max(100),
  email,
  // bcrypt só considera os primeiros 72 bytes; acima disso a senha seria truncada em silêncio.
  senha: z
    .string()
    .min(8, "A senha precisa ter pelo menos 8 caracteres.")
    .refine((s) => new TextEncoder().encode(s).length <= 72, "Senha muito longa (máx. 72 bytes)."),
});

export type Cadastro = z.infer<typeof cadastroSchema>;

// Consentimento (LGPD art. 7º, I) explícito no cadastro: a caixa precisa vir marcada.
export const aceitePrivacidadeSchema = z.literal("on", {
  error: "Para criar a conta, confirme que leu o aviso de privacidade.",
});
