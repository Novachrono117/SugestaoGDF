// Serve uma foto pelo token aleatório (o caminho em disco nunca é exposto). Fotos já sem EXIF.
import { readFile } from "node:fs/promises";
import type { NextRequest } from "next/server";
import { caminhoDaFoto } from "@/server/anexos/fotos";
import { db } from "@/server/db";
import { serverEnv } from "@/server/env";
import { erroJson } from "@/server/http";

export async function GET(_request: NextRequest, ctx: RouteContext<"/api/v1/anexos/[token]">) {
  const { token } = await ctx.params;
  if (!/^[\w-]{32}$/.test(token)) return erroJson(404, "NAO_ENCONTRADO", "Foto não encontrada.");

  const anexo = await db.anexo.findUnique({ where: { token }, select: { caminho: true, mime: true } });
  if (!anexo) return erroJson(404, "NAO_ENCONTRADO", "Foto não encontrada.");

  try {
    const arquivo = await readFile(caminhoDaFoto(serverEnv().UPLOAD_DIR, anexo.caminho));
    return new Response(new Uint8Array(arquivo), {
      headers: {
        "Content-Type": anexo.mime,
        "Content-Disposition": "inline",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return erroJson(404, "NAO_ENCONTRADO", "Foto não encontrada.");
  }
}
