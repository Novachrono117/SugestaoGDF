// Content-Security-Policy com nonce por requisição (docs/ARQUITETURA.md §9). O Next lê o nonce deste
// cabeçalho e o aplica sozinho nos próprios scripts; todas as páginas já são dinâmicas (sessão no cabeçalho).
import { NextResponse, type NextRequest } from "next/server";

export function montarCsp(nonce: string, dev: boolean): string {
  return [
    "default-src 'self'",
    // 'strict-dynamic': vale o script com nonce e o que ele carregar; 'self' e hosts passam a ser ignorados.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    // Tags <style> só com nonce; atributos style="" liberados à parte (Leaflet e React posicionam por eles).
    `style-src 'self' ${dev ? "'unsafe-inline'" : `'nonce-${nonce}'`}`,
    "style-src-attr 'unsafe-inline'",
    // Blocos do mapa (OpenStreetMap) e prévias das fotos escolhidas (blob:).
    "img-src 'self' blob: data: https://tile.openstreetmap.org",
    "font-src 'self'",
    `connect-src 'self'${dev ? " ws:" : ""}`,
    // Sem isto o service worker cairia no script-src, onde 'strict-dynamic' ignora o 'self'.
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = montarCsp(nonce, process.env.NODE_ENV === "development");

  const cabecalhos = new Headers(request.headers);
  cabecalhos.set("x-nonce", nonce);
  cabecalhos.set("Content-Security-Policy", csp);

  const resposta = NextResponse.next({ request: { headers: cabecalhos } });
  resposta.headers.set("Content-Security-Policy", csp);
  return resposta;
}

export const config = {
  matcher: [
    {
      // Só páginas HTML: fora API, estáticos do build, arquivos de public/ e ícones/manifest gerados.
      // offline.html fica de fora de propósito: tem <style> inline e é servida do cache do service worker.
      source: "/((?!api|_next/static|_next/image|icons/|sw\\.js|offline\\.html|manifest\\.webmanifest|icon\\.svg|apple-icon\\.png).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
