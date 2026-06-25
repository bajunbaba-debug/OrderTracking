import { daysBetween } from "@/lib/calculations";
import { formatDate, normalizeOwnerKey, parseDateInput } from "@/lib/format";
import type {
  MemberTimelineSummary,
  RelatedOrderItem,
  ScheduledBlock,
  TimelineIncident,
  TimelineOrderState,
  TimelineOrderStatus,
  TimelinePersistedState,
  TimelineProjectBase,
  TimelineRiskType,
  TimelineSearchResult,
} from "./types";
import {
  resolveProcessedTime,
  roundTimelineTenth,
} from "./order-state";
import {
  addWorkDays,
  addCalendarDays,
  alignToWorkday,
  calendarDaysBetween,
  createWorkdayLookup,
  nextWorkdayAfter,
  type WorkdayLookup,
} from "./workdays";

export {
  addWorkDays,
  formatWorkdayRuleLabel,
  getMemberWorkdayConfig,
  getConfigurableWeeks,
  getOwnerWeeklyConfig,
  createWorkdayLookup,
  formatWeekRuleLabel,
} from "./workdays";
export { calendarDaysBetween } from "./workdays";
export { daysBetween } from "@/lib/calculations";
export {
  roundTimelineTenth,
  resetToInitialPending,
  unmarkInProgressKeepProcessedTime,
} from "./order-state";
export { splitDateRange } from "./date-segments";

function getQueuePosition(
  projectId: string,
  owner: string,
  orderStates: TimelineOrderState[]
): { index: number; total: number } | null {
  const ownerStates = orderStates
    .filter((s) => s.owner === owner && s.status !== "complete")
    .sort((a, b) => {
      const af = a.status === "frozen" ? 1 : 0;
      const bf = b.status === "frozen" ? 1 : 0;
      if (af !== bf) return af - bf;
      return a.queueIndex - b.queueIndex;
    });
  const idx = ownerStates.findIndex((s) => s.projectId === projectId);
  return idx >= 0 ? { index: idx, total: ownerStates.length } : null;
}

/** 计算订单有效排程天数（工作日） */
export function effectiveDuration(
  estimatedDays: number,
  state: TimelineOrderState | undefined
): number {
  if (!state) return estimatedDays;
  const k = roundTimelineTenth(Math.max(0, Math.min(estimatedDays, state.processedTime)));

  if (state.status === "frozen" || state.restartExtra > 0) {
    const q = roundTimelineTenth(Math.max(0, state.restartExtra));
    return roundTimelineTenth(Math.max(0, q + estimatedDays - k));
  }
  if (state.status === "in_progress" || k > 0) {
    return roundTimelineTenth(Math.max(0, estimatedDays - k));
  }
  return estimatedDays;
}

/** 人员活跃队列（不含已完成/已冻结），按 queueIndex 排序 */
export function getOwnerActiveQueueStates(
  owner: string,
  orderStates: TimelineOrderState[]
): TimelineOrderState[] {
  return orderStates
    .filter((s) => s.owner === owner && s.status !== "complete" && s.status !== "frozen")
    .sort((a, b) => a.queueIndex - b.queueIndex);
}

/** 时间流展示用队列顺序：活跃项在前，冻结项统一排末尾 */
export function getOwnerQueueProjects(
  owner: string,
  projects: TimelineProjectBase[],
  orderStates: TimelineOrderState[],
  options?: { includeFrozen?: boolean }
): TimelineProjectBase[] {
  const projectMap = new Map(projects.map((p) => [p.id, p]));
  const includeFrozen = options?.includeFrozen !== false;

  const sorted = orderStates
    .filter((s) => s.owner === owner && s.status !== "complete")
    .filter((s) => includeFrozen || s.status !== "frozen")
    .sort((a, b) => {
      const af = a.status === "frozen" ? 1 : 0;
      const bf = b.status === "frozen" ? 1 : 0;
      if (af !== bf) return af - bf;
      return a.queueIndex - b.queueIndex;
    });

  return sorted
    .map((s) => projectMap.get(s.projectId))
    .filter((p): p is TimelineProjectBase => Boolean(p));
}

export function isActiveQueueHead(
  projectId: string,
  owner: string,
  orderStates: TimelineOrderState[]
): boolean {
  const active = getOwnerActiveQueueStates(owner, orderStates);
  return active.length > 0 && active[0].projectId === projectId;
}

