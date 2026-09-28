"use client";

import { useEffect } from "react";
import { apagarRascunho } from "@/lib/rascunho-denuncia";

/** Apaga o rascunho da denúncia deste aparelho ao montar (ex.: depois de excluir a conta). */
export function ApagarRascunho() {
  useEffect(() => apagarRascunho(localStorage), []);
  return null;
}
