// Configuração do Auth.js (next-auth v5 beta): login por e-mail/senha, sessão JWT em cookie httpOnly.
// Autorização NÃO é feita aqui — ver src/server/auth/sessao.ts (DAL), que relê o usuário no banco.
import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { loginSchema } from "@/lib/validation/auth";
import { verificarCredenciais } from "@/server/auth/usuarios";
import { db } from "@/server/db";
import { limites } from "@/server/limites";
import { ipDoCliente } from "@/server/rate-limit";

class LimiteDeTentativas extends CredentialsSignin {
  code = "limite_tentativas";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  pages: { signIn: "/entrar" },
  providers: [
    Credentials({
      credentials: { email: {}, senha: {} },
      async authorize(credentials, request) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const { email, senha } = parsed.data;

        const ip = ipDoCliente(request.headers);
        if (!limites.loginPorIp.consumir(ip).ok || !limites.loginPorEmail.consumir(email).ok) {
          throw new LimiteDeTentativas();
        }
        return verificarCredenciais(db, email, senha);
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      // Só no login `user` vem preenchido; o token guarda apenas o id (o papel é relido do banco).
      if (user?.id) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
