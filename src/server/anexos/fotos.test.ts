import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { caminhoDaFoto, detectarTipoImagem, processarFoto, salvarFotos } from "./fotos";

const MB = 1024 * 1024;

async function jpegComGps(): Promise<Buffer> {
  return sharp({ create: { width: 64, height: 48, channels: 3, background: "#3366cc" } })
    .jpeg()
    .withExif({
      IFD0: { Make: "CelularTeste", Artist: "Fulano de Tal" },
      IFD3: { GPSLatitudeRef: "S", GPSLatitude: "15/1 49/1 0/1", GPSLongitudeRef: "W", GPSLongitude: "48/1 6/1 0/1" },
    })
    .toBuffer();
}

let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "vozdf-fotos-"));
});
afterAll(() => rm(dir, { recursive: true, force: true }));

describe("detectarTipoImagem", () => {
  it("reconhece pelos bytes, não pela extensão", async () => {
    expect(detectarTipoImagem(await jpegComGps())).toBe("jpeg");
    expect(detectarTipoImagem(await sharp({ create: { width: 2, height: 2, channels: 3, background: "#fff" } }).png().toBuffer())).toBe("png");
    expect(detectarTipoImagem(await sharp({ create: { width: 2, height: 2, channels: 3, background: "#fff" } }).webp().toBuffer())).toBe("webp");
    expect(detectarTipoImagem(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
  });
});

describe("processarFoto", () => {
  it("remove EXIF, inclusive GPS", async () => {
    const original = await jpegComGps();
    const antes = await sharp(original).metadata();
    expect(antes.exif).toBeDefined(); // o arquivo de teste realmente tem EXIF

    const limpa = await processarFoto(original, 5 * MB);
    const depois = await sharp(limpa).metadata();
    expect(depois.format).toBe("jpeg");
    expect(depois.exif).toBeUndefined();
    expect(depois.xmp).toBeUndefined();
    expect(limpa.includes(Buffer.from("Fulano de Tal"))).toBe(false);
  });

  it("reduz imagens grandes para no máximo 1920 px", async () => {
    const grande = await sharp({ create: { width: 4000, height: 3000, channels: 3, background: "#999" } }).jpeg().toBuffer();
    const meta = await sharp(await processarFoto(grande, 5 * MB)).metadata();
    expect(Math.max(meta.width!, meta.height!)).toBe(1920);
  });

  it("rejeita tipo falso, arquivo corrompido e tamanho acima do limite", async () => {
    await expect(processarFoto(new TextEncoder().encode("não sou imagem"), 5 * MB)).rejects.toMatchObject({
      code: "FOTO_TIPO_INVALIDO",
    });
    const pngQuebrado = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
    await expect(processarFoto(pngQuebrado, 5 * MB)).rejects.toMatchObject({ code: "FOTO_INVALIDA" });
    await expect(processarFoto(await jpegComGps(), 100)).rejects.toMatchObject({ code: "FOTO_GRANDE" });
  });
});

describe("salvarFotos", () => {
  it("salva com nome e token aleatórios", async () => {
    const f = new File([new Uint8Array(await jpegComGps())], "minha-casa.jpg", { type: "image/jpeg" });
    const [salva] = await salvarFotos([f], { uploadDir: dir, maxBytes: 5 * MB });
    expect(salva.caminho).toMatch(/^[0-9a-f-]{36}\.jpg$/);
    expect(salva.caminho).not.toContain("minha-casa");
    expect(salva.token).toMatch(/^[\w-]{32}$/);
    expect((await readFile(join(dir, salva.caminho))).byteLength).toBe(salva.tamanho);
  });

  it("não grava nada se uma das fotos for inválida", async () => {
    const antes = (await readdir(dir)).length;
    const boa = new File([new Uint8Array(await jpegComGps())], "a.jpg");
    const ruim = new File(["texto"], "b.jpg");
    await expect(salvarFotos([boa, ruim], { uploadDir: dir, maxBytes: 5 * MB })).rejects.toMatchObject({
      code: "FOTO_TIPO_INVALIDO",
    });
    expect((await readdir(dir)).length).toBe(antes);
  });

  it("limita a quantidade", async () => {
    const f = new File([new Uint8Array(await jpegComGps())], "a.jpg");
    await expect(salvarFotos([f, f, f, f], { uploadDir: dir, maxBytes: 5 * MB })).rejects.toMatchObject({
      code: "FOTOS_DEMAIS",
    });
  });
});

describe("caminhoDaFoto", () => {
  it("impede path traversal", () => {
    expect(caminhoDaFoto(dir, "../../etc/passwd")).toBe(join(resolve(dir), "passwd"));
    // "\" só é separador no Windows; em qualquer SO o resultado precisa ficar dentro da pasta.
    const r = relative(resolve(dir), caminhoDaFoto(dir, "..\\..\\segredo.txt"));
    expect(r.startsWith("..") || isAbsolute(r)).toBe(false);
  });
});
