/** 订单时间流 — 类型定义 */

export type TimelineOrderStatus = "pending" | "in_progress" | "frozen" | "complete";

export type TimelineRiskType =
  | "delay"
  | "priority_insert_delay"
  | "freeze_too_long"
  | "restart_too_long"
  | "incident_delay"
  | "overload"
  | "stale_progress";

export interface TimelineProjectBase {
  id: string;
  contractNo: string;
  projectName: string;
  model: string;
  type: string;
  owner: string;
  dueDate: string | null;
  estimatedDays: number;
  designStatus: string;
  designCompleteDate: string | null;
}

/** 前端扩展状态（localStorage） */
export interface TimelineOrderState {
  projectId: string;
  owner: string;
  /** 队列序号，越小越靠前 */
  queueIndex: number;
  status: TimelineOrderStatus;
  isPriorityInsert: boolean;
  /** 已处理时间 k（工作日，0.1 步进） */
  processedTime: number;
  /** 再次启动额外时间 */
  restartExtra: number;
  /** 标记当前处理时的开始日期 yyyy-MM-dd */
  workStartDate: string | null;
  /** 插单原因 */
  priorityReason: string;
  /** 冻结原因 */
  freezeReason: string;
  frozenAt: string | null;
  freezeByPriority: boolean;
  freezeByIncident: boolean;
  freezeNote: string;
  restartNote: string;
  /** 最后进度更新时间 */
  lastProgressUpdate: string | null;
}

export interface TimelineIncident {
  id: string;
  name: string;
  owner: string;
  startDate: string;
  durationDays: number;
  affectedOrderIds: string[];
  description: string;
  /** 插入位置：在此 queueIndex 之前 */
  insertBeforeQueueIndex: number;
  createdAt: string;
  createdBy: string;
}

export interface TimelineOperationLog {
  id: string;
  operator: string;
  operatorRole: "admin" | "member";
  timestamp: string;
  action:
    | "reorder"
    | "priority_insert"
    | "freeze"
    | "restart"
    | "update_estimate"
    | "set_work_start"
    | "create_incident"
    | "change_owner"
    | "admin_intervention"
    | "unfreeze"
    | "unmark_progress";
  before: string;
  after: string;
  reason: string;
  affectedCount: number;
}

export interface TimelinePersistedState {
  orderStates: TimelineOrderState[];
  incidents: TimelineIncident[];
  operationLogs: TimelineOperationLog[];
  /** 人员当前处理开始基准（无单独订单标记时的 fallback） */
  memberWorkStarts: Record<string, string>;
  /** 人员周末工作配置（兼容旧数据：缺省为周六/日均休息） */
  memberWorkdayConfig?: Record<string, import("./workdays").MemberWorkdayConfig>;
  /** 按周配置：memberWeeklyWorkdayConfig[owner][weekStartMonday] */
  memberWeeklyWorkdayConfig?: import("./workdays").MemberWeeklyWorkdayStore;
}

/** 排程后的时间块 */
export interface ScheduledBlock {
  kind: "order" | "incident";
  id: string;
  owner: string;
  label: string;
  subLabel: string;
  typeLabel: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  dueDate: string | null;
  status: TimelineOrderStatus | "incident";
  isPriorityInsert: boolean;
  isFrozen: boolean;
  isRestarted: boolean;
  isDelayed: boolean;
  affectedByIncident: boolean;
  projectId?: string;
  incidentId?: string;
  estimatedDays: number;
  /** 已处理时间 k，用于色块进度表现 */
  processedTime: number;
  risks: TimelineRiskType[];
  queueIndex: number;
}

export interface MemberTimelineSummary {
  owner: string;
  pendingCount: number;
  earliestDue: string | null;
  riskCount: number;
  currentOrder: string | null;
  loadStatus: "normal" | "high" | "critical";
  totalPendingDays: number;
}

export interface TimelineSearchResult {
  projectId: string;
  contractNo: string;
  model: string;
  type: string;
  owner: string;
  startDate: string | null;
  endDate: string | null;
  dueDate: string | null;
  estimatedDays: number;
  status: TimelineOrderStatus;
  isPriorityInsert: boolean;
  isFrozen: boolean;
  affectedByIncident: boolean;
  queuePosition: { index: number; total: number } | null;
}

/** 同订单号在其他人员名下的处理项次 */
export type RelatedOrderItem = TimelineSearchResult;

export type UserRole = "admin" | "member" | "guest";

export interface AuthUser {
  id: string;
  name: string;
  role: UserRole;
  department: string;
}
