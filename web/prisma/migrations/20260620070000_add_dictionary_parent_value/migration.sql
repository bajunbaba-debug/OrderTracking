-- 字典表增加 parentValue，支持类型细化按类型分组
-- SQLite 需重建表以变更唯一约束

PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Dictionary" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "category" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "parentValue" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true
);

INSERT INTO "new_Dictionary" ("id", "category", "value", "parentValue", "sortOrder", "enabled")
SELECT "id", "category", "value", '', "sortOrder", "enabled" FROM "Dictionary";

DROP TABLE "Dictionary";
ALTER TABLE "new_Dictionary" RENAME TO "Dictionary";

CREATE UNIQUE INDEX "Dictionary_category_value_parentValue_key" ON "Dictionary"("category", "value", "parentValue");

PRAGMA foreign_keys=ON;
