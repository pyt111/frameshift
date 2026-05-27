# AGENTS.md

## 项目概览

FrameShift 是一个基于 Next.js 和 TypeScript 的 UI 代码转换工具，用于在 React、Vue 3、Angular 之间转换代码。核心流程是解析源码、生成语义树、生成目标框架代码，并可选使用 AI 进行完整代码翻译。

## 项目结构

- `src/app`：Next.js 页面和 API 路由。
- `src/components`：界面组件和翻译工作区。
- `src/lib/parsers`：React、Vue、Angular 解析器。
- `src/lib/generators`：React、Vue、Angular 代码生成器。
- `src/lib/translator`：翻译流程、映射和置信度评分。
- `src/lib/ai`：AI 提供商、流式响应和代码提取。
- `prisma`：SQLite Prisma schema。
- `agents`、`skills`：提示词和技能资源，非必要不要修改。

## 常用命令

- 本项目使用 Bun，依赖锁文件是 `bun.lock`。
- 安装依赖：`bun install`。
- 开发运行：`bun run dev`。
- 生产构建：`bun run build`。
- 代码检查：`bun run lint`。
- Prisma：`bun run db:generate`、`bun run db:push`、`bun run db:migrate`。

## 代码规范

- 使用 TypeScript 和现有的 `@/*` 路径别名。
- 延续现有组件风格：React 函数组件、shadcn/Radix UI、Tailwind、lucide 图标。
- 保持 parser、generator、semantic-tree、translator、AI provider 的职责边界清晰。
- 优先做小范围、明确的改动，避免无关重构。
- 新增生产依赖前必须先确认。

## 测试与验证

- 当前项目没有专门的测试脚本。
- 交付代码改动前，条件允许时运行 `bun run lint`。
- 修改翻译逻辑时，至少手动验证一条相关的 React/Vue/Angular 转换路径。
- 修改 UI 时，运行项目并在浏览器检查受影响流程。

## 安全

- 不要提交 API Key、Token 或真实密钥。
- AI 配置来自请求时按敏感信息处理，不要记录 API Key。
- 不要把本地数据库路径或环境私有值写入可复用文档。
