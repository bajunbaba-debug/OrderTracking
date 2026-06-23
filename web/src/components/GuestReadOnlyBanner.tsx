export function GuestReadOnlyBanner({
  message = "游客只读，不能新增、编辑、导入或标记完成。",
}: {
  message?: string;
}) {
  return (
    <div className="mb-4 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
      {message}
    </div>
  );
}
