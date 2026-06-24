"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useRef, useState } from "react";
import { PageHeader } from "@/components/ui";
import { useAuth } from "@/lib/auth/context";
import { formatNumber } from "@/lib/format";

interface PreviewData {
  fileName: string;
  sheet1Rows: number;
  sheet2Entries: number;
  sampleFields: string[];
}

const IMPORT_CONFIRM_MESSAGE =
  "此操作将清空当前数据库中的全部项目明细和字典，并从 Excel 重新导入。网页中后续录入的数据也会丢失。确定继续吗？";

const ACCEPTED_EXCEL = ".xlsx,.xls,.xlsm";

export default function ImportPage() {
  return (
    <Suspense>
      <ImportPageInner />
    </Suspense>
  );
}

function ImportPageInner() {
  const { canWrite } = useAuth();
  const searchParams = useSearchParams();
  const fromProjects = searchParams.get("from") === "projects";
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function isExcelFile(file: File): boolean {
    const lower = file.name.toLowerCase();
    return lower.endsWith(".xlsx") || lower.endsWith(".xls") || lower.endsWith(".xlsm");
  }

  async function previewFile(file: File) {
    const previewForm = new FormData();
    previewForm.append("file", file);
    const previewRes = await fetch("/api/import/preview", {
      method: "POST",
      body: previewForm,
    });
    const previewData = await previewRes.json();
    if (!previewRes.ok) throw new Error(previewData.error || "解析失败");
    setPreview(previewData);
  }

  async function importFile(file: File) {
    const importForm = new FormData();
    importForm.append("file", file);
    const res = await fetch("/api/import", { method: "POST", body: importForm });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "导入失败");
    setMessage(`导入成功：${data.rowCount} 条明细已写入本地数据库（策略：清空并重新导入）`);
  }

  async function handleSelectedFile(file: File) {
    if (!canWrite) {
      setError("当前账号无写入权限，无法导入");
      return;
    }
    if (!isExcelFile(file)) {
      setError("请选择 .xlsx、.xls 或 .xlsm 格式的 Excel 文件");
      return;
    }
    setSelectedFile(file);
    setError("");
    setMessage("");
    try {
      await previewFile(file);
    } catch (e) {
      setPreview(null);
      setError(e instanceof Error ? e.message : "解析失败");
    }
  }

  async function handleConfirmImport() {
    if (!canWrite) {
      setError("当前账号无写入权限，无法导入");
      return;
    }
    if (!selectedFile) {
      setError("请先选择 Excel 文件");
      return;
    }
    if (!window.confirm(IMPORT_CONFIRM_MESSAGE)) return;

    setImporting(true);
    setError("");
    setMessage("");
    try {
      await importFile(selectedFile);
    } catch (e) {
      setError(e instanceof Error ? e.message : "导入失败");
    } finally {
      setImporting(false);
    }
  }

  async function handleDefaultTemplate() {
    if (!canWrite) {
      setError("当前账号无写入权限，无法导入");
      return;
    }
    setImporting(true);
    setError("");
    setMessage("");
    try {
      const previewRes = await fetch("/api/import/preview-default");
      const previewData = await previewRes.json();
      if (!previewRes.ok) throw new Error(previewData.error || "默认文件不可用");
      setPreview(previewData);
      setSelectedFile(null);
      if (!window.confirm(IMPORT_CONFIRM_MESSAGE)) return;
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "default" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "导入失败");
      setMessage(`导入成功：${data.rowCount} 条明细已写入本地数据库（策略：清空并重新导入）`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "导入失败");
    } finally {
      setImporting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Excel 导入"
        description="选择 Excel 文件导入项目明细与字典。重复导入将清空旧数据并重新写入。"
        action={
          fromProjects ? (
            <Link href="/projects" className="rounded border border-slate-300 px-4 py-2 text-sm">
              返回明细
            </Link>
          ) : undefined
        }
      />

      <div className="space-y-6">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          导入策略：清空并重新导入。执行后会删除现有项目明细与字典，再从 Excel 重建。点击导入前会弹出二次确认。原始
          xlsm 文件不会被修改。
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <h3 className="mb-4 text-sm font-semibold">选择 Excel 文件导入</h3>
          <p className="mb-4 text-sm text-slate-600">
            支持 .xlsx、.xls、.xlsm。Sheet1 明细 + Sheet2 字典。
          </p>
          {canWrite ? (
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_EXCEL}
                disabled={importing}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleSelectedFile(file);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                disabled={importing}
                onClick={() => fileInputRef.current?.click()}
                className="rounded border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
              >
                选择 Excel 文件
              </button>
              {selectedFile ? (
                <span className="text-sm text-slate-700">
                  已选：<span className="font-medium">{selectedFile.name}</span>
                </span>
              ) : (
                <span className="text-sm text-slate-400">尚未选择文件</span>
              )}
            </div>
          ) : (
            <p className="mb-4 text-sm text-slate-400">请先登录后再导入</p>
          )}

          {preview ? (
            <div className="mb-4 grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
              <div>
                <div className="text-xs text-slate-500">文件名</div>
                <div className="font-semibold">{preview.fileName}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">解析行数</div>
                <div className="font-semibold tabular-nums">{preview.sheet1Rows}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">字典条目</div>
                <div className="font-semibold tabular-nums">{preview.sheet2Entries}</div>
              </div>
              <div className="md:col-span-1">
                <div className="text-xs text-slate-500">字段</div>
                <div className="truncate text-slate-700">{preview.sampleFields.join("、")}</div>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleConfirmImport()}
              disabled={importing || !canWrite || !selectedFile}
              className="rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {importing ? "导入中..." : "确认导入所选文件"}
            </button>
            <button
              type="button"
              onClick={() => void handleDefaultTemplate()}
              disabled={importing || !canWrite}
              className="rounded border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              使用默认模板文件（便捷入口）
            </button>
          </div>
        </div>

        {message ? (
          <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {preview ? (
          <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">
            <p>
              PRD 参考（统计日期 2026-06-18）：有效明细 110 条，未完成 51 条 / 预计(工作日){" "}
              {formatNumber(117.4)}，7天内 3 条 / 4.0，8-14天 4 条 / 11.0，交期缺失 3 条 / 15.0。
            </p>
          </div>
        ) : null}
      </div>
    </>
  );
}
