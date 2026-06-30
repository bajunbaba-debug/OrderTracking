import type { RawProjectRow } from "./types";

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

export interface DictionaryValidationContext {
  types?: string[];
  typeDetails?: string[];
  typeDetailByType?: Record<string, string[]>;
  owners?: string[];
  commonRemarks?: string[];
}

function isBlank(value: string | null | undefined): boolean {
  return value == null || String(value).trim() === "";
}

function allowedTypeDetails(type: string, dict: DictionaryValidationContext): string[] {
  const mapped = dict.typeDetailByType?.[type];
  if (mapped?.length) return mapped;
  return dict.typeDetails ?? [];
}

export function validateProjectRow(
  row: RawProjectRow,
  dict?: DictionaryValidationContext
): ValidationResult {
  const errors: string[] = [];

  if (isBlank(row.type)) {
    errors.push("请填写类型");
  } else if (dict?.types?.length && !dict.types.includes(row.type)) {
    errors.push(`类型「${row.type}」不在允许范围内`);
  }

  if (!isBlank(row.typeDetail)) {
    const allowed = allowedTypeDetails(row.type, dict ?? {});
    if (allowed.length > 0 && !allowed.includes(row.typeDetail)) {
      errors.push(`类型细化「${row.typeDetail}」与类型「${row.type}」不匹配`);
    }
  }

  if (isBlank(row.contractNo) && isBlank(row.projectName)) {
    errors.push("请填写合同号或项目名称（至少一项）");
  }
  if (row.quantity == null || Number.isNaN(row.quantity)) {
    errors.push("请填写数量");
  }
  if (!row.publishDate) {
    errors.push("请填写发布日期");
  }
  if (!row.dueDate && !row.designCompleteDate) {
    errors.push("请填写交期");
  }
  if (isBlank(row.owner)) {
    errors.push("请填写负责人");
  } else if (dict?.owners?.length && !dict.owners.includes(row.owner)) {
    errors.push(`负责人「${row.owner}」不在允许范围内`);
  }
  if (row.estimatedComplexity == null || Number.isNaN(row.estimatedComplexity)) {
    errors.push("请填写预计");
  }
  if (!isBlank(row.commonRemark) && dict?.commonRemarks?.length && !dict.commonRemarks.includes(row.commonRemark)) {
    errors.push(`常用备注「${row.commonRemark}」不在允许范围内`);
  }

  return { ok: errors.length === 0, errors };
}

export function formatValidationErrors(errors: string[]): string {
  return errors.join("；");
}
