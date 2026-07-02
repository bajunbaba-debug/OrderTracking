import { parseDateInput } from "./format";
import type { RawProjectRow } from "./types";

export function normalizeUuid(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

export function parseProjectBody(body: Record<string, unknown>): RawProjectRow {
  return {
    uuid: normalizeUuid(body.uuid),
    type: String(body.type ?? "").trim(),
    typeDetail: String(body.typeDetail ?? "").trim(),
    contractNo: String(body.contractNo ?? "").trim(),
    productionInstructionNo: String(body.productionInstructionNo ?? "").trim(),
    projectName: String(body.projectName ?? "").trim(),
    model: String(body.model ?? "").trim(),
    quantity: body.quantity != null && body.quantity !== "" ? Number(body.quantity) : null,
    publishDate: parseDateInput(String(body.publishDate ?? "")),
    assignDate: parseDateInput(String(body.assignDate ?? "")),
    designCompleteDate: parseDateInput(String(body.designCompleteDate ?? "")),
    dueDate: parseDateInput(String(body.dueDate ?? "")),
    owner: String(body.owner ?? "").trim(),
    estimatedComplexity:
      body.estimatedComplexity != null && body.estimatedComplexity !== ""
        ? Number(body.estimatedComplexity)
        : null,
    solutionOwner: String(body.solutionOwner ?? "").trim(),
    sales: String(body.sales ?? "").trim(),
    commonRemark: String(body.commonRemark ?? "").trim(),
    extraRemark: String(body.extraRemark ?? "").trim(),
  };
}

export function mergeProjectBody(
  existing: RawProjectRow,
  body: Record<string, unknown>
): RawProjectRow {
  const parsed = parseProjectBody(body);
  return {
    type: body.type !== undefined ? parsed.type : existing.type,
    uuid: body.uuid !== undefined ? parsed.uuid : existing.uuid,
    typeDetail: body.typeDetail !== undefined ? parsed.typeDetail : existing.typeDetail,
    contractNo: body.contractNo !== undefined ? parsed.contractNo : existing.contractNo,
    productionInstructionNo:
      body.productionInstructionNo !== undefined
        ? parsed.productionInstructionNo
        : existing.productionInstructionNo,
    projectName: body.projectName !== undefined ? parsed.projectName : existing.projectName,
    model: body.model !== undefined ? parsed.model : existing.model,
    quantity: body.quantity !== undefined ? parsed.quantity : existing.quantity,
    publishDate: body.publishDate !== undefined ? parsed.publishDate : existing.publishDate,
    assignDate: body.assignDate !== undefined ? parsed.assignDate : existing.assignDate,
    designCompleteDate:
      body.designCompleteDate !== undefined ? parsed.designCompleteDate : existing.designCompleteDate,
    dueDate: body.dueDate !== undefined ? parsed.dueDate : existing.dueDate,
    owner: body.owner !== undefined ? parsed.owner : existing.owner,
    estimatedComplexity:
      body.estimatedComplexity !== undefined
        ? parsed.estimatedComplexity
        : existing.estimatedComplexity,
    solutionOwner: body.solutionOwner !== undefined ? parsed.solutionOwner : existing.solutionOwner,
    sales: body.sales !== undefined ? parsed.sales : existing.sales,
    commonRemark: body.commonRemark !== undefined ? parsed.commonRemark : existing.commonRemark,
    extraRemark: body.extraRemark !== undefined ? parsed.extraRemark : existing.extraRemark,
  };
}

export function dbRecordToRawRow(item: {
  sourceRowNumber: number | null;
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
}): RawProjectRow {
  return {
    sourceRowNumber: item.sourceRowNumber ?? undefined,
    uuid: item.uuid,
    type: item.type,
    typeDetail: item.typeDetail,
    contractNo: item.contractNo,
    productionInstructionNo: item.productionInstructionNo,
    projectName: item.projectName,
    model: item.model,
    quantity: item.quantity,
    publishDate: item.publishDate,
    assignDate: item.assignDate,
    designCompleteDate: item.designCompleteDate,
    dueDate: item.dueDate,
    owner: item.owner,
    estimatedComplexity: item.estimatedComplexity,
    solutionOwner: item.solutionOwner,
    sales: item.sales,
    commonRemark: item.commonRemark,
    extraRemark: item.extraRemark,
  };
}
