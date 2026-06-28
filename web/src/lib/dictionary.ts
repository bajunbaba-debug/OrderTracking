import { prisma } from "./prisma";

/** Dictionary 表 category 字段（canonical） */
export const DICTIONARY_CATEGORIES = {
  type: "type",
  typeDetail: "typeDetail",
  owner: "owner",
  commonRemark: "commonRemark",
  solutionOwner: "solutionOwner",
  sales: "sales",
} as const;

/** 读取时归一化到 canonical category（兼容旧数据 remark → commonRemark） */
const LEGACY_CATEGORY_ALIASES: Record<string, string> = {
  remark: DICTIONARY_CATEGORIES.commonRemark,
};

/** review-options 响应字段 ← Dictionary category */
export const REVIEW_OPTION_FIELD_BY_CATEGORY = {
  [DICTIONARY_CATEGORIES.type]: "types",
  [DICTIONARY_CATEGORIES.typeDetail]: "typeDetails",
  [DICTIONARY_CATEGORIES.owner]: "owners",
  [DICTIONARY_CATEGORIES.commonRemark]: "commonRemarks",
} as const satisfies Record<string, string>;

export type ReviewOptionField =
  (typeof REVIEW_OPTION_FIELD_BY_CATEGORY)[keyof typeof REVIEW_OPTION_FIELD_BY_CATEGORY];

export interface DictionaryData {
  type?: string[];
  typeDetail?: string[];
  typeDetailByType: Record<string, string[]>;
  owner?: string[];
  commonRemark?: string[];
  solutionOwner?: string[];
  sales?: string[];
}

export interface ReviewOptionsResponse {
  ok: true;
  types: string[];
  typeDetails: string[];
  typeDetailByType: Record<string, string[]>;
  owners: string[];
  commonRemarks: string[];
}

export function normalizeDictionaryCategory(category: string): string {
  return LEGACY_CATEGORY_ALIASES[category] ?? category;
}

export function dictionaryCategoryWriteTargets(category: string): string[] {
  const normalized = normalizeDictionaryCategory(category);
  if (normalized === DICTIONARY_CATEGORIES.commonRemark) {
    return [normalized, "remark"];
  }
  return [normalized];
}

/** 从 Dictionary 表加载已启用项，按 sortOrder 排序并分组 */
export async function getDictionaries(): Promise<DictionaryData> {
  const items = await prisma.dictionary.findMany({
    where: { enabled: true },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
  });

  const grouped: Record<string, string[]> = {};
  const typeDetailByType: Record<string, string[]> = {};

  for (const item of items) {
    const category = normalizeDictionaryCategory(item.category);

    if (category === DICTIONARY_CATEGORIES.typeDetail && item.parentValue) {
      typeDetailByType[item.parentValue] = typeDetailByType[item.parentValue] ?? [];
      if (!typeDetailByType[item.parentValue].includes(item.value)) {
        typeDetailByType[item.parentValue].push(item.value);
      }
      continue;
    }

    grouped[category] = grouped[category] ?? [];
    if (!grouped[category].includes(item.value)) {
      grouped[category].push(item.value);
    }
  }

  return {
    type: grouped[DICTIONARY_CATEGORIES.type],
    typeDetail: grouped[DICTIONARY_CATEGORIES.typeDetail],
    typeDetailByType,
    owner: grouped[DICTIONARY_CATEGORIES.owner],
    commonRemark: grouped[DICTIONARY_CATEGORIES.commonRemark],
    solutionOwner: grouped[DICTIONARY_CATEGORIES.solutionOwner],
    sales: grouped[DICTIONARY_CATEGORIES.sales],
  };
}

/** B 站集成：审批下拉选项（字段名与 ReviewOrderWorkflow 对齐） */
export async function getReviewOptions(): Promise<ReviewOptionsResponse> {
  const dict = await getDictionaries();

  const types = dict.type ?? [];
  const typeDetailByTypeRaw = dict.typeDetailByType ?? {};
  const typeDetails =
    dict.typeDetail && dict.typeDetail.length > 0
      ? dict.typeDetail
      : [...new Set(Object.values(typeDetailByTypeRaw).flat())];

  const typeDetailByType =
    Object.keys(typeDetailByTypeRaw).length > 0
      ? typeDetailByTypeRaw
      : Object.fromEntries(types.map((type) => [type, typeDetails]));

  return {
    ok: true,
    types,
    typeDetails,
    typeDetailByType,
    owners: dict.owner ?? [],
    commonRemarks: dict.commonRemark ?? [],
  };
}
