/**
 * 从默认 Excel 重新导入，清空 dev.db 中的测试脏数据。
 * 用法：npm run db:reset-excel（需 dev 服务已启动）
 */
import { importFromFile } from "../src/lib/project-service";
import { DEFAULT_EXCEL_FILE } from "../src/lib/paths";

async function main() {
  const result = await importFromFile(DEFAULT_EXCEL_FILE);
  console.log(`已从 ${DEFAULT_EXCEL_FILE} 重新导入 ${result.rowCount} 条明细`);
}

main().catch((err) => {
  console.error("导入失败:", err);
  process.exit(1);
});
