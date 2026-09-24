-- CreateEnum
CREATE TYPE "Papel" AS ENUM ('CIDADAO', 'OPERADOR_GDF');

-- CreateEnum
CREATE TYPE "StatusDenuncia" AS ENUM ('RECEBIDA', 'ENVIADA_GDF', 'EM_ANALISE', 'ENCAMINHADA', 'EM_EXECUCAO', 'RESOLVIDA', 'NAO_PROCEDENTE', 'DUPLICADA', 'REABERTA');

-- CreateEnum
CREATE TYPE "AtorEvento" AS ENUM ('SISTEMA', 'GDF', 'CIDADAO');

-- CreateEnum
CREATE TYPE "TipoEvento" AS ENUM ('CRIADA', 'ENVIADA_GDF', 'FALHA_ENVIO', 'MUDANCA_STATUS', 'AVALIACAO_CIDADAO');

-- CreateEnum
CREATE TYPE "TipoAvaliacaoCidadao" AS ENUM ('CONFIRMADA', 'CONTESTADA');

-- CreateEnum
CREATE TYPE "OrigemSugestao" AS ENUM ('LLM', 'REGRAS');

-- CreateTable
CREATE TABLE "RegiaoAdministrativa" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "RegiaoAdministrativa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Orgao" (
    "id" TEXT NOT NULL,
    "sigla" TEXT NOT NULL,
    "nome" TEXT NOT NULL,

    CONSTRAINT "Orgao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Categoria" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "orgaoPadraoId" TEXT NOT NULL,

    CONSTRAINT "Categoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "papel" "Papel" NOT NULL DEFAULT 'CIDADAO',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Denuncia" (
    "id" TEXT NOT NULL,
    "protocolo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "categoriaId" TEXT NOT NULL,
    "raId" TEXT NOT NULL,
    "orgaoResponsavelId" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "enderecoReferencia" TEXT,
    "status" "StatusDenuncia" NOT NULL DEFAULT 'RECEBIDA',
    "autorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "resolvidoEm" TIMESTAMP(3),

    CONSTRAINT "Denuncia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SugestaoIA" (
    "id" TEXT NOT NULL,
    "denunciaId" TEXT NOT NULL,
    "categoriaId" TEXT NOT NULL,
    "orgaoId" TEXT NOT NULL,
    "confianca" DOUBLE PRECISION NOT NULL,
    "justificativa" TEXT NOT NULL,
    "origem" "OrigemSugestao" NOT NULL,
    "modelo" TEXT NOT NULL,
    "cidadaoConfirmou" BOOLEAN NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acertouSegundoGdf" BOOLEAN,
    "categoriaCorretaId" TEXT,
    "avaliadoPeloGdfEm" TIMESTAMP(3),

    CONSTRAINT "SugestaoIA_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Anexo" (
    "id" TEXT NOT NULL,
    "denunciaId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "caminho" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "tamanho" INTEGER NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Anexo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventoDenuncia" (
    "id" TEXT NOT NULL,
    "denunciaId" TEXT NOT NULL,
    "ator" "AtorEvento" NOT NULL,
    "autorId" TEXT,
    "tipo" "TipoEvento" NOT NULL,
    "statusDe" "StatusDenuncia",
    "statusPara" "StatusDenuncia",
    "texto" TEXT,
    "publico" BOOLEAN NOT NULL DEFAULT true,
    "eventoExternoId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventoDenuncia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnvioGdf" (
    "id" TEXT NOT NULL,
    "denunciaId" TEXT NOT NULL,
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "ultimoErro" TEXT,
    "enviadoEm" TIMESTAMP(3),
    "idExterno" TEXT,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnvioGdf_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvaliacaoCidadao" (
    "id" TEXT NOT NULL,
    "denunciaId" TEXT NOT NULL,
    "tipo" "TipoAvaliacaoCidadao" NOT NULL,
    "justificativa" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enviadoEm" TIMESTAMP(3),
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "ultimoErro" TEXT,

    CONSTRAINT "AvaliacaoCidadao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContadorProtocolo" (
    "ano" INTEGER NOT NULL,
    "ultimo" INTEGER NOT NULL,

    CONSTRAINT "ContadorProtocolo_pkey" PRIMARY KEY ("ano")
);

-- CreateTable
CREATE TABLE "ManifestacaoGdf" (
    "id" TEXT NOT NULL,
    "protocolo" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "orgaoDecididoSigla" TEXT,
    "avaliacaoCidadao" TEXT,
    "justificativaCidadao" TEXT,
    "iaAcertou" BOOLEAN,
    "categoriaCorretaSlug" TEXT,
    "recebidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManifestacaoGdf_pkey" PRIMARY KEY ("id")
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
CREATE INDEX "AvaliacaoCidadao_denunciaId_criadoEm_idx" ON "AvaliacaoCidadao"("denunciaId", "criadoEm");

-- CreateIndex
CREATE INDEX "AvaliacaoCidadao_enviadoEm_idx" ON "AvaliacaoCidadao"("enviadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "ManifestacaoGdf_protocolo_key" ON "ManifestacaoGdf"("protocolo");

-- AddForeignKey
ALTER TABLE "Categoria" ADD CONSTRAINT "Categoria_orgaoPadraoId_fkey" FOREIGN KEY ("orgaoPadraoId") REFERENCES "Orgao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Denuncia" ADD CONSTRAINT "Denuncia_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Denuncia" ADD CONSTRAINT "Denuncia_raId_fkey" FOREIGN KEY ("raId") REFERENCES "RegiaoAdministrativa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Denuncia" ADD CONSTRAINT "Denuncia_orgaoResponsavelId_fkey" FOREIGN KEY ("orgaoResponsavelId") REFERENCES "Orgao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Denuncia" ADD CONSTRAINT "Denuncia_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SugestaoIA" ADD CONSTRAINT "SugestaoIA_denunciaId_fkey" FOREIGN KEY ("denunciaId") REFERENCES "Denuncia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SugestaoIA" ADD CONSTRAINT "SugestaoIA_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SugestaoIA" ADD CONSTRAINT "SugestaoIA_orgaoId_fkey" FOREIGN KEY ("orgaoId") REFERENCES "Orgao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SugestaoIA" ADD CONSTRAINT "SugestaoIA_categoriaCorretaId_fkey" FOREIGN KEY ("categoriaCorretaId") REFERENCES "Categoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Anexo" ADD CONSTRAINT "Anexo_denunciaId_fkey" FOREIGN KEY ("denunciaId") REFERENCES "Denuncia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoDenuncia" ADD CONSTRAINT "EventoDenuncia_denunciaId_fkey" FOREIGN KEY ("denunciaId") REFERENCES "Denuncia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoDenuncia" ADD CONSTRAINT "EventoDenuncia_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvioGdf" ADD CONSTRAINT "EnvioGdf_denunciaId_fkey" FOREIGN KEY ("denunciaId") REFERENCES "Denuncia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvaliacaoCidadao" ADD CONSTRAINT "AvaliacaoCidadao_denunciaId_fkey" FOREIGN KEY ("denunciaId") REFERENCES "Denuncia"("id") ON DELETE CASCADE ON UPDATE CASCADE;
