// Variáveis de ambiente do servidor, validadas na primeira leitura (falha cedo e com mensagem clara).
import { z } from "zod";

const envSchema = z.object({
  APP_URL: z.url(),
  GDF_WEBHOOK_URL: z.url(),
  GDF_WEBHOOK_KEY: z.string().min(32, "GDF_WEBHOOK_KEY deve ter pelo menos 32 caracteres"),
  GDF_CALLBACK_KEY: z.string().min(32, "GDF_CALLBACK_KEY deve ter pelo menos 32 caracteres"),
  GDF_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  UPLOAD_DIR: z.string().min(1).default("./uploads"),
  MAX_UPLOAD_MB: z.coerce.number().positive().max(20).default(5),
});

export type ServerEnv = z.infer<typeof envSchema>;

let cache: ServerEnv | undefined;

export function serverEnv(): ServerEnv {
  if (!cache) {
    const parsed = envSchema.safeParse(process.env);
    if (!parsed.success) {
      const campos = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      throw new Error(`Configuração inválida no .env — ${campos}`);
    }
    cache = parsed.data;
  }
  return cache;
}
