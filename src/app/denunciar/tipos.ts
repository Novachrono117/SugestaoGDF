// Dados de referência que a página (servidor) entrega ao assistente (cliente).
export type CategoriaOpcao = { slug: string; nome: string; descricao: string; orgao: { sigla: string; nome: string } };
export type RegiaoOpcao = { codigo: string; nome: string };

export type Foto = { arquivo: File; url: string };

export { FOTOS } from "@/lib/validation/denuncia";
