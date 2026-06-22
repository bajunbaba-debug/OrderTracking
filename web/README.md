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
