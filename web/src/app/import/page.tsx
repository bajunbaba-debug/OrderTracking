"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { PageHeader } from "@/components/ui";
import { formatNumber } from "@/lib/format";

interface PreviewData {
  fileName: string;
  sheet1Rows: number;
  sheet2Entries: number;
  sampleFields: string[];
}

const IMPORT_CONFIRM_MESSAGE =
  "此操作将清空当前数据库中的全部项目明细和字典，并从 Excel 重新导入。网页中后续录入的数据也会丢失。确定继续吗？";

export default function ImportPage() {
  return (
    <Suspense>
      <ImportPageInner />
    </Suspense>
  );
}

function ImportPageInner() {
  const searchParams = useSearchParams();
  const fromProjects = searchParams.get("from") === "projects";
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/import/preview-default")
      .then((r) => r.json())
      .then(setPreview)
      .catch((e) => setError(e.message));
  }, []);

  async function handleDefaultImport() {
    if (!window.confirm(IMPORT_CONFIRM_MESSAGE)) return;

    setImporting(true);
    setError("");
    setMessage("");
    try {
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

  async function handleFileImport(file: File) {
    if (!window.confirm(IMPORT_CONFIRM_MESSAGE)) return;

    setImporting(true);
    setError("");
    setMessage("");
    try {
      const previewForm = new FormData();
      previewForm.append("file", file);
      const previewRes = await fetch("/api/import/preview", {
        method: "POST",
        body: previewForm,
      });
      const previewData = await previewRes.json();
      if (!previewRes.ok) throw new Error(previewData.error || "解析失败");
      setPreview(previewData);

      const importForm = new FormData();
      importForm.append("file", file);
      const res = await fetch("/api/import", { method: "POST", body: importForm });
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
        description="从 项目统计2026.xlsm 初始化数据。重复导入将清空旧数据并重新写入。"
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
          <h3 className="mb-4 text-sm font-semibold">方式一：导入项目目录下的默认文件</h3>
          <p className="mb-4 text-sm text-slate-600">文件：项目统计2026.xlsm（Sheet1 明细 + Sheet2 字典）</p>
          {preview ? (
            <div className="mb-4 grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
              <div>
                <div className="text-xs text-slate-500">解析行数</div>
                <div className="font-semibold tabular-nums">{preview.sheet1Rows}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">字典条目</div>
                <div className="font-semibold tabular-nums">{preview.sheet2Entries}</div>
              </div>
              <div className="md:col-span-2">
                <div className="text-xs text-slate-500">字段</div>
                <div className="text-slate-700">{preview.sampleFields.join("、")}</div>
              </div>
            </div>
          ) : null}
          <button
            onClick={handleDefaultImport}
            disabled={importing}
            className="rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {importing ? "导入中..." : "导入默认 Excel"}
          </button>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <h3 className="mb-4 text-sm font-semibold">方式二：上传 Excel 文件</h3>
          <input
            type="file"
            accept=".xlsm,.xlsx,.xls"
            disabled={importing}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFileImport(file);
              e.target.value = "";
            }}
            className="text-sm"
          />
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
