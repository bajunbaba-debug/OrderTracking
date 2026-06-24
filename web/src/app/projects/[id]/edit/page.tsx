import { notFound } from "next/navigation";
import { PageHeader, DisplayText } from "@/components/ui";
import { ProjectForm, type ProjectFormReturnTo } from "@/components/ProjectForm";
import { projectToFormValues } from "@/lib/project-form";
import { prisma } from "@/lib/prisma";

type Params = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; owner?: string }>;
};

export default async function EditProjectPage({ params, searchParams }: Params) {
  const { id } = await params;
  const query = await searchParams;
  const item = await prisma.projectItem.findUnique({ where: { id } });
  if (!item) notFound();

  const returnTo: ProjectFormReturnTo =
    query.from === "timeline" && query.owner
      ? { kind: "timeline", owner: query.owner, projectId: id }
      : { kind: "projects" };

  return (
    <>
      <PageHeader
        title="编辑项目明细"
        description={
          <>
            型号：<DisplayText value={item.model} /> · 负责人：<DisplayText value={item.owner} />
          </>
        }
      />
      <ProjectForm projectId={id} initial={projectToFormValues(item)} returnTo={returnTo} />
    </>
  );
}