function defaultOrderState(project: TimelineProjectBase, index: number): TimelineOrderState {
  const isComplete = project.designStatus === "complete";
  return {
    projectId: project.id,
    owner: normalizeOwnerKey(project.owner),
    queueIndex: index,
    status: isComplete ? "complete" : "pending",
    isPriorityInsert: false,
    processedTime: 0,
    restartExtra: 0,
    workStartDate: null,
    priorityReason: "",
    freezeReason: "",
    frozenAt: null,
    freezeByPriority: false,
    freezeByIncident: false,
    freezeNote: "",
    restartNote: "",
    lastProgressUpdate: null,
  };
}

export function initOrderStates(
  projects: TimelineProjectBase[],
  existing: TimelineOrderState[]
): TimelineOrderState[] {
  const existingMap = new Map(existing.map((s) => [s.projectId, s]));
  const byOwner = new Map<string, TimelineProjectBase[]>();

  for (const p of projects) {
    const owner = normalizeOwnerKey(p.owner);
    const list = byOwner.get(owner) ?? [];
    list.push(p);
    byOwner.set(owner, list);
  }

  const result: TimelineOrderState[] = [];

  for (const [, list] of byOwner) {
    const incomplete = list
      .filter((p) => p.designStatus !== "complete")
      .sort((a, b) => {
        const da = a.dueDate ?? "9999-12-31";
        const db = b.dueDate ?? "9999-12-31";
        return da.localeCompare(db);
      });

    incomplete.forEach((p, i) => {
      const prev = existingMap.get(p.id);
      if (prev) {
        result.push({
          ...prev,
          owner: normalizeOwnerKey(p.owner),
          processedTime: resolveProcessedTime(prev, p.estimatedDays),
        });
      } else {
        result.push(defaultOrderState(p, i * 10));
      }
    });

    for (const p of list.filter((x) => x.designStatus === "complete")) {
      const prev = existingMap.get(p.id);
      result.push(prev ?? { ...defaultOrderState(p, 9999), status: "complete" });
    }
  }

  return result;
}

interface StreamEntry {
  kind: "order" | "incident";
  queueIndex: number;
  order?: TimelineProjectBase;
  state?: TimelineOrderState;
  incident?: TimelineIncident;
}

function buildStream(
  owner: string,
  projects: TimelineProjectBase[],
  orderStates: TimelineOrderState[],
  incidents: TimelineIncident[]
): StreamEntry[] {
  const projectMap = new Map(projects.map((p) => [p.id, p]));
  const stateMap = new Map(orderStates.filter((s) => s.owner === owner).map((s) => [s.projectId, s]));

  const activeOrders: StreamEntry[] = [];
  const frozenOrders: StreamEntry[] = [];

  for (const [pid, state] of stateMap) {
    if (state.status === "complete") continue;
    const project = projectMap.get(pid);
    if (!project || project.designStatus === "complete") continue;
    const entry: StreamEntry = { kind: "order", queueIndex: state.queueIndex, order: project, state };
    if (state.status === "frozen") {
      frozenOrders.push(entry);
    } else {
      activeOrders.push(entry);
    }
  }

  activeOrders.sort((a, b) => a.queueIndex - b.queueIndex);
  frozenOrders.sort((a, b) => a.queueIndex - b.queueIndex);

  const activeWithIncidents: StreamEntry[] = [...activeOrders];
  for (const inc of incidents.filter((i) => i.owner === owner)) {
    activeWithIncidents.push({
      kind: "incident",
      queueIndex: inc.insertBeforeQueueIndex - 0.5,
      incident: inc,
    });
  }
  activeWithIncidents.sort((a, b) => a.queueIndex - b.queueIndex);

  return [...activeWithIncidents, ...frozenOrders];
}

function detectOrderRisks(
  endDate: string,
  dueDate: string | null,
  state: TimelineOrderState,
  duration: number,
  estimatedDays: number,
  affectedByIncident: boolean
): TimelineRiskType[] {
  const risks: TimelineRiskType[] = [];
  if (dueDate && endDate > dueDate) risks.push("delay");
  if (state.isPriorityInsert && dueDate && endDate > dueDate) risks.push("priority_insert_delay");
  if (state.status === "frozen" && state.frozenAt) {
    const frozenDays = daysBetween(parseDateInput(state.frozenAt)!, new Date());
    if (frozenDays > 5) risks.push("freeze_too_long");
  }
  if (state.restartExtra > estimatedDays * 0.5) risks.push("restart_too_long");
  if (affectedByIncident && dueDate && endDate > dueDate) risks.push("incident_delay");
  if (duration > estimatedDays * 1.5) risks.push("stale_progress");
  return risks;
}

