# attend

> A local web console for managing many AI coding sessions across Claude Code and Codex.
>
> `session = cache · brief = state`

[English](#english) · [中文](#中文)

---

## English

### What problem it solves

If you use AI coding tools heavily, the main problem is not starting a session. The problem is keeping many sessions understandable, sortable, and resumable.

`attend` is built around four concrete pain points:

1. Too many sessions across projects and vendors.
2. Tagging stops working once the session count gets large.
3. Hard tasks get postponed while easier sessions keep getting reopened.
4. A session title alone is not enough to decide whether to resume it, fork it, or ignore it.

### What it is

`attend` is a zero-install local web app. Run `npx attend`, open one localhost page, and manage Claude Code and Codex sessions in the same place.

It does not try to replace the coding agents themselves. It gives you a better control surface for deciding what to do next.

### What it does

#### 1. Manage a large session set with tags that stay usable

- Global tags and per-session tags are stored locally.
- Vendor and project-directory tags are available as automatic tags.
- Tag filtering is OR-based, which stays practical when the list is large.
- Sessions stay grouped in one console instead of being split across tools.

This is aimed at the real failure mode: once you have a lot of sessions, "just remember where things are" stops working.

#### 2. Fork quickly when a task needs a new branch

- You can split a session directly from the browser.
- The fork keeps the parent context and starts a new branch with a new first turn.
- This is useful when one thread is mixing implementation, investigation, and alternative decisions.

The goal is to make forking cheap enough that you do it early instead of overloading one long thread.

#### 3. Make decision avoidance visible

Each session can carry:

- a `brief`: what this session is about now
- a `priority`: whether it is worth re-engaging now
- an `ETA`: how long it will take to reload context and respond properly
- a neutral `pattern`: `avoidance`, `stalled`, or `healthy`

This is not meant to moralize productivity. It is a way to surface sessions that are being revisited without being resolved.

#### 4. Give each session a richer identity than a title

In `attend`, a session is not just a name in a sidebar. A session can be judged by multiple dimensions at once:

- vendor
- project directory
- session id
- first prompt
- latest prompt
- tags
- unread / seen state
- recent activity
- priority
- ETA
- brief

This makes it easier to answer practical questions quickly:

- Is this the right thread to continue?
- Should I fork instead of resuming?
- Is this blocked by missing work, or by a decision I keep avoiding?

### How the signals work

Sessions created or forked inside `attend` get an analyzer daemon. It produces a small JSON result such as:

```json
{
  "brief": "tighten session tag filtering in the left rail",
  "priority": 72,
  "etaMin": 12,
  "reason": "recently active; affects navigation for many sessions"
}
```

Older or externally-created sessions fall back to local heuristics. The fallback uses session telemetry and memory alignment, not opaque ranking.

### Main interface

`attend` is a two-pane local console:

- Left pane: session list for triage. You can sort, filter, tag, and inspect sessions without opening each one.
- Right pane: session detail and chat. You can continue, fork, or start a new session from the browser.

Chat is vendor-aware:

- Claude runs through the Claude Agent SDK.
- Codex runs through `codex exec --json`.

### Quick start

```bash
# scan the current directory
npx attend

# scan specific roots and choose a port
npx attend "D:\\workspace\\projects" "~/notes" --port 5050
```

Run from this repo without publishing:

```bash
npx github:alvinfunborn/attend
```

Or clone and run locally:

```bash
git clone https://github.com/alvinfunborn/attend
cd attend
npm install
npm start
```

Then open `http://localhost:5050` unless `--no-open` is set.

Requirements:

- Node.js `>= 20`
- Claude Code and/or Codex installed if you want their sessions detected

### CLI and config

```text
attend [dirs...] [options]

  dirs                 Vault roots to scan (default: current dir)
  -p, --port <n>       Port (default: 5050)
      --host <addr>    Host to bind (default: 127.0.0.1)
  -c, --config <path>  Path to attend.config.json
      --no-open        Do not open the browser
  -h, --help           Help
```

Precedence: CLI args > env > config file > platform defaults.

Environment variables:

- `ATTEND_VAULTS`
- `ATTEND_PORT`
- `ATTEND_HOST`
- `ATTEND_CLAUDE_PROJECTS`
- `ATTEND_CODEX_SESSIONS`
- `ATTEND_TAGS`

Example `attend.config.json`:

```json
{
  "vaultRoots": ["D:\\workspace\\projects", "C:\\Users\\you\\notes"],
  "claudeProjects": "C:\\Users\\you\\.claude\\projects",
  "codexSessions": "C:\\Users\\you\\.codex\\sessions",
  "memorySources": [],
  "port": 5050
}
```

### Architecture notes

- `src/core/` is vendor-neutral domain logic.
- Vendor-specific reading lives in `src/core/vendor/`.
- Vendor-specific chat/analyzer implementations live in `src/chat/`.
- Adding a new vendor should be a seam change, not a full rewrite.

### Development

```bash
npm install
npm run dev
npm test
npm run typecheck
npm run lint
npm run build
```

### Boundaries

- Local-first, single-user tool.
- Pull-based, not notification-driven.
- Built for session triage and resumption, not for project specification.
- Browser UI over a local server, not a native desktop app.

### License

[MIT](LICENSE)

---

## 中文

### 它解决什么问题

如果你高频使用 AI 编码工具，真正难的通常不是“怎么开一个新会话”，而是：当会话变多以后，怎么让这些会话仍然可理解、可筛选、可接手。

`attend` 直接对准四类常见痛点：

1. 跨项目、跨厂商的 session 太多。
2. session 一多，tag 很容易失效，最后没人真能靠它管理。
3. 需要做判断的任务容易被一拖再拖，反而一直回到更轻松的线程。
4. 只有一个标题时，往往不足以判断这个 session 应该继续、fork，还是先放着。

### 它是什么

`attend` 是一个零安装的本地 Web 应用。运行 `npx attend` 后，你会得到一个 localhost 页面，在同一个界面里管理 Claude Code 和 Codex 的 session。

它不替代 agent 本身，而是补上“管理很多 session 时缺的那层控制面”。

### 它做什么

#### 1. 让海量 session 的 tag 管理仍然可用

- tag 分为全局 tag 和 session tag，本地持久化。
- `vendor` 和项目目录会形成自动 tag。
- tag 过滤采用 OR 语义，session 很多时更实用。
- Claude 和 Codex 的 session 收在同一份列表里，不再分散在不同工具里。

重点不是“支持标签”这件事本身，而是 session 多起来以后，标签体系还能不能继续工作。

#### 2. 让 fork 足够快

- 可以直接在浏览器里 `split` 一个 session。
- fork 会保留父会话上下文，并以新的首轮消息开始分支。
- 当一个线程同时混着实现、排查和方案分歧时，这个能力尤其重要。

目标是把 fork 的成本压低，让你更早分支，而不是把所有内容都堆进一条超长线程。

#### 3. 把“决策回避”显出来

每个 session 都可以带上几类信号：

- `brief`：这个 session 现在在做什么
- `priority`：现在是否值得重新接手
- `ETA`：重新进入上下文并认真回复大概需要多久
- `pattern`：中性的行为标签，可能是 `avoidance`、`stalled` 或 `healthy`

它不是在评判效率，而是在帮助你识别：哪些线程被反复打开，却没有真正推进。

#### 4. 给 session 提供多维身份信息

在 `attend` 里，一个 session 不只是侧边栏里的一行标题。你可以同时从多个维度判断它：

- vendor
- 项目目录
- session id
- 第一条 prompt
- 最新 prompt
- tags
- unread / seen 状态
- 最近活动
- priority
- ETA
- brief

这样更容易快速回答几个实际问题：

- 这是不是应该继续的那个线程？
- 这里应该继续聊，还是应该先 fork？
- 它是卡在执行工作上，还是卡在我一直回避的决策上？

### 这些信号怎么来

在 `attend` 里新建或 fork 的 session，会自动配一个 analyzer daemon。它会产出类似下面的结构：

```json
{
  "brief": "tighten session tag filtering in the left rail",
  "priority": 72,
  "etaMin": 12,
  "reason": "recently active; affects navigation for many sessions"
}
```

历史 session 或外部创建的 session，则回退到本地启发式。回退逻辑基于 session telemetry 和 memory alignment，不靠黑盒排名。

### 主要界面

`attend` 是一个双栏本地控制台：

- 左栏：用于 triage 的 session 列表。你可以先排序、筛选、打 tag、看摘要，不用逐个点开。
- 右栏：session 详情和 chat。你可以直接在浏览器里继续、fork 或新建 session。

聊天层按 vendor 分开接：

- Claude 通过 Claude Agent SDK
- Codex 通过 `codex exec --json`

### 快速开始

```bash
# 扫描当前目录
npx attend

# 指定扫描根目录和端口
npx attend "D:\\workspace\\projects" "~/notes" --port 5050
```

不发布 npm 也可以直接从仓库运行：

```bash
npx github:alvinfunborn/attend
```

或者克隆到本地运行：

```bash
git clone https://github.com/alvinfunborn/attend
cd attend
npm install
npm start
```

除非显式加 `--no-open`，否则会自动打开 `http://localhost:5050`。

要求：

- Node.js `>= 20`
- 如果希望识别对应 session，需要本机安装 Claude Code 和/或 Codex

### CLI 与配置

```text
attend [dirs...] [options]

  dirs                 要扫描的根目录（默认：当前目录）
  -p, --port <n>       端口（默认：5050）
      --host <addr>    绑定地址（默认：127.0.0.1）
  -c, --config <path>  attend.config.json 路径
      --no-open        不自动打开浏览器
  -h, --help           帮助
```

优先级：命令行参数 > 环境变量 > 配置文件 > 平台默认值。

环境变量：

- `ATTEND_VAULTS`
- `ATTEND_PORT`
- `ATTEND_HOST`
- `ATTEND_CLAUDE_PROJECTS`
- `ATTEND_CODEX_SESSIONS`
- `ATTEND_TAGS`

示例 `attend.config.json`：

```json
{
  "vaultRoots": ["D:\\workspace\\projects", "C:\\Users\\you\\notes"],
  "claudeProjects": "C:\\Users\\you\\.claude\\projects",
  "codexSessions": "C:\\Users\\you\\.codex\\sessions",
  "memorySources": [],
  "port": 5050
}
```

### 架构说明

- `src/core/` 放 vendor-neutral 的领域逻辑。
- `src/core/vendor/` 负责各 vendor 的 session 读取。
- `src/chat/` 放各 vendor 的聊天和 analyzer 实现。
- 新增 vendor 应该是“接缝扩展”，而不是全项目重写。

### 开发

```bash
npm install
npm run dev
npm test
npm run typecheck
npm run lint
npm run build
```

### 边界

- 本地优先，单人使用。
- 以拉取为主，不做通知中心。
- 重点是 session triage 和 resume，不是项目规格管理。
- 浏览器 + 本地服务，不是原生桌面应用。

### 许可

[MIT](LICENSE)
