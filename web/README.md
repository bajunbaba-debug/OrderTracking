# 订单项目分析系统（Web 第一版）

本地 Web 原型：从 Excel 导入项目明细，写入 SQLite，后续在网页维护。

## 启动

```bash
cd web
npm install
npm run db:migrate
npm run dev
```

浏览器访问：http://localhost:3000

## 局域网访问

如果需要让同一局域网内的其他电脑访问，启动时监听所有网卡：

```bash
cd web
npm run dev:lan
```

本机访问：http://localhost:3000

其他电脑访问：http://<本机局域网IP>:3000

正式构建后可使用：

```bash
npm run build
npm run start:lan
```

如果其他电脑仍无法访问，请检查两台电脑是否在同一局域网、Mac 防火墙是否允许 Node/终端接收入站连接，以及路由器是否开启了客户端隔离。

## 首次使用

1. 打开「导入」页面
2. 点击「导入默认 Excel」（读取上级目录的 `项目统计2026.xlsm`，不会修改原文件）
3. 返回「总览」查看指标

## 技术栈

- Next.js + React + TypeScript
- SQLite + Prisma
- Tailwind CSS
- xlsx（Excel 解析）

## 配置

`.env` 中可调整：

- `DATABASE_URL`：SQLite 路径
- `STATS_DATE`：统计基准日期，默认 `2026-06-18`

## ReviewOrderWorkflow 集成 API

B 站提供两个接口给 ReviewOrderWorkflow 使用，主路线应通过 API 对接，页面自动化只作为 fallback。

### GET /api/integration/review-options

返回审核端下拉选项，字段名已对齐 ReviewOrderWorkflow：

```json
{
  "ok": true,
  "types": [],
  "typeDetails": [],
  "typeDetailByType": {},
  "owners": [],
  "commonRemarks": []
}
```

来源为启用的 Dictionary 项：`type` -> `types`，`typeDetail` -> `typeDetails/typeDetailByType`，`owner` -> `owners`，`commonRemark` -> `commonRemarks`。兼容旧的 `remark` 分类。

### POST /api/integration/review-details

批量写入审核明细到 `ProjectItem`。写入接口需要登录写权限；生产服务间调用建议配置 `INTEGRATION_API_TOKEN`，请求时使用 `Authorization: Bearer <token>` 或 `x-integration-api-token`。

请求示例：

```json
{
  "source": "ReviewOrderWorkflow",
  "taskId": "task-id",
  "contractNo": "HT-001",
  "projectName": "项目名称",
  "publishDate": "2026-06-27",
  "applicationDate": "2026-06-27",
  "deliveryDate": "2026-07-10",
  "details": [
    {
      "id": "detail-id",
      "type": "机组",
      "typeDetail": "手动复位",
      "owner": "张三",
      "estimate": "2",
      "commonRemark": "常规",
      "approvalRemark": "审批备注",
      "itemName": "明细名称",
      "model": "规格型号",
      "quantity": 1
    }
  ]
}
```

字段映射：`type/typeDetail/owner/commonRemark` 来自明细；`contractNo/projectName/publishDate/dueDate` 来自顶层；`estimatedComplexity` 来自 `estimate`；`extraRemark` 来自 `approvalRemark` 或 `itemName`；`quantity` 缺失时默认 1 并返回 warning。

响应逐条返回结果：

```json
{
  "ok": true,
  "created": 1,
  "updated": 0,
  "failed": 0,
  "results": [
    { "detailId": "detail-id", "projectId": "...", "status": "created", "message": "已创建 B 站项目明细" }
  ],
  "warnings": []
}
```

幂等字段为 `externalSource + externalTaskId + externalDetailId`。重复提交同一明细会更新现有项目；缺少外部 ID 时，会按合同号、类型、类型细化、负责人、常用备注和额外备注做 fallback 查重。