export function computeMemberSchedule(
  owner: string,
  projects: TimelineProjectBase[],
  orderStates: TimelineOrderState[],
  incidents: TimelineIncident[],
  timelineToday: string,
  _memberWorkStarts: Record<string, string>,
  workdayLookup: WorkdayLookup
): ScheduledBlock[] {
  const stream = buildStream(owner, projects, orderStates, incidents);
  const blocks: ScheduledBlock[] = [];

  let cursor = alignToWorkday(timelineToday, workdayLookup);

  for (const entry of stream) {
    if (entry.kind === "incident" && entry.incident) {
      const inc = entry.incident;
      const start = alignToWorkday(inc.startDate || cursor, workdayLookup);
      const end = addWorkDays(start, inc.durationDays, workdayLookup);
      blocks.push({
        kind: "incident",
        id: inc.id,
        incidentId: inc.id,
        owner,
        label: inc.name,
        subLabel: inc.description,
        typeLabel: "突发事件",
        startDate: start,
        endDate: end,
        durationDays: inc.durationDays,
        dueDate: null,
        status: "incident",
        isPriorityInsert: false,
        isFrozen: false,
        isRestarted: false,
        isDelayed: false,
        affectedByIncident: false,
        estimatedDays: inc.durationDays,
        processedTime: 0,
        risks: [],
        queueIndex: inc.insertBeforeQueueIndex,
      });
      cursor = nextWorkdayAfter(end, workdayLookup);
      continue;
    }

    const project = entry.order!;
    const state = entry.state!;
    const estimated = project.estimatedDays;
    let start = cursor;

    if (state.status === "in_progress" && state.workStartDate) {
      const ws = alignToWorkday(state.workStartDate, workdayLookup);
      start = ws > cursor ? ws : cursor;
    } else if (state.status === "frozen") {
      start = cursor;
    }

    const duration = effectiveDuration(estimated, state);
    if (duration <= 0 && state.status === "frozen") {
      blocks.push({
        kind: "order",
        id: project.id,
        projectId: project.id,
        owner,
        label: project.contractNo || project.projectName,
        subLabel: project.model,
        typeLabel: project.type,
        startDate: start,
        endDate: start,
        durationDays: 0,
        dueDate: project.dueDate,
        status: "frozen",
        isPriorityInsert: state.isPriorityInsert,
        isFrozen: true,
        isRestarted: state.restartExtra > 0,
        isDelayed: Boolean(project.dueDate && start > project.dueDate),
        affectedByIncident: incidents.some(
          (i) => i.owner === owner && i.affectedOrderIds.includes(project.id)
        ),
        estimatedDays: estimated,
        processedTime: state.processedTime,
        risks: detectOrderRisks(start, project.dueDate, state, 0, estimated, false),
        queueIndex: state.queueIndex,
      });
      continue;
    }

    const end = addWorkDays(start, duration, workdayLookup);
    const affected = incidents.some(
      (i) => i.owner === owner && i.affectedOrderIds.includes(project.id)
    );
    const risks = detectOrderRisks(end, project.dueDate, state, duration, estimated, affected);

    blocks.push({
      kind: "order",
      id: project.id,
      projectId: project.id,
      owner,
      label: project.contractNo || project.projectName,
      subLabel: project.model,
      typeLabel: project.type,
      startDate: start,
      endDate: end,
      durationDays: duration,
      dueDate: project.dueDate,
      status: state.status,
      isPriorityInsert: state.isPriorityInsert,
      isFrozen: state.status === "frozen",
      isRestarted: state.restartExtra > 0,
      isDelayed: Boolean(project.dueDate && end > project.dueDate),
      affectedByIncident: affected,
      estimatedDays: estimated,
      processedTime: state.processedTime,
      risks,
      queueIndex: state.queueIndex,
    });

    cursor = nextWorkdayAfter(end, workdayLookup);
  }

  return blocks;
}

export function computeAllSchedules(
  projects: TimelineProjectBase[],
  persisted: TimelinePersistedState,
  timelineToday: string
): Map<string, ScheduledBlock[]> {
  const owners = [...new Set(projects.map((p) => normalizeOwnerKey(p.owner)))].sort();
  const map = new Map<string, ScheduledBlock[]>();
  const weekly = persisted.memberWeeklyWorkdayConfig ?? {};
  const legacy = persisted.memberWorkdayConfig ?? {};
  for (const owner of owners) {
    const lookup = createWorkdayLookup(owner, weekly, legacy);
    map.set(
      owner,
      computeMemberSchedule(
        owner,
        projects,
        persisted.orderStates,
        persisted.incidents,
        timelineToday,
        persisted.memberWorkStarts,
        lookup
      )
    );
  }
  return map;
}

