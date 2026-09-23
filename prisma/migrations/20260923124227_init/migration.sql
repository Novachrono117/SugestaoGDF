-- CreateTable
CREATE TABLE "RegiaoAdministrativa" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "codigo" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "slug" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Orgao" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sigla" TEXT NOT NULL,
    "nome" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Categoria" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "orgaoPadraoId" TEXT NOT NULL,
    CONSTRAINT "Categoria_orgaoPadraoId_fkey" FOREIGN KEY ("orgaoPadraoId") REFERENCES "Orgao" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "papel" TEXT NOT NULL DEFAULT 'CIDADAO',
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Denuncia" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "protocolo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "categoriaId" TEXT NOT NULL,
    "raId" TEXT NOT NULL,
    "orgaoResponsavelId" TEXT,
    "latitude" REAL NOT NULL,
    "longitude" REAL NOT NULL,
    "enderecoReferencia" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RECEBIDA',
    "autorId" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL,
    "resolvidoEm" DATETIME,
    CONSTRAINT "Denuncia_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Denuncia_raId_fkey" FOREIGN KEY ("raId") REFERENCES "RegiaoAdministrativa" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Denuncia_orgaoResponsavelId_fkey" FOREIGN KEY ("orgaoResponsavelId") REFERENCES "Orgao" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Denuncia_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SugestaoIA" (
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
    CONSTRAINT "SugestaoIA_denunciaId_fkey" FOREIGN KEY ("denunciaId") REFERENCES "Denuncia" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SugestaoIA_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SugestaoIA_orgaoId_fkey" FOREIGN KEY ("orgaoId") REFERENCES "Orgao" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Anexo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "denunciaId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "caminho" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "tamanho" INTEGER NOT NULL,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Anexo_denunciaId_fkey" FOREIGN KEY ("denunciaId") REFERENCES "Denuncia" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EventoDenuncia" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "denunciaId" TEXT NOT NULL,
    "ator" TEXT NOT NULL,
    "autorId" TEXT,
    "tipo" TEXT NOT NULL,
    "statusDe" TEXT,
    "statusPara" TEXT,
    "texto" TEXT,
    "publico" BOOLEAN NOT NULL DEFAULT true,
    "eventoExternoId" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EventoDenuncia_denunciaId_fkey" FOREIGN KEY ("denunciaId") REFERENCES "Denuncia" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EventoDenuncia_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EnvioGdf" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "denunciaId" TEXT NOT NULL,
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "ultimoErro" TEXT,
    "enviadoEm" DATETIME,
    "atualizadoEm" DATETIME NOT NULL,
    CONSTRAINT "EnvioGdf_denunciaId_fkey" FOREIGN KEY ("denunciaId") REFERENCES "Denuncia" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContadorProtocolo" (
    "ano" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ultimo" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "ManifestacaoGdf" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "protocolo" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "orgaoDecididoSigla" TEXT,
    "recebidoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "RegiaoAdministrativa_codigo_key" ON "RegiaoAdministrativa"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "RegiaoAdministrativa_numero_key" ON "RegiaoAdministrativa"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "RegiaoAdministrativa_slug_key" ON "RegiaoAdministrativa"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Orgao_sigla_key" ON "Orgao"("sigla");

-- CreateIndex
CREATE UNIQUE INDEX "Categoria_slug_key" ON "Categoria"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Denuncia_protocolo_key" ON "Denuncia"("protocolo");

-- CreateIndex
CREATE INDEX "Denuncia_raId_status_idx" ON "Denuncia"("raId", "status");

-- CreateIndex
CREATE INDEX "Denuncia_categoriaId_status_idx" ON "Denuncia"("categoriaId", "status");

-- CreateIndex
CREATE INDEX "Denuncia_criadoEm_idx" ON "Denuncia"("criadoEm");

-- CreateIndex
CREATE INDEX "Denuncia_autorId_idx" ON "Denuncia"("autorId");

-- CreateIndex
CREATE UNIQUE INDEX "SugestaoIA_denunciaId_key" ON "SugestaoIA"("denunciaId");

-- CreateIndex
CREATE UNIQUE INDEX "Anexo_token_key" ON "Anexo"("token");

-- CreateIndex
CREATE INDEX "Anexo_denunciaId_idx" ON "Anexo"("denunciaId");

-- CreateIndex
CREATE UNIQUE INDEX "EventoDenuncia_eventoExternoId_key" ON "EventoDenuncia"("eventoExternoId");

-- CreateIndex
CREATE INDEX "EventoDenuncia_denunciaId_criadoEm_idx" ON "EventoDenuncia"("denunciaId", "criadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "EnvioGdf_denunciaId_key" ON "EnvioGdf"("denunciaId");

-- CreateIndex
CREATE INDEX "EnvioGdf_enviadoEm_idx" ON "EnvioGdf"("enviadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "ManifestacaoGdf_protocolo_key" ON "ManifestacaoGdf"("protocolo");
