"use client";

import { useEffect } from "react";

/** Registra o service worker (public/sw.js). Só em produção: no dev ele atrapalharia o hot reload. */
export function RegistrarServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // Sem service worker o site funciona igual, só sem a página offline.
    });
  }, []);
  return null;
}
