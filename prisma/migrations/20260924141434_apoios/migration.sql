-- AlterTable
ALTER TABLE "ManifestacaoGdf" ADD COLUMN     "totalApoios" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Apoio" (
    "denunciaId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enviadoEm" TIMESTAMP(3),

    CONSTRAINT "Apoio_pkey" PRIMARY KEY ("denunciaId","usuarioId")
);

-- CreateIndex
CREATE INDEX "Apoio_enviadoEm_idx" ON "Apoio"("enviadoEm");

-- AddForeignKey
ALTER TABLE "Apoio" ADD CONSTRAINT "Apoio_denunciaId_fkey" FOREIGN KEY ("denunciaId") REFERENCES "Denuncia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Apoio" ADD CONSTRAINT "Apoio_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