export function summarizeMember(
  owner: string,
  projects: TimelineProjectBase[],
  schedule: ScheduledBlock[]
): MemberTimelineSummary {
  const incomplete = projects.filter(
    (p) => normalizeOwnerKey(p.owner) === owner && p.designStatus !== "complete"
  );
  const pending = schedule.filter((b) => b.kind === "order" && b.status !== "complete");
  const risks = schedule.flatMap((b) => b.risks);
  const inProgress = schedule.find((b) => b.status === "in_progress");

  const dueDates = incomplete
    .map((p) => p.dueDate)
    .filter(Boolean)
    .sort() as string[];

  const totalDays = pending.reduce((s, b) => s + b.durationDays, 0);
  let loadStatus: MemberTimelineSummary["loadStatus"] = "normal";
  if (totalDays > 30 || risks.length > 5) loadStatus = "critical";
  else if (totalDays > 15 || risks.length > 2) loadStatus = "high";

  return {
    owner,
    pendingCount: incomplete.length,
    earliestDue: dueDates[0] ?? null,
    riskCount: risks.length,
    currentOrder: inProgress?.label ?? null,
    loadStatus,
    totalPendingDays: totalDays,
  };
}

function buildSearchResult(
  p: TimelineProjectBase,
  schedules: Map<string, ScheduledBlock[]>,
  orderStates: TimelineOrderState[]
): TimelineSearchResult {
  const owner = normalizeOwnerKey(p.owner);
  const schedule = schedules.get(owner) ?? [];
  const block = schedule.find((b) => b.projectId === p.id);
  const state = orderStates.find((s) => s.projectId === p.id);
  return {
    projectId: p.id,
    contractNo: p.contractNo,
    model: p.model,
    type: p.type,
    owner,
    startDate: block?.startDate ?? null,
    endDate: block?.endDate ?? null,
    dueDate: p.dueDate,
    estimatedDays: p.estimatedDays,
    status: state?.status ?? (p.designStatus === "complete" ? "complete" : "pending"),
    isPriorityInsert: state?.isPriorityInsert ?? false,
    isFrozen: state?.status === "frozen",
    affectedByIncident: block?.affectedByIncident ?? false,
    queuePosition: getQueuePosition(p.id, owner, orderStates),
  };
}

/** 解析搜索框输入：无 / 为单项，有 / 为多项 */
export function parseOrderSearchTerms(query: string): string[] {
  if (!query.includes("/")) {
    const single = query.trim();
    return single ? [single] : [];
  }
  return query
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);
}

/** 合同号是否命中搜索项（纯数字用分段/后缀精确匹配，避免 172→182、150→151 误命中） */
function contractNoMatchesSearchTerm(contractNo: string, term: string): boolean {
  const cn = contractNo.trim().toLowerCase();
  const q = term.trim().toLowerCase();
  if (!cn || !q) return false;
  if (cn === q) return true;

  const isNumericTerm = /^\d+$/.test(term.trim());
  const segments = cn.split(/[/\-_.\\\s]+/).filter(Boolean);

  if (segments.some((segment) => segment === q)) return true;

  if (isNumericTerm) {
    for (const segment of segments) {
      const trailingDigits = segment.match(/(\d+)$/);
      if (trailingDigits?.[1] === q) return true;
      if (/^\d+$/.test(segment) && segment.endsWith(q)) {
        const prefix = segment.slice(0, -q.length);
        if (prefix.length > 0 && /^\d+$/.test(prefix)) return true;
      }
    }
    return false;
  }

  return cn.includes(q) || segments.some((segment) => segment.includes(q));
}

/** 单项是否匹配：合同号(项目名) 需合同号命中且项目名包含括号内文本；否则合同号或项目名分别匹配后汇总 */
export function projectMatchesOrderSearchTerm(
  project: TimelineProjectBase,
  term: string
): boolean {
  const trimmed = term.trim();
  if (!trimmed) return false;

  const contractNo = project.contractNo;
  const projectName = project.projectName.toLowerCase();
  const parenMatch = trimmed.match(/^(.+?)\((.+)\)$/);

  if (parenMatch) {
    const contractPart = parenMatch[1].trim();
    const projectPart = parenMatch[2].trim().toLowerCase();
    if (!contractPart || !projectPart) return false;
    return (
      contractNoMatchesSearchTerm(contractNo, contractPart) &&
      projectName.includes(projectPart)
    );
  }

  const q = trimmed.toLowerCase();
  const contractMatched = contractNoMatchesSearchTerm(contractNo, trimmed);
  // 纯数字只匹配合同号，避免项目名含 150 时误带出 151 等订单
  if (/^\d+$/.test(trimmed)) return contractMatched;
  return contractMatched || projectName.includes(q);
}

