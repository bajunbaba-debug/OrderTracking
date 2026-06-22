# 给 Cursor 的第三版审核返工提示词

你刚完成了第二版修复，但复审发现仍有问题。请继续在 `/Users/jhonsimsim/MVP/OrderTracking/web` 中返工。不要只看 `npm run build`，必须同时跑 `npm run lint` 和浏览器实际点击验证。

## 必须先读

1. `../给Cursor的第二版UI和功能修复提示词.md`
2. 本文件

## 复审发现的问题

### 1. `npm run lint` 失败，必须修

命令：

```bash
npm run lint
```

当前错误：

```text
src/app/projects/page.tsx:118:5
Error: Calling setState synchronously within an effect can trigger cascading renders
react-hooks/set-state-in-effect
```

位置：

- `src/app/projects/page.tsx`

问题代码大意：

```ts
useEffect(() => {
  const next = parseUrlFilters(searchParams);
  setDesignStatus(next.designStatus);
  setDueBucket(next.dueBucket);
}, [searchParams]);
```

请改成不会触发 eslint 错误的实现。要求：

1. URL 参数变化仍能同步到筛选状态。
2. `/projects` 无参数时默认未完成。
3. `/projects?status=unfinished&dueBucket=8_14d` 能正常显示 8-14 天未完成明细。
4. `npm run lint` 必须通过。

### 2. `127.0.0.1:3000` 下明细页会卡在“加载中...”

复现路径：

1. 打开 `http://127.0.0.1:3000/`
2. 点击总览卡片“8-14天到期”
3. URL 变为：
   - `http://127.0.0.1:3000/projects?status=unfinished&dueBucket=8_14d`
4. 页面筛选控件正确选中“未完成”和“8-14天”，但表格一直显示“加载中...”

对照：

- 同一路径在 `http://localhost:3000/projects?status=unfinished&dueBucket=8_14d` 下可以显示 3 条数据。
- 后端接口本身可返回数据：
  - `/api/projects?designStatus=incomplete&dueBucket=8-14%E5%A4%A9`

dev log 中出现：

```text
Blocked cross-origin request to Next.js dev resource /_next/webpack-hmr from "127.0.0.1".
```

请处理：

1. 优先保证用户无论用 `localhost` 还是 `127.0.0.1` 都不会卡加载。
2. 如果需要配置 `allowedDevOrigins`，请在 `next.config.ts` 里加上合理配置。
3. 项目列表请求必须有 `.catch`，请求失败时显示错误提示，不允许无限“加载中...”。
4. 所有 client fetch 都应至少有错误兜底，不要让页面永久 loading。

### 3. `npm run build` 虽通过，但有 Turbopack tracing 警告

当前 build 警告：

```text
Encountered unexpected file in NFT list
Import trace:
  App Route:
    ./next.config.ts
    ./src/app/api/import/preview-default/route.ts
```

重点检查：

- `src/app/api/import/preview-default/route.ts`
- `src/app/api/import/route.ts`
- `src/lib/excel.ts`
- `src/lib/config.ts`

现状是 route 中使用：

```ts
path.resolve(process.cwd(), APP_CONFIG.defaultExcelPath)
```

这可能导致 Next tracing 认为整个项目都被动态追踪。请按 Next.js 更安全的方式限定文件范围，或用清晰静态路径/ignore 注释消除警告。

验收：

1. `npm run build` 无该 tracing 警告，或你能明确说明为什么无法避免且不会影响部署。
2. 默认导入仍能读取项目根目录的 `项目统计2026.xlsm`。

### 4. 数据库被改脏，当前统计不再是原始参考口径

复审发现当前 `prisma/dev.db` 的数据已不是第二版提示词中的原始参考数据：

当前看板：

- 总数：112
- 已完成：70
- 未完成：42

原参考口径：

- 有效明细：110
- 已完成：59
- 未完成：51

请处理：

1. 不要把测试过程中产生的临时数据留在 `dev.db`。
2. 如需测试新增/标记完成，必须测完清理。
3. 给出恢复原始数据的明确方式，优先提供一个“重新从默认 Excel 导入”的开发脚本或按钮路径说明。
4. 如果 `dev.db` 是要提交/交付的本地样例库，应恢复到从 `项目统计2026.xlsm` 干净导入后的状态。

### 5. 合同负责人数弹窗可打开，但视觉信息混杂

复现：

1. 打开 `http://localhost:3000/contracts`
2. 点击合同表格中的“负责人数”
3. 弹窗显示负责人明细

问题：

- 弹窗可打开，数据也有，但 DOM 文本/视觉上后面的合同表格内容仍然混在一起，阅读体验不清楚。

请优化：

1. 弹窗背景遮罩应明确压暗后方页面。
2. 弹窗内容区域应有清晰边界、最高高度、滚动容器。
3. 弹窗打开时，后方页面不应抢视觉焦点。
4. 如果可行，给弹窗加 `role="dialog"`、`aria-modal="true"`。

### 6. 未跟踪文件很多，审核容易漏

当前大量关键源码仍是 git 未跟踪文件，例如：

- `src/app/api/**`
- `src/app/projects/**`
- `src/components/**`
- `src/lib/**`
- `prisma/**`

请确认这些文件是否应该纳入版本管理。若这是交付代码，请至少说明：

1. 哪些新文件是本次实现必须保留的。
2. 是否需要 `git add`。
3. 哪些数据库备份文件不应提交。

## 必须重新自测

请逐项执行并在回复里列结果：

1. `npm run lint`
2. `npm run build`
3. `http://localhost:3000/projects?status=unfinished&dueBucket=8_14d` 显示 3 条或当前真实数据对应条数，不可永久 loading。
4. `http://127.0.0.1:3000/projects?status=unfinished&dueBucket=8_14d` 也不可永久 loading。
5. 明细页点击“编辑”打开编辑页，不报错。
6. 风险页点击“编辑”打开编辑页，不报错。
7. 明细页“标记完成”弹窗默认当前日期，确认后写入 `designCompleteDate`，并清理测试数据。
8. 合同负责人数弹窗视觉清楚，不和后方表格混杂。

## 回复要求

不要只说“已完成”。请列出：

1. 修改了哪些文件。
2. 每个问题如何修。
3. `lint` 和 `build` 的真实输出结论。
4. 浏览器验证路径和结果。
