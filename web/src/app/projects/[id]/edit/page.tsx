import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { ProjectForm } from "@/components/ProjectForm";
import { projectToFormValues } from "@/lib/project-form";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export default async function EditProjectPage({ params }: Params) {
  const { id } = await params;
  const item = await prisma.projectItem.findUnique({ where: { id } });
  if (!item) notFound();

  return (
    <>
      <PageHeader title="编辑项目明细" description={`型号：${item.model || "-"} · 负责人：${item.owner || "N/A"}`} />
      <ProjectForm projectId={id} initial={projectToFormValues(item)} />
    </>
  );
}
