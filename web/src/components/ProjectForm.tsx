"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth/context";
import type { ProjectFormValues } from "@/lib/project-form";
import { parseProjectBody } from "@/lib/project-input";
import { formatValidationErrors, validateProjectRow } from "@/lib/project-validation";

const INPUT_CLASS =
  "w-full rounded border border-slate-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-600";

interface DictionaryMap {
  type?: string[];
  typeDetail?: string[];
  typeDetailByType?: Record<string, string[]>;
  owner?: string[];
  solutionOwner?: string[];
  remark?: string[];
  sales?: string[];
}

const EMPTY_FORM: ProjectFormValues = {
  type: "",
  typeDetail: "",
  contractNo: "",
  projectName: "",
  model: "",
  quantity: "",
  publishDate: "",
  assignDate: "",
  designCompleteDate: "",
  dueDate: "",
  owner: "",
  estimatedComplexity: "",
  solutionOwner: "",
  sales: "",
  commonRemark: "",
  extraRemark: "",
};

function SelectOrInput({
  label,
  name,
  value,
  options,
  onChange,
  manageLabel,
  onManage,
  readOnly = false,
}: {
  label: string;
  name: keyof ProjectFormValues;
  value: string;
  options?: string[];
  onChange: (name: keyof ProjectFormValues, value: string) => void;
  manageLabel?: string;
  onManage?: () => void;
  readOnly?: boolean;
}) {
  const listId = `dict-${name}`;

  return (
    <label className="block">
      <span className="mb-1 flex items-center justify-between gap-2 text-xs text-slate-500">
        <span>{label}</span>
        {onManage && !readOnly ? (
          <button type="button" onClick={onManage} className="text-blue-700 hover:underline">
            {manageLabel ?? "管理选项"}
          </button>
        ) : null}
      </span>
      <input
        list={options && options.length > 0 ? listId : undefined}
        value={value}
        disabled={readOnly}
        onChange={(e) => onChange(name, e.target.value)}
        className={INPUT_CLASS}
        placeholder={options && options.length > 0 ? "可选择或手动输入" : undefined}
      />
      {options && options.length > 0 ? (
        <datalist id={listId}>
          {options.map((opt) => (
            <option key={opt} value={opt} />
          ))}
        </datalist>
      ) : null}
    </label>
  );
}

