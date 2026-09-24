-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "notificarPorEmail" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "NotificacaoEmail" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "eventoId" TEXT NOT NULL,
    "assunto" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enviadoEm" TIMESTAMP(3),
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "ultimoErro" TEXT,

    CONSTRAINT "NotificacaoEmail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotificacaoEmail_eventoId_key" ON "NotificacaoEmail"("eventoId");

-- CreateIndex
CREATE INDEX "NotificacaoEmail_enviadoEm_criadoEm_idx" ON "NotificacaoEmail"("enviadoEm", "criadoEm");

-- AddForeignKey
ALTER TABLE "NotificacaoEmail" ADD CONSTRAINT "NotificacaoEmail_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificacaoEmail" ADD CONSTRAINT "NotificacaoEmail_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "EventoDenuncia"("id") ON DELETE CASCADE ON UPDATE CASCADE;
