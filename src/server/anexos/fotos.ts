// Upload de fotos: valida o tipo REAL (magic bytes) e o tamanho, recodifica para JPEG sem nenhum
// metadado (EXIF/GPS/XMP) e salva com nome aleatório fora de src/. Ver CLAUDE.md §Segurança.
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import sharp from "sharp";
import { ErroDominio } from "../erros";

export const MAX_FOTOS = 3;
const LADO_MAXIMO = 1920;
// Barra "bombas de descompressão" (imagem pequena em bytes que explode em pixels).
const MAX_PIXELS_ENTRADA = 50_000_000;

type TipoImagem = "jpeg" | "png" | "webp";

export function detectarTipoImagem(bytes: Uint8Array): TipoImagem | null {
  const b = bytes;
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b[i] === v)) return "png";
  const ascii = (ini: number, fim: number) => String.fromCharCode(...b.subarray(ini, fim));
  if (b.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "webp";
  return null;
}

export type FotoSalva = { token: string; caminho: string; mime: string; tamanho: number };

export async function processarFoto(entrada: Uint8Array, maxBytes: number): Promise<Buffer> {
  if (entrada.byteLength > maxBytes) {
    throw new ErroDominio("FOTO_GRANDE", `Cada foto pode ter no máximo ${Math.round(maxBytes / 1024 / 1024)} MB.`, 422);
  }
  if (!detectarTipoImagem(entrada)) {
    throw new ErroDominio("FOTO_TIPO_INVALIDO", "Envie fotos em JPEG, PNG ou WebP.", 422);
  }
  try {
    return await sharp(entrada, { limitInputPixels: MAX_PIXELS_ENTRADA, failOn: "error" })
      .rotate() // aplica a orientação do EXIF antes de descartá-lo
      .resize({ width: LADO_MAXIMO, height: LADO_MAXIMO, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true }) // sem .withMetadata(): o sharp não copia metadados
      .toBuffer();
  } catch {
    throw new ErroDominio("FOTO_INVALIDA", "Não foi possível ler a imagem enviada.", 422);
  }
}

export async function salvarFotos(arquivos: File[], opcoes: { uploadDir: string; maxBytes: number }): Promise<FotoSalva[]> {
  if (arquivos.length > MAX_FOTOS) {
    throw new ErroDominio("FOTOS_DEMAIS", `Envie no máximo ${MAX_FOTOS} fotos.`, 422);
  }
  // Processa todas antes de gravar qualquer uma: uma foto inválida não deixa arquivo órfão.
  const processadas = await Promise.all(
    arquivos.map(async (f) => processarFoto(new Uint8Array(await f.arrayBuffer()), opcoes.maxBytes)),
  );
  await mkdir(opcoes.uploadDir, { recursive: true });
  const salvas: FotoSalva[] = [];
  for (const buffer of processadas) {
    const caminho = `${randomUUID()}.jpg`;
    await writeFile(join(opcoes.uploadDir, caminho), buffer, { flag: "wx" });
    salvas.push({ token: randomBytes(24).toString("base64url"), caminho, mime: "image/jpeg", tamanho: buffer.byteLength });
  }
  return salvas;
}

/** Caminho absoluto do arquivo; basename() impede path traversal mesmo se o banco for adulterado. */
export function caminhoDaFoto(uploadDir: string, caminho: string): string {
  return join(resolve(uploadDir), basename(caminho));
}

export async function removerFotos(uploadDir: string, fotos: Pick<FotoSalva, "caminho">[]) {
  await Promise.all(fotos.map((f) => rm(caminhoDaFoto(uploadDir, f.caminho), { force: true })));
}