function DictionaryManager({
  dict,
  selectedType,
  onClose,
  onUpdated,
  readOnly = false,
}: {
  dict: DictionaryMap;
  selectedType: string;
  onClose: () => void;
  onUpdated: (next: DictionaryMap) => void;
  readOnly?: boolean;
}) {
  const [tab, setTab] = useState<"type" | "typeDetail" | "remark">("type");
  const [newValue, setNewValue] = useState("");
  const [parentType, setParentType] = useState(selectedType);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function addEntry() {
    if (readOnly) return;
    const value = newValue.trim();
    if (!value) return;
    setBusy(true);
    setError("");
    try {
      const category = tab === "remark" ? "remark" : tab;
      const body: Record<string, string> = { category, value };
      if (tab === "typeDetail") {
        if (!parentType.trim()) {
          setError("请先选择所属类型");
          setBusy(false);
          return;
        }
        body.parentValue = parentType.trim();
      }
      const res = await fetch("/api/dictionaries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "添加失败");
      onUpdated(data as DictionaryMap);
      setNewValue("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "添加失败");
    } finally {
      setBusy(false);
    }
  }

  async function removeEntry(value: string, parentValue = "") {
    if (readOnly) return;
    setBusy(true);
    setError("");
    try {
      const category = tab === "remark" ? "remark" : tab;
      const params = new URLSearchParams({ category, value, parentValue });
      const res = await fetch(`/api/dictionaries?${params}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "删除失败");
      onUpdated(data as DictionaryMap);
    } catch (e) {
      setError(e instanceof Error ? e.message : "删除失败");
    } finally {
      setBusy(false);
    }
  }

  const typeList = dict.type ?? [];
  const remarkList = dict.remark ?? [];
  const detailList =
    tab === "typeDetail" && parentType
      ? (dict.typeDetailByType?.[parentType] ?? [])
      : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[80vh] w-full max-w-lg overflow-auto rounded-lg bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold">管理字典选项</h3>
            <p className="mt-1 text-sm text-slate-500">类型细化必须隶属于某个类型</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-slate-300 px-3 py-1 text-sm"
          >
            关闭
          </button>
        </div>

        <div className="mb-4 flex gap-2">
          {(
            [
              ["type", "类型"],
              ["typeDetail", "类型细化"],
              ["remark", "常用备注"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`rounded px-3 py-1 text-sm ${
                tab === key ? "bg-slate-900 text-white" : "border border-slate-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "typeDetail" ? (
          <label className="mb-3 block text-sm">
            <span className="mb-1 block text-xs text-slate-500">所属类型</span>
            <select
              value={parentType}
              onChange={(e) => setParentType(e.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">请选择类型</option>
              {typeList.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <div className="mb-3 flex gap-2">
          <input
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder="输入新选项"
            disabled={readOnly}
            className={`flex-1 ${INPUT_CLASS}`}
          />
          {!readOnly ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void addEntry()}
              className="rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-50"
            >
              添加
            </button>
          ) : null}
        </div>

        {error ? (
          <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <ul className="divide-y divide-slate-100 rounded border border-slate-200">
          {(tab === "type"
            ? typeList
            : tab === "remark"
              ? remarkList
              : detailList
          ).map((item) => (
            <li key={item} className="flex items-center justify-between px-3 py-2 text-sm">
              <span>{item}</span>
              {!readOnly ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void removeEntry(item, tab === "typeDetail" ? parentType : "")
                  }
                  className="text-red-600 hover:underline disabled:opacity-50"
                >
                  删除
                </button>
              ) : null}
            </li>
          ))}
          {(tab === "type"
            ? typeList
            : tab === "remark"
              ? remarkList
              : detailList
          ).length === 0 ? (
            <li className="px-3 py-4 text-center text-sm text-slate-400">暂无选项</li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}

export type ProjectFormReturnTo =
  | { kind: "projects" }
  | { kind: "timeline"; owner: string; projectId: string };

export function ProjectForm({
  initial,
  projectId,
  onSuccess,
  returnTo = { kind: "projects" },
}: {
  initial?: Partial<ProjectFormValues>;
  projectId?: string;
  onSuccess?: () => void;
  returnTo?: ProjectFormReturnTo;
}) {
  const router = useRouter();
  const { canWrite } = useAuth();
  const [form, setForm] = useState<ProjectFormValues>({ ...EMPTY_FORM, ...initial });
  const [dict, setDict] = useState<DictionaryMap>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [dictOpen, setDictOpen] = useState(false);

  const loadDict = useCallback(() => {
    fetch("/api/dictionaries")
      .then((r) => r.json())
      .then(setDict)
      .catch(() => setDict({}));
  }, []);

  useEffect(() => {
    loadDict();
  }, [loadDict]);

  const typeDetailOptions = useMemo(() => {
    if (!form.type) return dict.typeDetail ?? [];
    return dict.typeDetailByType?.[form.type] ?? [];
  }, [dict, form.type]);

  function update(name: keyof ProjectFormValues, value: string) {
    if (!canWrite) return;
    setForm((prev) => {
      const next = { ...prev, [name]: value };
      if (name === "type") {
        const allowed = dict.typeDetailByType?.[value] ?? [];
        if (prev.typeDetail && allowed.length > 0 && !allowed.includes(prev.typeDetail)) {
          next.typeDetail = "";
        }
      }
      return next;
    });
    if (error) setError("");
  }

  function navigateAfterAction(ownerOverride?: string) {
    onSuccess?.();
    if (returnTo.kind === "timeline") {
      const owner = ownerOverride ?? returnTo.owner;
      router.push(
        `/timeline?open=${encodeURIComponent(returnTo.projectId)}&owner=${encodeURIComponent(owner)}`
      );
    } else {
      router.push("/projects");
    }
    router.refresh();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canWrite) {
      setError("当前账号无写入权限，无法保存");
      return;
    }
    setError("");

    const row = parseProjectBody(form as unknown as Record<string, unknown>);
    const validation = validateProjectRow(row);
    if (!validation.ok) {
      setError(formatValidationErrors(validation.errors));
      return;
    }

    setSaving(true);
    try {
      const url = projectId ? `/api/projects/${projectId}` : "/api/projects";
      const method = projectId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await res.json()) as { error?: string; owner?: string };
      if (!res.ok) {
        setError(data.error || "保存失败");
        return;
      }
      const savedOwner =
        returnTo.kind === "timeline" && typeof data.owner === "string" && data.owner.trim()
          ? data.owner.trim()
          : undefined;
      navigateAfterAction(savedOwner);
    } catch {
      setError("保存失败，请稍后重试");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <SelectOrInput
            label="类型"
            name="type"
            value={form.type}
            options={dict.type}
            onChange={update}
            readOnly={!canWrite}
            onManage={canWrite ? () => setDictOpen(true) : undefined}
          />
          <SelectOrInput
            label="类型细化"
            name="typeDetail"
            value={form.typeDetail}
            options={typeDetailOptions}
            onChange={update}
            readOnly={!canWrite}
            onManage={canWrite ? () => setDictOpen(true) : undefined}
          />
          <SelectOrInput
            label="合同号"
            name="contractNo"
            value={form.contractNo}
            onChange={update}
            readOnly={!canWrite}
          />
          <SelectOrInput
            label="项目名称"
            name="projectName"
            value={form.projectName}
            onChange={update}
            readOnly={!canWrite}
          />
          <SelectOrInput
            label="型号"
            name="model"
            value={form.model}
            onChange={update}
            readOnly={!canWrite}
          />
          <label className="block">
            <span className="mb-1 block text-xs text-slate-500">数量</span>
            <input
              type="number"
              value={form.quantity}
              disabled={!canWrite}
              onChange={(e) => update("quantity", e.target.value)}
              className={INPUT_CLASS}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-slate-500">发布日期</span>
            <input
              type="date"
              value={form.publishDate}
              disabled={!canWrite}
              onChange={(e) => update("publishDate", e.target.value)}
              className={INPUT_CLASS}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-slate-500">分配日期</span>
            <input
              type="date"
              value={form.assignDate}
              disabled={!canWrite}
              onChange={(e) => update("assignDate", e.target.value)}
              className={INPUT_CLASS}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-slate-500">设计完成</span>
            <input
              type="date"
              value={form.designCompleteDate}
              disabled={!canWrite}
              onChange={(e) => update("designCompleteDate", e.target.value)}
              className={INPUT_CLASS}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-slate-500">交期</span>
            <input
              type="date"
              value={form.dueDate}
              disabled={!canWrite}
              onChange={(e) => update("dueDate", e.target.value)}
              className={INPUT_CLASS}
            />
          </label>
          <SelectOrInput
            label="负责人"
            name="owner"
            value={form.owner}
            options={dict.owner}
            onChange={update}
            readOnly={!canWrite}
          />
          <label className="block">
            <span className="mb-1 block text-xs text-slate-500">预计(工作日)</span>
            <input
              type="number"
              step="0.1"
              value={form.estimatedComplexity}
              disabled={!canWrite}
              onChange={(e) => update("estimatedComplexity", e.target.value)}
              className={INPUT_CLASS}
            />
          </label>
          <SelectOrInput
            label="方案"
            name="solutionOwner"
            value={form.solutionOwner}
            options={dict.solutionOwner}
            onChange={update}
            readOnly={!canWrite}
          />
          <SelectOrInput
            label="销售"
            name="sales"
            value={form.sales}
            options={dict.sales}
            onChange={update}
            readOnly={!canWrite}
          />
          <SelectOrInput
            label="常用备注"
            name="commonRemark"
            value={form.commonRemark}
            options={dict.remark}
            onChange={update}
            readOnly={!canWrite}
            onManage={canWrite ? () => setDictOpen(true) : undefined}
          />
          <label className="block md:col-span-2">
            <span className="mb-1 block text-xs text-slate-500">额外备注</span>
            <input
              value={form.extraRemark}
              disabled={!canWrite}
              onChange={(e) => update("extraRemark", e.target.value)}
              className={INPUT_CLASS}
            />
          </label>
        </div>
        {error ? (
          <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        ) : null}
        <div className="flex gap-3">
          {canWrite ? (
            <button
              type="submit"
              disabled={saving}
              className="rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {saving ? "保存中..." : "保存"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => navigateAfterAction()}
            className="rounded border border-slate-300 px-4 py-2 text-sm"
          >
            {returnTo.kind === "timeline" ? "返回订单详情" : "返回明细"}
          </button>
        </div>
      </form>

      {dictOpen && canWrite ? (
        <DictionaryManager
          dict={dict}
          selectedType={form.type}
          onClose={() => setDictOpen(false)}
          onUpdated={(next) => {
            setDict(next);
            loadDict();
          }}
          readOnly={!canWrite}
        />
      ) : null}
    </>
  );
}
