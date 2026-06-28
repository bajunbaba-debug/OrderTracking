-- Add ReviewOrderWorkflow integration idempotency fields
ALTER TABLE "ProjectItem" ADD COLUMN "externalSource" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ProjectItem" ADD COLUMN "externalTaskId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ProjectItem" ADD COLUMN "externalDetailId" TEXT NOT NULL DEFAULT '';

CREATE INDEX "ProjectItem_externalSource_externalTaskId_externalDetailId_idx"
ON "ProjectItem"("externalSource", "externalTaskId", "externalDetailId");
