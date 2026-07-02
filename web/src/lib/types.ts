export interface RawProjectRow {
  sourceRowNumber?: number;
  uuid: string;
  type: string;
  typeDetail: string;
  contractNo: string;
  productionInstructionNo: string;
  projectName: string;
  model: string;
  quantity: number | null;
  publishDate: Date | null;
  assignDate: Date | null;
  designCompleteDate: Date | null;
  dueDate: Date | null;
  owner: string;
  estimatedComplexity: number | null;
  solutionOwner: string;
  sales: string;
  commonRemark: string;
  extraRemark: string;
}

export interface ComputedFields {
  designStatus: string;
  totalComplexity: number;
  dueBucket: string;
  waitingDays: number | null;
  designCycleDays: number | null;
  parsedModelQuantity: number | null;
  technicalComplexityP1: number | null;
  typeBaselineP10: number | null;
  quantityComplexityP2: number | null;
  comfortBaselineP20: number;
  p1DeviationRate: number | null;
  p2DeviationRate: number | null;
  riskLevel: string;
  riskTags: string[];
  qualityIssues: string[];
}

export type ProjectItemRecord = RawProjectRow & ComputedFields & { id?: string };

export const RISK_LABELS: Record<string, string> = {
  red: "红色",
  orange: "橙色",
  yellow: "黄色",
  algorithm: "预计异常",
  data_anomaly: "数据异常",
  green: "绿色",
};

export const DESIGN_STATUS_LABELS: Record<string, string> = {
  incomplete: "未完成",
  complete: "已完成",
};

export const DUE_BUCKET_COLORS: Record<string, string> = {
  已超期: "bg-red-100 text-red-800",
  "7天内": "bg-orange-100 text-orange-800",
  "8-14天": "bg-yellow-100 text-yellow-800",
  "15天以上": "bg-green-100 text-green-800",
  交期缺失: "bg-gray-100 text-gray-700",
  已完成: "bg-slate-100 text-slate-600",
};

/** 预计异常（原算法关注）悬浮说明 */
export const RISK_TOOLTIPS: Record<string, string> = {
  algorithm:
    "该项目的单位工作量或预计(工作日)明显高于参考阈值，需要人工确认",
};

export const RISK_COLORS: Record<string, string> = {
  red: "bg-red-100 text-red-800 border-red-200",
  orange: "bg-orange-100 text-orange-800 border-orange-200",
  yellow: "bg-yellow-100 text-yellow-800 border-yellow-200",
  algorithm: "bg-purple-100 text-purple-800 border-purple-200",
  data_anomaly: "bg-gray-100 text-gray-800 border-gray-300",
  green: "bg-green-100 text-green-700 border-green-200",
};
