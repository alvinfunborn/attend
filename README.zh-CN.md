# attend

> 一个本地 AI session 控制台，用来管理很多 Claude Code / Codex 会话。

[English README](README.md)

## 产品意图

AI coding session 多起来以后，最难的是判断下一步接哪条。

`attend` 把每条 session 当成本地工作记忆来管理。你在列表里应该能快速看出：

- 这条 session 记住的事是什么？
- AI 现在是在跑、刚回完、还被跟踪，还是已经停放？
- AI 觉得下一步需要你做什么？
- 它在这个 vault 里有多重要？
- 重新接手要花多少注意力？
- 应该继续这条，还是 fork 出新分支？

## 核心信号

### 呼吸灯

呼吸灯表示 session 当前的注意力状态：

- `generating`：AI 正在工作。
- `unread`：后台有新回复。
- `seen`：你看过了，但这条 session 还在跟踪中。
- `read`：你把它停放了。

它解决的是多条并行 session 里“哪里发生了变化”的问题。

### `brief`

`brief` 是 session 的记忆点。它是拥挤列表里用来认出这条线程的短标签。

它应该抓住这条 session 持久的主题、决策点或当前任务，尤其是长线程已经偏离最初 prompt 的时候。

### `priority`

`priority` 是这条 session 在当前 vault 内的相对重要性，范围是 `0-10`。

它看的是业务和工作价值：用户影响、生产问题、截止时间、协作者阻塞、发布验证、构建失败，或这个 vault 当前的主线目标。

### `etaMin`

`etaMin` 是重新接手这条 session 预计需要的分钟数。

它衡量的是重新读懂最后状态、恢复上下文、给出有效回复的成本。低 ETA 适合快速清掉；高 ETA 需要完整注意力。

### `state`

`state` 是 AI 给你的交接标签：它认为下一步该发生什么。

- `continue_ready`：下一步明确，可以继续。
- `needs_decision`：需要你选方向、范围或取舍。
- `needs_input`：缺事实、文件、凭证、环境信息或偏好。
- `blocked`：被工具、认证、CI、依赖或外部服务卡住。
- `needs_review`：结果已完成，等你检查。
- `followup_suggested`：任务已完成，但有可选后续。
- `done`：没有需要你做的下一步。

### `healthy` / `avoidance` / `stalled`

这组标签描述你和任务的关系：

- `healthy`：你在持续推进。
- `avoidance`：你反复回来阅读，但任务没有前进。
- `stalled`：这条任务已经被放了很久。

它们来自本地 engagement telemetry，例如回访、停留、滚动和输入。

## Tag 管理

tag 的目标是让大量 session 仍然可筛选：

- 全局 tag 和 session tag。
- 按 vendor 和项目目录自动分组。
- OR 过滤，方便快速收窄列表。
- tag 同时写到 session id 和稳定的 `vendor + cwd + brief` 识别键。
- fork 后继承父 session 的 tag。

## 快速 Fork

长 AI 线程经常会分成排查、实现、产品决策等不同方向，所以 fork 应该足够便宜。

`attend` 支持从浏览器直接分支：

- Claude 使用原生 fork。
- Codex 通过复制 rollout 后 resume。
- 跨 provider fork 会把父 session transcript 带入新 provider。
- fork 用你的第一条新消息开分支，并继承父 session 的 tag。

## 快速开始

```bash
# 扫描当前目录
npx attend

# 扫描指定 vault roots
npx attend "~/projects" "~/work" --port 5050
```

直接从 GitHub 运行：

```bash
npx github:alvinfunborn/attend
```

本地开发：

```bash
git clone https://github.com/alvinfunborn/attend
cd attend
npm install
npm run dev
```

默认打开 `http://localhost:5050`。

要求：

- Node.js `>= 20`
- 如需读取和继续对应会话，本机需要安装 Claude Code 和/或 Codex

## CLI

```text
attend [dirs...] [options]

  dirs                 要扫描的 vault roots（默认：当前目录）
  -p, --port <n>       端口（默认：5050）
      --host <addr>    绑定地址（默认：127.0.0.1）
  -c, --config <path>  attend.config.json 路径
      --no-open        不自动打开浏览器
  -h, --help           帮助
```

配置优先级：

```text
CLI args > env > config file > platform defaults
```

常用环境变量：

- `ATTEND_VAULTS`
- `ATTEND_PORT`
- `ATTEND_HOST`
- `ATTEND_CLAUDE_PROJECTS`
- `ATTEND_CLAUDE_MODELS`（手动逗号分隔 override）
- `ATTEND_CLAUDE_MODELS_CACHE`
- `ATTEND_CODEX_SESSIONS`
- `ATTEND_CODEX_MODELS_CACHE`
- `ATTEND_TAGS`

当 Attend 用单个 vault root 启动时，用户数据写入 `<vault>/.attend/`：tag、
session 状态、手动 override、engagement，以及与浏览器无关的 UI 状态（主题、
focus 定义、model/effort 历史和消息 pin）。只有 daemon 映射和 analysis cache
保留在全局 `~/.attend/`。浏览器只保留设备交互偏好：tag filter 模式、priority
filter、当前 focus、sidebar 宽度和折叠的 turn。没有 scoped vault 时仍保留旧的
全局回退；`ATTEND_TAGS` 可以覆盖默认 tag 路径。

示例 `attend.config.json`：

```json
{
  "vaultRoots": ["D:\\workspace\\projects", "C:\\Users\\you\\notes"],
  "claudeProjects": "C:\\Users\\you\\.claude\\projects",
  "claudeModelsCache": "C:\\Users\\you\\.claude\\cache\\gateway-models.json",
  "codexSessions": "C:\\Users\\you\\.codex\\sessions",
  "codexModelsCache": "C:\\Users\\you\\.codex\\models_cache.json",
  "memorySources": [],
  "port": 5050
}
```

## 信号来源

在 `attend` 内新建或 fork 的 session，会自动配一个 analyzer daemon。session 推进后，daemon 返回：

```json
{
  "brief": "tighten tag filtering",
  "state": "needs_review",
  "priority": 7.2,
  "etaMin": 12,
  "reason": "navigation behavior changed and needs QA"
}
```

历史 session 或外部创建的 session 会回退到本地启发式。

## 边界

- 本地优先，单人使用。
- 数据存在本机。
- 重点是 session triage、resume 和 fork。
- 浏览器 UI + 本地 server。

## 开发

```bash
npm install
npm run dev
npm test
npm run typecheck
npm run lint
npm run build
```

## 许可

[MIT](LICENSE)
