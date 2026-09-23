import { describe, expect, it } from "vitest";
import { destinoSeguro } from "./destino-seguro";

describe("destinoSeguro", () => {
  it.each([
    ["/minhas-denuncias", "/minhas-denuncias"],
    ["/denunciar?passo=2", "/denunciar?passo=2"],
    ["//evil.example", "/"],
    ["/\\evil.example", "/"],
    ["/evil.example", "/evil.example"], // caminho interno comum continua válido
    ["https://evil.example", "/"],
    ["javascript:alert(1)", "/"],
    [undefined, "/"],
    [["/a"], "/"],
  ])("%s → %s", (entrada, esperado) => expect(destinoSeguro(entrada)).toBe(esperado));
});
