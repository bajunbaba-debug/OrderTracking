import path from "path";

/** 默认 Excel 绝对路径（项目根目录下的 项目统计2026.xlsm） */
export const DEFAULT_EXCEL_FILE = path.join(
  /* turbopackIgnore: true */ process.cwd(),
  "..",
  "项目统计2026.xlsm"
);
