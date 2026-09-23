-- AlterTable
ALTER TABLE "ManifestacaoGdf" ADD COLUMN "avaliacaoCidadao" TEXT;
ALTER TABLE "ManifestacaoGdf" ADD COLUMN "categoriaCorretaSlug" TEXT;
ALTER TABLE "ManifestacaoGdf" ADD COLUMN "iaAcertou" BOOLEAN;
ALTER TABLE "ManifestacaoGdf" ADD COLUMN "justificativaCidadao" TEXT;

-- CreateTable
CREATE TABLE "AvaliacaoCidadao" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "denunciaId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "justificativa" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enviadoEm" DATETIME,
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "ultimoErro" TEXT,
    CONSTRAINT "AvaliacaoCidadao_denunciaId_fkey" FOREIGN KEY ("denunciaId") REFERENCES "Denuncia" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SugestaoIA" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "denunciaId" TEXT NOT NULL,
    "categoriaId" TEXT NOT NULL,
    "orgaoId" TEXT NOT NULL,
    "confianca" REAL NOT NULL,
    "justificativa" TEXT NOT NULL,
    "origem" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "cidadaoConfirmou" BOOLEAN NOT NULL,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acertouSegundoGdf" BOOLEAN,
    "categoriaCorretaId" TEXT,
    "avaliadoPeloGdfEm" DATETIME,
    CONSTRAINT "SugestaoIA_denunciaId_fkey" FOREIGN KEY ("denunciaId") REFERENCES "Denuncia" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SugestaoIA_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SugestaoIA_orgaoId_fkey" FOREIGN KEY ("orgaoId") REFERENCES "Orgao" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SugestaoIA_categoriaCorretaId_fkey" FOREIGN KEY ("categoriaCorretaId") REFERENCES "Categoria" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_SugestaoIA" ("categoriaId", "cidadaoConfirmou", "confianca", "criadoEm", "denunciaId", "id", "justificativa", "modelo", "orgaoId", "origem") SELECT "categoriaId", "cidadaoConfirmou", "confianca", "criadoEm", "denunciaId", "id", "justificativa", "modelo", "orgaoId", "origem" FROM "SugestaoIA";
DROP TABLE "SugestaoIA";
ALTER TABLE "new_SugestaoIA" RENAME TO "SugestaoIA";
CREATE UNIQUE INDEX "SugestaoIA_denunciaId_key" ON "SugestaoIA"("denunciaId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "AvaliacaoCidadao_denunciaId_criadoEm_idx" ON "AvaliacaoCidadao"("denunciaId", "criadoEm");

-- CreateIndex
CREATE INDEX "AvaliacaoCidadao_enviadoEm_idx" ON "AvaliacaoCidadao"("enviadoEm");
