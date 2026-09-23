// Erro de regra de negócio com código estável e status HTTP; a mensagem é segura para o cliente.
export class ErroDominio extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ErroDominio";
  }
}
