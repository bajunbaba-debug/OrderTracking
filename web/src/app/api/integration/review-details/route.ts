import { NextRequest, NextResponse } from "next/server";
import { assertCanWriteApi } from "@/lib/auth/server";
import { getReviewOptions } from "@/lib/dictionary";
import { parseProjectBody } from "@/lib/project-input";
import { upsertProject } from "@/lib/project-service";
import { formatValidationErrors, validateProjectRow } from "@/lib/project-validation";
import { prisma } from "@/lib/prisma";
import type { RawProjectRow } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ResultStatus = "created" | "updated" | "failed";

type ReviewDetailPayload = {
  id?: unknown;
  type?: unknown;
  typeDetail?: unknown;
  owner?: unknown;
  estimate?: unknown;
  estimatedComplexity?: unknown;
  commonRemark?: unknown;
  approvalRemark?: unknown;
  itemName?: unknown;
  model?: unknown;
  quantity?: unknown;
  productionInstructionNo?: unknown;
};

type ReviewDetailsPayload = {
  source?: unknown;
  taskId?: unknown;
  contractNo?: unknown;
  projectName?: unknown;
  publishDate?: unknown;
  applicationDate?: unknown;
  deliveryDate?: unknown;
  productionInstructionNo?: unknown;
  details?: unknown;
};

type ImportResult = {
  detailId: string;
  projectId?: string;
  status: ResultStatus;
  message: string;
};

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function positiveNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

async function assertIntegrationAuth(request: NextRequest) {
  const configuredToken = process.env.INTEGRATION_API_TOKEN?.trim();
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  const headerToken = request.headers.get("x-integration-api-token")?.trim();
  const suppliedToken = bearer || headerToken;

  if (configuredToken && suppliedToken) {
    if (suppliedToken === configuredToken) return null;
    return NextResponse.json({ error: "集成接口鉴权失败" }, { status: 403 });
  }

  // TODO: production service-to-service calls should configure INTEGRATION_API_TOKEN.
  return assertCanWriteApi();
}

async function findExistingProject(params: {
  source: string;
  taskId: string;
  detailId: string;
  row: RawProjectRow;
}) {
  const { source, taskId, detailId, row } = params;
  if (source && taskId && detailId) {
    const byExternalId = await prisma.projectItem.findFirst({
      where: {
        externalSource: source,
        externalTaskId: taskId,
        externalDetailId: detailId,
      },
      select: { id: true },
    });
    if (byExternalId) return byExternalId;
  }

  return prisma.projectItem.findFirst({
    where: {
      contractNo: row.contractNo,
      type: row.type,
      typeDetail: row.typeDetail,
      owner: row.owner,
      commonRemark: row.commonRemark,
      extraRemark: row.extraRemark,
    },
    select: { id: true },
  });
}

function buildRow(payload: ReviewDetailsPayload, detail: ReviewDetailPayload, warnings: string[]): RawProjectRow | string {
  const detailId = text(detail.id);
  const quantity = positiveNumber(detail.quantity);
  const estimate = positiveNumber(detail.estimate ?? detail.estimatedComplexity);

  if (!estimate) return "预计必须是大于 0 的有效数字";
  if (detail.quantity !== undefined && detail.quantity !== "" && !quantity) {
    return "数量必须是大于 0 的有效数字";
  }

  const itemName = text(detail.itemName);
  const projectName = text(payload.projectName) || itemName;
  const model = text(detail.model) || itemName || projectName;
  const finalQuantity = quantity ?? 1;
  if (!quantity) {
    warnings.push(
      detailId ? `明细 ${detailId} 未提供数量，已默认写入 1` : "有明细未提供数量，已默认写入 1"
    );
  }

  return parseProjectBody({
    type: text(detail.type),
    typeDetail: text(detail.typeDetail),
    contractNo: text(payload.contractNo),
    productionInstructionNo: text(detail.productionInstructionNo) || text(payload.productionInstructionNo),
    projectName,
    model,
    quantity: finalQuantity,
    publishDate: text(payload.publishDate) || text(payload.applicationDate),
    dueDate: text(payload.deliveryDate),
    owner: text(detail.owner),
    estimatedComplexity: estimate,
    commonRemark: text(detail.commonRemark),
    extraRemark: text(detail.approvalRemark) || itemName,
  });
}

export async function POST(request: NextRequest) {
  const denied = await assertIntegrationAuth(request);
  if (denied) return denied;

  let body: ReviewDetailsPayload;
  try {
    body = (await request.json()) as ReviewDetailsPayload;
  } catch {
    return NextResponse.json({ error: "请求体不是有效 JSON" }, { status: 400 });
  }

  if (!Array.isArray(body.details)) {
    return NextResponse.json({ error: "details 必须是数组" }, { status: 400 });
  }

  const source = text(body.source) || "ReviewOrderWorkflow";
  const taskId = text(body.taskId);
  const reviewOptions = await getReviewOptions();
  const dictContext = {
    types: reviewOptions.types,
    typeDetails: reviewOptions.typeDetails,
    typeDetailByType: reviewOptions.typeDetailByType,
    owners: reviewOptions.owners,
    commonRemarks: reviewOptions.commonRemarks
  };
  const warnings: string[] = [];
  const results: ImportResult[] = [];
  let created = 0;
  let updated = 0;
  let failed = 0;

  for (let index = 0; index < body.details.length; index += 1) {
    const detail = body.details[index] as ReviewDetailPayload;
    const detailId = text(detail.id) || `row-${index + 1}`;

    try {
      const rowOrError = buildRow(body, detail, warnings);
      if (typeof rowOrError === "string") {
        failed += 1;
        results.push({ detailId, status: "failed", message: rowOrError });
        continue;
      }

      const validation = validateProjectRow(rowOrError, dictContext);
      if (!validation.ok) {
        failed += 1;
        results.push({
          detailId,
          status: "failed",
          message: formatValidationErrors(validation.errors),
        });
        continue;
      }

      const existing = await findExistingProject({ source, taskId, detailId, row: rowOrError });
      const saved = await upsertProject(existing?.id ?? null, rowOrError);
      if (!saved?.id) throw new Error("保存失败");

      await prisma.projectItem.update({
        where: { id: saved.id },
        data: {
          externalSource: source,
          externalTaskId: taskId,
          externalDetailId: detailId,
        },
      });

      if (existing) updated += 1;
      else created += 1;

      results.push({
        detailId,
        projectId: saved.id,
        status: existing ? "updated" : "created",
        message: existing ? "已更新 B 站项目明细" : "已创建 B 站项目明细",
      });
    } catch {
      failed += 1;
      results.push({ detailId, status: "failed", message: "写入 B 站失败" });
    }
  }

  return NextResponse.json({
    ok: failed === 0,
    created,
    updated,
    failed,
    results,
    warnings,
  });
}
