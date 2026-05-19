# Worklog 规范 Prompt

## 工作日志文件位置
`/home/z/my-project/worklog.md`

## 规则

### 启动前
每个 agent 在开始工作前，**必须** 读取 `/home/z/my-project/worklog.md`，了解之前 agent 已经做了什么。

### 完成后
每个 agent 完成工作后，**必须** 向 `/home/z/my-project/worklog.md` 追加新的章节（不要覆盖已有内容）。

### 格式要求

每个新章节 **必须** 以如下分隔线开头：
```text
---
```

每个章节 **必须** 包含至少以下字段：

```markdown
---
Task ID: <任务 ID，例如 2-a>
Agent: <agent 名称>
Task: <被要求完成的任务>

Work Log:
- <具体步骤 1>
- <具体步骤 2>
- ...

Stage Summary:
- <关键结果 / 重要决策 / 产出物>
```

## Task ID 命名规范

主 agent 在给子 agent 分配任务时，必须分配一个 **Task ID**，反映全局顺序和可能的并行关系：

- 顺序执行：`1`, `2`, `3`
- 并行执行：`2-a`, `2-b`（表示步骤 2 的两个并行任务）

## 示例

```markdown
---
Task ID: 2-a
Agent: full-stack-developer
Task: 实现用户认证 API 路由

Work Log:
- 读取 prisma/schema.prisma，确认 User 模型结构
- 创建 src/app/api/auth/login/route.ts
- 创建 src/app/api/auth/register/route.ts
- 添加密码哈希校验逻辑（bcryptjs）
- 测试 API 端点返回 200

Stage Summary:
- 完成登录和注册两个 API 路由
- 使用 bcryptjs 进行密码哈希
- 需要前端配合实现表单提交
```
