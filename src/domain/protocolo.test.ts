import { describe, expect, it } from "vitest";
import { formatarProtocolo, isProtocolo, normalizarProtocolo } from "./protocolo";

describe("formatarProtocolo", () => {
  it("preenche a sequência com zeros", () => {
    expect(formatarProtocolo(2026, 123)).toBe("DF-2026-000123");
    expect(formatarProtocolo(2026, 999_999)).toBe("DF-2026-999999");
  });

  it.each([0, -1, 1_000_000, 1.5])("rejeita sequência %s", (seq) => {
    expect(() => formatarProtocolo(2026, seq)).toThrow(RangeError);
  });

  it("rejeita ano inválido", () => {
    expect(() => formatarProtocolo(26, 1)).toThrow(RangeError);
  });
});

describe("isProtocolo", () => {
  it("aceita o formato canônico", () => expect(isProtocolo("DF-2026-000123")).toBe(true));
  it.each(["DF-2026-000000", "df-2026-000123", "DF-2026-123", "DF-2026-0001234", "XX-2026-000123"])(
    "rejeita %s",
    (v) => expect(isProtocolo(v)).toBe(false),
  );
});

describe("normalizarProtocolo", () => {
  it.each([
    ["DF-2026-000123", "DF-2026-000123"],
    ["df-2026-123", "DF-2026-000123"],
    [" DF2026000123 ", "DF-2026-000123"],
  ])("%s → %s", (input, esperado) => expect(normalizarProtocolo(input)).toBe(esperado));

  it.each(["", "abc", "DF-2026-0", "DF-26-000123"])("retorna null para %s", (input) => {
    expect(normalizarProtocolo(input)).toBeNull();
  });
});
