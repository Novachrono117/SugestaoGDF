// Service worker mínimo do Voz DF.
// Só uma coisa: se a navegação falhar por falta de rede, mostra a página offline.
// NÃO guarda páginas nem respostas da API: elas podem conter relato ou dados da conta,
// que não devem ficar no aparelho (LGPD). O rascunho da denúncia fica no localStorage.
const CACHE = "voz-df-v1";
const OFFLINE = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add(OFFLINE)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return; // o resto segue direto para a rede
  event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE)));
});
