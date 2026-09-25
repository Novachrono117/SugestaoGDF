import { describe, expect, it } from "vitest";
import { criarRateLimiter, ipDoCliente } from "./rate-limit";

describe("ipDoCliente", () => {
  it("usa o IP acrescentado pelo proxy (último), não o que o cliente mandou", () => {
    // Cliente forjou "1.1.1.1"; o proxy acrescentou o IP real da conexão.
    expect(ipDoCliente(new Headers({ "x-forwarded-for": "1.1.1.1, 203.0.113.7" }))).toBe("203.0.113.7");
    expect(ipDoCliente(new Headers({ "x-forwarded-for": "203.0.113.7" }))).toBe("203.0.113.7");
  });

  it("forjar outro IP a cada tentativa não fura o limite", () => {
    const limite = criarRateLimiter({ limite: 2, janelaMs: 60_000 });
    const tentativa = (forjado: string) =>
      limite.consumir(ipDoCliente(new Headers({ "x-forwarded-for": `${forjado}, 203.0.113.7` }))).ok;
    expect([tentativa("1.1.1.1"), tentativa("2.2.2.2"), tentativa("3.3.3.3")]).toEqual([true, true, false]);
  });

  it("cai para x-real-ip e depois para 'local'", () => {
    expect(ipDoCliente(new Headers({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
    expect(ipDoCliente(new Headers({ "x-forwarded-for": " , " }))).toBe("local");
    expect(ipDoCliente(new Headers())).toBe("local");
  });
});
