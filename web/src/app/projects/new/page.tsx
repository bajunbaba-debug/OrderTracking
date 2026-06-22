import { PageHeader } from "@/components/ui";
import { ProjectForm } from "@/components/ProjectForm";

export default function NewProjectPage() {
  return (
    <>
      <PageHeader title="新增项目明细" description="保存后将自动计算设计状态、预计(工作日)、交期区间、P1/P2 与风险等级。" />
      <ProjectForm />
    </>
  );
}
