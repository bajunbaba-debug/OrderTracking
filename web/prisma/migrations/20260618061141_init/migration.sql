-- CreateTable
CREATE TABLE "ProjectItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceRowNumber" INTEGER,
    "type" TEXT NOT NULL DEFAULT '',
    "typeDetail" TEXT NOT NULL DEFAULT '',
    "contractNo" TEXT NOT NULL DEFAULT '',
    "projectName" TEXT NOT NULL DEFAULT '',
    "model" TEXT NOT NULL DEFAULT '',
    "quantity" REAL,
    "publishDate" DATETIME,
    "assignDate" DATETIME,
    "designCompleteDate" DATETIME,
    "dueDate" DATETIME,
    "owner" TEXT NOT NULL DEFAULT '',
    "estimatedComplexity" REAL,
    "solutionOwner" TEXT NOT NULL DEFAULT '',
    "sales" TEXT NOT NULL DEFAULT '',
    "commonRemark" TEXT NOT NULL DEFAULT '',
    "extraRemark" TEXT NOT NULL DEFAULT '',
    "designStatus" TEXT NOT NULL DEFAULT 'incomplete',
    "totalComplexity" REAL NOT NULL DEFAULT 0,
    "dueBucket" TEXT NOT NULL DEFAULT '',
    "waitingDays" INTEGER,
    "designCycleDays" INTEGER,
    "parsedModelQuantity" REAL,
    "technicalComplexityP1" REAL,
    "typeBaselineP10" REAL,
    "quantityComplexityP2" REAL,
    "comfortBaselineP20" REAL NOT NULL DEFAULT 3,
    "p1DeviationRate" REAL,
    "p2DeviationRate" REAL,
    "riskLevel" TEXT NOT NULL DEFAULT 'green',
    "riskTags" TEXT NOT NULL DEFAULT '[]',
    "qualityIssues" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Dictionary" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "category" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fileName" TEXT NOT NULL,
    "importedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rowCount" INTEGER NOT NULL,
    "mode" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT ''
);

-- CreateTable
CREATE TABLE "AppConfig" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "statsDate" TEXT NOT NULL DEFAULT '2026-06-18'
);

-- CreateIndex
CREATE UNIQUE INDEX "Dictionary_category_value_key" ON "Dictionary"("category", "value");
