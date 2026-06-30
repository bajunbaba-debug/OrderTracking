import { formatDateInput } from "./format";

export interface ProjectFormValues {
  type: string;
  typeDetail: string;
  contractNo: string;
  productionInstructionNo: string;
  projectName: string;
  model: string;
  quantity: string;
  publishDate: string;
  assignDate: string;
  designCompleteDate: string;
  dueDate: string;
  owner: string;
  estimatedComplexity: string;
  solutionOwner: string;
  sales: string;
  commonRemark: string;
  extraRemark: string;
}

/** 将数据库记录转为表单初始值（可在服务端安全调用） */
export function projectToFormValues(item: Record<string, unknown>): ProjectFormValues {
  return {
    type: String(item.type ?? ""),
    typeDetail: String(item.typeDetail ?? ""),
    contractNo: String(item.contractNo ?? ""),
    productionInstructionNo: String(item.productionInstructionNo ?? ""),
    projectName: String(item.projectName ?? ""),
    model: String(item.model ?? ""),
    quantity: item.quantity != null ? String(item.quantity) : "",
    publishDate: formatDateInput(item.publishDate as string | Date | null),
    assignDate: formatDateInput(item.assignDate as string | Date | null),
    designCompleteDate: formatDateInput(item.designCompleteDate as string | Date | null),
    dueDate: formatDateInput(item.dueDate as string | Date | null),
    owner: String(item.owner ?? ""),
    estimatedComplexity:
      item.estimatedComplexity != null ? String(item.estimatedComplexity) : "",
    solutionOwner: String(item.solutionOwner ?? ""),
    sales: String(item.sales ?? ""),
    commonRemark: String(item.commonRemark ?? ""),
    extraRemark: String(item.extraRemark ?? ""),
  };
}
