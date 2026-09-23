/** Só caminhos internos ("/x"), nunca "//host", "/\host" ou URL absoluta — evita open redirect. */
export function destinoSeguro(valor: unknown): string {
  const v = typeof valor === "string" ? valor : "";
  return v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\") ? v : "/";
}
