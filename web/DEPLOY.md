# Docker 部署说明

## 前置条件

- Ubuntu 22.04 + Docker / Docker Compose
- 项目根目录存在 `项目统计2026.xlsm`（仅在使用「默认模板文件」便捷入口时需要）

## 本地准备

```bash
cd web
cp .env.example .env
# 编辑 .env，至少修改 AUTH_SESSION_SECRET、AUTH_ADMIN_PASSWORD、MEMBER_PASSWORD
```

## 构建与启动

在项目根目录（含 `docker-compose.yml`）：

```bash
docker compose up -d --build
```

访问：http://服务器IP:3000

## 首次登录

默认开发口令（**生产务必在 `.env` 中修改**）：

| 角色 | 账号 | 密码 |
|------|------|------|
| 管理员 | `admin`（或 `AUTH_ADMIN_USERNAME`） | `tt996`（或 `AUTH_ADMIN_PASSWORD`） |
| 普通人员 | 项目中的负责人姓名 | `member123`（或 `MEMBER_PASSWORD`） |

## 持久化

- SQLite：`sqlite-data` volume → `/app/prisma`
- 上传文件：`upload-data` volume → `/app/uploads`

## 健康检查

`GET /api/auth/session` 返回 200 即视为健康。

## 环境变量

见 `web/.env.example`：

- `DATABASE_URL` — SQLite 路径
- `AUTH_SESSION_SECRET` — httpOnly 会话签名
- `AUTH_ADMIN_USERNAME` / `AUTH_ADMIN_PASSWORD` — 管理员
- `MEMBER_PASSWORD` — 普通人员口令
- `STATS_DATE` — 统计基准日期
- `UPLOAD_DIR` — 上传目录（可选）

## 数据初始化

1. 浏览器打开 `/import`
2. 「选择 Excel 文件」上传 `.xlsx/.xls/.xlsm`，或点击「使用默认模板文件」
3. 确认导入后访问 `/timeline`

## 注意

- 仓库内不含真实密码；生产部署后请记录最终 `.env` 中的口令。
- 镜像基于 `node:20-bookworm-slim`（非 Alpine），兼容 `better-sqlite3` 原生模块。
