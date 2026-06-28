"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/auth/context";
import { formatNumber } from "@/lib/format";
import type { ProjectFormValues } from "@/lib/project-form";
import { parseProjectBody } from "@/lib/project-input";
import { formatValidationErrors, validateProjectRow } from "@/lib/project-validation";

const COMMON_REMARK_CATEGORY = "commonRemark";

const INPUT_CLASS =
  "w-full rounded border border-slate-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-600";

interface DictionaryMap {
  type?: string[];
  typeDetail?: string[];
  typeDetailByType?: Record<string, string[]>;
  owner?: string[];
  solutionOwner?: string[];
  commonRemark?: string[];
  sales?: string[];
}

type OwnerRankingRow = {
  owner: string;
  count: number;
  complexity: number;
};

function mergeOptionList(options: string[] | undefined, currentValue: string): string[] {
  const merged = [...(options ?? [])];
  const trimmed = currentValue.trim();
  if (trimmed && !merged.includes(trimmed)) {
    merged.unshift(trimmed);
  }
  return merged;
}

function OwnerWorkloadPopover({
  rows,
  currentOwner,
}: {
  rows: OwnerRankingRow[];
  currentOwner: string;
}) {
  if (rows.length === 0) return null;

  return (
    <div className="absolute bottom-full left-0 z-30 mb-1 w-full min-w-[220px] rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
      <div className="mb-1.5 text-xs font-semibold text-slate-700">成员负载排行（未完成）</div>
      <table className="w-full table-fixed text-[11px]">
        <thead>
          <tr className="border-b border-slate-200 text-slate-500">
            <th className="px-1 py-0.5 text-left font-medium">负责人</th>
            <th className="px-1 py-0.5 text-center font-medium">条数</th>
            <th className="px-1 py-0.5 text-center font-medium">工作日</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const active = currentOwner.trim() === row.owner;
            return (
              <tr
                key={row.owner}
                className={active ? "bg-amber-50 font-semibold text-amber-900" : "text-slate-800"}
              >
                <td className="px-1 py-0.5 break-words">{row.owner}</td>
                <td className="px-1 py-0.5 text-center tabular-nums">{row.count}</td>
                <td className="px-1 py-0.5 text-center tabular-nums">
                  {formatNumber(row.complexity)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SelectOrInput({
  label,
  name,
  value,
  options,
  onChange,
  manageLabel,
  onManage,
  readOnly = false,
  showOwnerWorkload = false,
  ownerWorkloadRows = [],
}: {
  label: string;
  name: keyof ProjectFormValues;
  value: string;
  options?: string[];
  onChange: (name: keyof ProjectFormValues, value: string) => void;
  manageLabel?: string;
  onManage?: () => void;
  readOnly?: boolean;
  showOwnerWorkload?: boolean;
  ownerWorkloadRows?: OwnerRankingRow[];
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [showAllOptions, setShowAllOptions] = useState(false);

  const allOptions = useMemo(() => mergeOptionList(options, value), [options, value]);

  const visibleOptions = useMemo(() => {
    if (showAllOptions || !value.trim()) return allOptions;
    const query = value.trim().toLowerCase();
    return allOptions.filter((option) => option.toLowerCase().includes(query));
  }, [allOptions, value, showAllOptions]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setShowAllOptions(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  function openDropdown() {
    if (readOnly) return;
    setOpen(true);
    setShowAllOptions(true);
  }

  function pickOption(option: string) {
    onChange(name, option);
    setOpen(false);
    setShowAllOptions(false);
  }

  return (
    <div ref={wrapRef} className="relative block">
      {showOwnerWorkload && open ? (
        <OwnerWorkloadPopover rows={ownerWorkloadRows} currentOwner={value} />
      ) : null}
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
          value={value}
          disabled={readOnly}
          onFocus={openDropdown}
          onClick={openDropdown}
          onChange={(e) => {
            onChange(name, e.target.value);
            setShowAllOptions(false);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              setShowAllOptions(false);
            }
          }}
          className={INPUT_CLASS}
          placeholder={allOptions.length > 0 ? "可选择或手动输入" : undefined}
          autoComplete="off"
        />
      </label>
      {open && !readOnly && visibleOptions.length > 0 ? (
        <ul
          className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg"
          role="listbox"
        >
          {visibleOptions.map((option) => (
            <li key={option}>
              <button
                type="button"
                role="option"
                aria-selected={option === value}
                className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-slate-100 ${
                  option === value ? "bg-slate-50 font-medium text-slate-900" : "text-slate-700"
                }`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => pickOption(option)}
              >
                {option}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
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

type DictionaryTab = "type" | "typeDetail" | "commonRemark" | "owner";

function DictionaryManager({
  dict,
  selectedType,
  initialTab = "type",
  onClose,
  onUpdated,
  readOnly = false,
}: {
  dict: DictionaryMap;
  selectedType: string;
  initialTab?: DictionaryTab;
  onClose: () => void;
  onUpdated: (next: DictionaryMap) => void;
  readOnly?: boolean;
}) {
  const [tab, setTab] = useState<DictionaryTab>(initialTab);
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
      const category = tab === "commonRemark" ? COMMON_REMARK_CATEGORY : tab;
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
      const category = tab === "commonRemark" ? COMMON_REMARK_CATEGORY : tab;
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
  const remarkList = dict.commonRemark ?? [];
  const ownerList = dict.owner ?? [];
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
              ["owner", "负责人"],
              ["commonRemark", "常用备注"],
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
            : tab === "commonRemark"
              ? remarkList
              : tab === "owner"
                ? ownerList
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
            : tab === "commonRemark"
              ? remarkList
              : tab === "owner"
                ? ownerList
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
  const [dictTab, setDictTab] = useState<DictionaryTab>("type");
  const [ownerWorkloadRows, setOwnerWorkloadRows] = useState<OwnerRankingRow[]>([]);

  function openDictManager(tab: DictionaryTab) {
    setDictTab(tab);
    setDictOpen(true);
  }

  const loadDict = useCallback(() => {
    fetch("/api/dictionaries")
      .then((r) => r.json())
      .then(setDict)
      .catch(() => setDict({}));
  }, []);

  useEffect(() => {
    loadDict();
  }, [loadDict]);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((response) => response.json())
      .then((data: { ownerRanking?: OwnerRankingRow[] }) => {
        setOwnerWorkloadRows((data.ownerRanking ?? []).slice(0, 8));
      })
      .catch(() => setOwnerWorkloadRows([]));
  }, []);

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
            onManage={canWrite ? () => openDictManager("type") : undefined}
          />
          <SelectOrInput
            label="类型细化"
            name="typeDetail"
            value={form.typeDetail}
            options={typeDetailOptions}
            onChange={update}
            readOnly={!canWrite}
            onManage={canWrite ? () => openDictManager("typeDetail") : undefined}
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
            onManage={canWrite ? () => openDictManager("owner") : undefined}
            showOwnerWorkload
            ownerWorkloadRows={ownerWorkloadRows}
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
            options={dict.commonRemark}
            onChange={update}
            readOnly={!canWrite}
            onManage={canWrite ? () => openDictManager("commonRemark") : undefined}
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
          key={dictTab}
          dict={dict}
          selectedType={form.type}
          initialTab={dictTab}
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
