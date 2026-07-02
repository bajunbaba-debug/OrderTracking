ALTER TABLE "ProjectItem" ADD COLUMN "uuid" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ProjectItem" ADD COLUMN "lastImportBatchId" TEXT NOT NULL DEFAULT '';

CREATE INDEX "ProjectItem_uuid_idx" ON "ProjectItem"("uuid");
CREATE INDEX "ProjectItem_lastImportBatchId_idx" ON "ProjectItem"("lastImportBatchId");