export function searchOrder(
  query: string,
  projects: TimelineProjectBase[],
  schedules: Map<string, ScheduledBlock[]>,
  orderStates: TimelineOrderState[],
  filters?: {
    ownerFilter?: string;
    departmentFilter?: string;
    dateFrom?: string;
    dateTo?: string;
  }
): TimelineSearchResult[] {
  const terms = parseOrderSearchTerms(query);
  if (terms.length === 0) return [];

  if (filters?.departmentFilter === "管理部") return [];

  const results: TimelineSearchResult[] = [];
  for (const p of projects) {
    if (!terms.some((term) => projectMatchesOrderSearchTerm(p, term))) {
      continue;
    }
    const owner = normalizeOwnerKey(p.owner);
    if (filters?.ownerFilter && owner !== filters.ownerFilter) continue;

    const result = buildSearchResult(p, schedules, orderStates);

    if (filters?.dateFrom && result.endDate && result.endDate < filters.dateFrom) continue;
    if (filters?.dateTo && result.startDate && result.startDate > filters.dateTo) continue;

    results.push(result);
  }

  return results.sort((a, b) => a.owner.localeCompare(b.owner) || a.contractNo.localeCompare(b.contractNo));
}

/** 同订单号（contractNo）的全部处理项次 */
export function getRelatedOrderItems(
  contractNo: string,
  projects: TimelineProjectBase[],
  schedules: Map<string, ScheduledBlock[]>,
  orderStates: TimelineOrderState[],
  excludeProjectId?: string
): RelatedOrderItem[] {
  const normalized = contractNo.trim();
  if (!normalized) return [];

  return projects
    .filter((p) => p.contractNo === normalized && p.id !== excludeProjectId)
    .map((p) => buildSearchResult(p, schedules, orderStates))
    .sort((a, b) => a.owner.localeCompare(b.owner));
}

export function getDateRange(
  schedules: Map<string, ScheduledBlock[]>,
  timelineStart: string
): {
  start: string;
  end: string;
  totalDays: number;
} {
  let min = timelineStart;
  let max = timelineStart;

  for (const blocks of schedules.values()) {
    for (const b of blocks) {
      if (b.startDate < min) min = b.startDate;
      if (b.endDate > max) max = b.endDate;
    }
  }

  const span = Math.max(21, calendarDaysBetween(min, max) + 7);
  const end = addCalendarDays(min, span - 1);
  return { start: min, end, totalDays: span };
}

export function projectToTimelineBase(p: {
  id: string;
  contractNo: string;
  projectName: string;
  model: string;
  type: string;
  owner: string;
  dueDate: string | Date | null;
  totalComplexity: number;
  estimatedComplexity?: number | null;
  designStatus: string;
  designCompleteDate: string | Date | null;
}): TimelineProjectBase {
  return {
    id: p.id,
    contractNo: p.contractNo,
    projectName: p.projectName,
    model: p.model,
    type: p.type,
    owner: normalizeOwnerKey(p.owner),
    dueDate: p.dueDate ? formatDate(p.dueDate) : null,
    estimatedDays: p.totalComplexity ?? p.estimatedComplexity ?? 0,
    designStatus: p.designStatus,
    designCompleteDate: p.designCompleteDate ? formatDate(p.designCompleteDate) : null,
  };
}

export const RISK_TYPE_LABELS: Record<TimelineRiskType, string> = {
  delay: "预计完成晚于交货日期",
  priority_insert_delay: "插单导致后续订单延期",
  freeze_too_long: "冻结时间过长",
  restart_too_long: "再次启动时间 q 过长",
  incident_delay: "突发事件导致延期",
  overload: "人员负载过高",
  stale_progress: "当前订单长时间未更新进度",
};

export const STATUS_LABELS: Record<TimelineOrderStatus | "incident", string> = {
  pending: "未处理",
  in_progress: "正在处理",
  frozen: "已冻结",
  complete: "已完成",
  incident: "突发事件",
};
