import * as XLSX from "xlsx";
import fs from "fs";
import path from "path";
import type { RawProjectRow } from "./types";
import { normalizeBusinessDate } from "./format";

function str(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

function num(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function date(value: unknown): Date | null {
  return normalizeBusinessDate(value);
}

export interface DictionaryEntry {
  category: string;
  value: string;
  sortOrder: number;
  parentValue?: string;
}

export interface ExcelPreview {
  fileName: string;
  sheet1Rows: number;
  sheet2Entries: number;
  sampleFields: string[];
  sampleRows: RawProjectRow[];
  dictionaries: DictionaryEntry[];
}

function parseSheet1(workbook: XLSX.WorkBook): RawProjectRow[] {
  const sheet = workbook.Sheets["Sheet1"];
  if (!sheet) throw new Error("未找到 Sheet1 工作表");

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });

  return rows.map((row, index) => ({
    sourceRowNumber: index + 2,
    type: str(row["类型"]),
    typeDetail: str(row["类型细化"]),
    contractNo: str(row["合同号"]),
    projectName: str(row["项目名称"]),
    model: str(row["型号"]),
    quantity: num(row["数量"]),
    publishDate: date(row["发布日期"]),
    assignDate: date(row["分配日期"]),
    designCompleteDate: date(row["设计完成"]),
    dueDate: date(row["交期"]),
    owner: str(row["负责人"]),
    estimatedComplexity: num(row["预计"]),
    solutionOwner: str(row["方案"]),
    sales: str(row["销售"]),
    commonRemark: str(row["常用备注"]),
    extraRemark: str(row["额外备注"]),
  }));
}

function parseSheet2(workbook: XLSX.WorkBook): DictionaryEntry[] {
  const sheet = workbook.Sheets["Sheet2"];
  if (!sheet) return [];

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  });

  const categories: Array<{ key: keyof Record<string, unknown>; category: string }> = [
    { key: "类型", category: "type" },
    { key: "类型细化", category: "typeDetail" },
    { key: "负责人", category: "owner" },
    { key: "方案", category: "solutionOwner" },
    { key: "备注", category: "commonRemark" },
    { key: "销售", category: "sales" },
  ];

  const entries: DictionaryEntry[] = [];
  const seen = new Set<string>();

  rows.forEach((row, index) => {
    const rowType = str(row["类型"]);
    for (const { key, category } of categories) {
      const value = str(row[key as string]);
      if (!value) continue;
      const parentValue = category === "typeDetail" ? rowType : "";
      const dedupe = `${category}:${parentValue}:${value}`;
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);
      entries.push({ category, value, sortOrder: index, parentValue: parentValue || undefined });
    }
  });

  return entries;
}

export function readExcelBuffer(buffer: Buffer, fileName: string): ExcelPreview {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const projects = parseSheet1(workbook);
  const dictionaries = parseSheet2(workbook);

  return {
    fileName,
    sheet1Rows: projects.length,
    sheet2Entries: dictionaries.length,
    sampleFields: [
      "类型",
      "类型细化",
      "合同号",
      "项目名称",
      "型号",
      "数量",
      "发布日期",
      "分配日期",
      "设计完成",
      "交期",
      "负责人",
      "预计",
      "方案",
      "销售",
      "常用备注",
      "额外备注",
    ],
    sampleRows: projects.slice(0, 3),
    dictionaries,
  };
}

export function readExcelFile(filePath: string): ExcelPreview {
  const buffer = fs.readFileSync(filePath);
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const projects = parseSheet1(workbook);
  const dictionaries = parseSheet2(workbook);
  return {
    fileName: path.basename(filePath),
    sheet1Rows: projects.length,
    sheet2Entries: dictionaries.length,
    sampleFields: [
      "类型",
      "类型细化",
      "合同号",
      "项目名称",
      "型号",
      "数量",
      "发布日期",
      "分配日期",
      "设计完成",
      "交期",
      "负责人",
      "预计",
      "方案",
      "销售",
      "常用备注",
      "额外备注",
    ],
    sampleRows: projects.slice(0, 3),
    dictionaries,
  };
}

export function parseExcelBuffer(buffer: Buffer): {
  projects: RawProjectRow[];
  dictionaries: DictionaryEntry[];
  fileName: string;
} {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  return {
    projects: parseSheet1(workbook),
    dictionaries: parseSheet2(workbook),
    fileName: "upload.xlsm",
  };
}

export function parseExcelFile(filePath: string): {
  projects: RawProjectRow[];
  dictionaries: DictionaryEntry[];
  fileName: string;
} {
  const buffer = fs.readFileSync(filePath);
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  return {
    projects: parseSheet1(workbook),
    dictionaries: parseSheet2(workbook),
    fileName: path.basename(filePath),
  };
}
