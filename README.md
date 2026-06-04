# attend

> **The one place that tells a solo dev which AI task to re-engage next** — a cross-vendor (Claude Code + Codex), in-browser chat console where every session carries a **brief**, a **priority**, and an **ETA** computed by a per-session analyzer daemon.
>
> `session = cache · brief = state · vendor = replaceable backend`

[English](#english) · [中文](#中文)

---

## English

### What it is

`attend` is a **zero-install local web app** (`npx attend` boots a server and opens your browser) that aggregates **all your AI coding sessions across Claude Code and Codex** into a single slock-style chat console — and tells you, for each one, *what it's about*, *how urgent it is*, and *how long it'll cost you to pick back up*.

It exists because a single person working with AI hits four compounding costs:

1. **Concurrency** — 10+ live sessions across multiple VS Code projects + Codex CLI is normal.
2. **Vendor isolation** — Claude Code and Codex are separate ecosystems with no shared view.
3. **Decision avoidance** — when a task needs a hard decision, it's easy to drift to easier sessions instead. Self-report rationalizes it ("efficient batching"); behavioral telemetry catches it.
4. **Polling overhead** — N IDE tabs × the re-orientation cost on every switch.

**Why not just your IDE's agent view?** Claude Code's Agent View and Codex's command center are **single-vendor** and **session-centric** — they show running processes. `attend` is **cross-vendor** and **attention-centric**: it surfaces the task you're quietly avoiding, not just the one that's running, and it does so in *one* localhost page you pull on your own schedule — no notifications.

### What it does

**Main view (`/`) — an in-browser chat console.** A two-pane, slock-style layout:

- **Left sidebar** — every session (Claude + Codex), newest first. Each tab shows:
  - a **title** (the analyzer daemon's one-line *brief*; provisional first-prompt until analyzed),
  - two subtitles — `首` (your first message) and `新` (your latest message),
  - **priority + ETA badges**, so a tab is judgeable *without opening it*.
- **Chat panel** — the conversation streams **in the page** (user / assistant / tool-use bubbles). You never drop to a terminal.
  - **continue** — click a session, read its history, type to resume it (streamed reply + tool use).
  - **split ⑂** — fork a session into a new branch.
  - **+ new** — start a fresh session: pick a provider (only CLIs detected on your machine are selectable), a project directory, and a first message.

Chat is driven by the **Claude Agent SDK** using your existing Claude login — **no API key**. Codex has no streaming SDK yet, so **in-browser chat is Claude-only**; Codex sessions still list and fall back to the terminal launcher.

### How the signals work

A deliberate split: *what you can read off one session* vs. *what needs your whole context to judge*.

| Signal | Source | Notes |
|---|---|---|
| **brief** | analyzer daemon (LLM) | one-line "what / where I'm stuck" — *resume state*, not a spec |
| **priority** | analyzer daemon (LLM) | "is this worth re-engaging now" |
| **ETA** | analyzer daemon (LLM) | est. minutes to reload context + reply thoughtfully |
| **pattern** | session JSONL (heuristic) | behavioral observation — `avoidance` / `stalled` / `healthy` (everything else stays unbadged) |

**The analyzer daemon (v2.3).** Every session you create *inside* `attend` (`/chat/new`, `/chat/fork`) gets a paired **daemon session** — a normal vendor session, sharing the task's working directory, re-run on each turn-end. It reads the condensed transcript and replies with one JSON object `{brief, priority, etaMin, reason}`. Daemons are filtered out of every listing via a registry (`~/.attend/daemons.json`). They are a **vendor seam** — a session is analyzed by its own vendor's analyzer, and the daemon intentionally does **not** pin a separate model/effort profile; it follows the vendor's normal defaults for that environment.

**Fallback (no daemon).** Historical / terminal-launched sessions that have no daemon fall back to a local heuristic: **memory-led** priority — TF-IDF cosine similarity against your Claude memory corpus (local, no API; CJK via bigrams), with small pattern nudges that can't outrank it — and a memory-derived ETA. Every rank carries a one-line, auditable reason (top matched terms + the pattern's evidence). No opaque scores.

**Pattern definitions:**

| Pattern | Trigger | Meaning |
|---|---|---|
| `avoidance` | repeated long review visits, or ≥3 revisits over ≥1h without advancing | likely a decision point, not more "work" |
| `stalled` | 0 actions, last touch ≥ 7 days | cold, no recent activity |
| `healthy` | actions > 0, avg dwell ≥ 10 min, touch ≤ 3 days | in flow — don't interrupt |

Telemetry is **descriptive, never judgmental** (Steel 2007: judgmental feedback on procrastination *worsens* it). All labels are observations, never second-person pressure.

### Quick start

`attend` is a zero-install Node CLI — it boots a local web server and opens your browser. Nothing to install.

```bash
# run against the current directory (and below)
npx attend

# scan specific vault roots, pick a port
npx attend "D:\workspace\projects" "~/notes" --port 5050
```

Run straight from this repo (no npm publish required):

```bash
npx github:alvinfunborn/attend
```

Or clone and run locally:

```bash
git clone https://github.com/alvinfunborn/attend && cd attend
npm install
npm start            # = node dist/cli.js
```

Then open `http://localhost:5050` (opened automatically unless `--no-open`).

> Requires **Node ≥ 20**. Works on Windows and macOS — paths and defaults are platform-aware. Chat uses your existing Claude Code login; no API key.

### CLI / config

```
attend [dirs...] [options]

  dirs                 Vault roots to scan (default: current dir)
  -p, --port <n>       Port (default: 5050)
      --host <addr>    Host to bind (default: 127.0.0.1)
  -c, --config <path>  Path to attend.config.json
      --no-open        Don't open the browser
  -h, --help           Help
```

**Precedence:** CLI args > env > config file > platform defaults.

**Env vars:** `ATTEND_VAULTS` (path-separator-delimited), `ATTEND_PORT`, `ATTEND_HOST`, `ATTEND_CLAUDE_PROJECTS`, `ATTEND_CODEX_SESSIONS`.

Optional `attend.config.json` (in the cwd, or via `--config`):

```json
{
  "vaultRoots": ["D:\\workspace\\projects", "C:\\Users\\you\\notes"],
  "claudeProjects": "C:\\Users\\you\\.claude\\projects",
  "codexSessions": "C:\\Users\\you\\.codex\\sessions",
  "memorySources": [],
  "port": 5050
}
```

`memorySources` empty → per-project Claude memory (`~/.claude/projects/*/memory/MEMORY.md`) is auto-discovered and unioned — the same memory model as Claude Code.

`vaultRoots` (also `attend <dir>…` positional args, or `ATTEND_VAULTS`) **scopes the listing**: only sessions whose cwd is within one of these dirs (or a subdir) are shown. Omit it → every session is listed. Sessions themselves are always read from the vendor stores (`claudeProjects` / `codexSessions`); this only narrows which ones appear.

### Endpoints

| Route | Purpose |
|---|---|
| `GET /` | the console SPA |
| `GET /chat/stream` | SSE — replays the run buffer, then streams live |
| `POST /chat/send` | resume a session + feed a turn |
| `POST /chat/new` | new in-browser Claude session (dir + first message) |
| `POST /chat/fork` | fork (split) a session |
| `POST /chat/abort` | abort a live run |
| `GET /chat/messages` | a session's JSONL history |
| `GET /session/analysis` | the daemon's latest verdict for a session |
| `POST /launch` | terminal launcher (Codex `new`, fallback) |

### Architecture

```
src/
  cli.ts                CLI entry: parse args, resolve config, boot server, open browser
  server.ts             Hono HTTP server: console + chat endpoints
  config.ts             config resolution + platform defaults
  core/                 pure domain logic — NO server deps, unit-tested
    vendor/             SessionSource seam: claude (JSONL) + codex (stub) + detect (PATH probe)
    daemon/             analyzer-daemon plumbing: registry, cache, parse, overrides
    pattern.ts          behavioral classifier (session-derived)
    priority.ts         memory-led scoring + reasons (no-daemon fallback)
    alignment.ts        TF-IDF cosine memory alignment (CJK bigrams)
    memory.ts           Claude-convention per-project memory keywords
    launch.ts           per-vendor terminal command builders
  chat/                 in-browser chat
    engine.ts           ChatEngine — drives Claude via the Agent SDK (query() injectable)
    events.ts           normalize SDK messages → small UiEvent protocol
    transcript.ts       read a session's JSONL for history
    daemon.ts           DaemonOrchestrator — routes analysis by vendor, owns registry/cache
    analyzer/           SessionAnalyzer seam: claude (real) + codex (stub)
  ui/console.ts         the console SPA (vanilla JS over EventSource + fetch)
legacy/                 original Python/Flask daemon (reference only — do not extend)
```

**Key invariant:** `src/core/` has **no server dependency** — that's what makes it unit-testable. Vendor-specific logic stays in `core/vendor/`, `core/launch.ts`, and `chat/analyzer/`; everything else is vendor-neutral. **A new vendor = one new `SessionSource` + one new `SessionAnalyzer`; nothing downstream changes.**

### Develop

```bash
npm install
npm run dev          # tsx — run from source, no build
npm test             # vitest
npx vitest run test/priority.test.ts   # single test file
npm run typecheck    # tsc --noEmit
npm run lint         # biome check src test  (--write to fix)
npm run build        # tsup → dist/cli.js (single bundled ESM file)
```

Strict TS, ESM, `verbatimModuleSyntax` (use `import type`; imports use `.js` extensions). Format/lint via biome (100-col, double quotes, 2-space). Tests are pure — no fs/network; the `query` fn is injectable so tests never hit the network.

### Design invariants

Touch these only with explicit cause (see `DESIGN.md`):

1. **brief = state, session = cache** — nothing the console knows lives only in a session.
2. **pull, not push** — no notifications. (v2 exceptions, recorded: chat streams over SSE for an action *you* initiated; the analyzer daemon does background LLM work — both deliberate, user-authorized.)
3. **descriptive telemetry, never judgmental** — Steel 2007. Making output more "motivating" is a regression. The Codex stub returning *nothing* (vs. fake data) is part of this.
4. **vendor-neutral data, vendor-locked execution** — keep vendor logic inside `core/vendor/` & `chat/analyzer/`.
5. **single polling surface** — one localhost page. Zero-install via `npx`; the browser is the UI. **Not** a downloadable native app (that's why Tauri was rejected — see `DESIGN.md`).

### What this is NOT (deliberately)

- Not push notifications — you pull, on your schedule.
- Not a spec/SDD tool — a brief is *resume state* ("where I'm stuck"), not "what to build".
- Not multi-user — a single-person attention router.
- Not a downloadable native app — zero-install via `npx`, runs in your browser.

### License

[MIT](LICENSE)

---

## 中文

### 这是什么

`attend` 是一个**零安装的本地 Web 应用**（`npx attend` 启动本地服务并自动打开浏览器），它把你在 **Claude Code 和 Codex 上的所有 AI 编码会话**聚合进一个 slock 风格的聊天控制台 —— 并为每个会话告诉你：*它在做什么*、*有多紧急*、*重新接手要花多少时间*。

它要解决的是单人配合 AI 工作时叠加的四种成本：

1. **并发** —— 跨多个 VS Code 项目 + Codex CLI 同时开 10+ 个会话是常态。
2. **厂商隔离** —— Claude Code 与 Codex 是两套互不相通的生态，没有统一视图。
3. **决策回避** —— 当某个任务需要做艰难决定时，人会不自觉地溜去做更轻松的会话。自我汇报会把它合理化成"高效批处理"；行为埋点才能识破。
4. **轮询开销** —— N 个 IDE 标签页 × 每次切换的重新进入成本。

**为什么不直接用 IDE 自带的 agent 视图？** Claude Code 的 Agent View、Codex 的命令中心都是**单厂商**、**以会话为中心**的 —— 它们展示的是"正在跑的进程"。`attend` 是**跨厂商**、**以注意力为中心**的：它浮现的是你正在悄悄回避的那个任务，而不只是正在跑的那个；并且收敛在**一个**你按自己节奏拉取的 localhost 页面里 —— 没有推送通知。

### 它做什么

**主视图（`/`）—— 浏览器内的聊天控制台。** 双栏 slock 风格布局：

- **左侧栏** —— 所有会话（Claude + Codex），最新在前。每个标签显示：
  - **标题**（分析守护进程给出的一句话 *brief*；在分析完成前用首条 prompt 占位），
  - 两条副标题 —— `首`（你的第一条消息）与 `新`（你的最新消息），
  - **优先级 + ETA 徽章**，让你*不打开*就能判断要不要管它。
- **聊天面板** —— 对话直接**在页面里**流式呈现（用户 / 助手 / 工具调用气泡），你永远不必切回终端。
  - **continue（继续）** —— 点开会话查看历史，输入即可续聊（流式回复 + 工具调用）。
  - **split ⑂（分叉）** —— 把会话分叉成新分支。
  - **+ new（新建）** —— 开新会话：选 provider（只有本机检测到的 CLI 可选）、项目目录、首条消息。

聊天由 **Claude Agent SDK** 驱动，复用你现有的 Claude 登录态 —— **无需 API key**。Codex 暂无流式 SDK，因此**浏览器内聊天仅支持 Claude**；Codex 会话仍会列出，并回退到终端启动器。

### 信号是怎么来的

一个刻意的划分：*能从单个会话读出来的* vs. *需要你的整体上下文才能判断的*。

| 信号 | 来源 | 说明 |
|---|---|---|
| **brief** | 分析守护进程（LLM） | 一句话"做什么 / 卡在哪" —— 是*恢复状态*，不是规格说明 |
| **priority（优先级）** | 分析守护进程（LLM） | "现在值不值得重新接手" |
| **ETA** | 分析守护进程（LLM） | 重新加载上下文 + 认真回复预计要花的分钟数 |
| **pattern（行为模式）** | 会话 JSONL（启发式） | 行为观察 —— `avoidance` / `stalled` / `healthy`（其余情况不打 badge） |

**分析守护进程（v2.3）。** 每个你在 `attend` *内部*创建的会话（`/chat/new`、`/chat/fork`）都会配一个**守护会话** —— 一个普通的同厂商会话，与任务共享同一工作目录，在每轮结束时重跑。它读取压缩后的对话，回一个 JSON `{brief, priority, etaMin, reason}`。守护进程会通过注册表（`~/.attend/daemons.json`）从所有列表中过滤掉。它是一个**厂商接缝** —— 每个会话由它自己厂商的分析器分析，并且 daemon 不再固定单独的 model/effort 配置，而是跟随当前环境下该厂商会话的默认配置。

**回退（无守护进程）。** 历史会话 / 终端启动的会话没有守护进程，会回退到本地启发式：**记忆主导**的优先级 —— 对你的 Claude 记忆语料做 TF-IDF 余弦相似度（本地、无 API；中文用 bigram），辅以无法盖过它的小幅 pattern 微调 —— 以及一个记忆推导的 ETA。每条排序都带一行可审计的理由（命中关键词 + pattern 的证据）。没有不透明的分数。

**行为模式定义：**

| 模式 | 触发条件 | 含义 |
|---|---|---|
| `avoidance` | 反复长时间 review，或 ≥3 次回访且累计 ≥1h 仍未推进 | 更像是卡在决策点，而不是缺少更多“工作” |
| `stalled` | 0 actions、最后接触 ≥ 7 天 | 冷却，近期无活动 |
| `healthy` | actions > 0、平均驻留 ≥ 10 分钟、接触 ≤ 3 天 | 心流中 —— 别打扰 |

埋点遵循**描述性、绝不评判**（Steel 2007：对拖延的评判式反馈反而会加重它）。所有标签都是观察，绝不用第二人称施压。

### 快速开始

`attend` 是零安装的 Node CLI —— 启动本地 Web 服务并打开浏览器，无需安装任何东西。

```bash
# 扫描当前目录（及其子目录）
npx attend

# 指定要扫描的根目录，并指定端口
npx attend "D:\workspace\projects" "~/notes" --port 5050
```

直接从本仓库运行（无需 npm publish）：

```bash
npx github:alvinfunborn/attend
```

或克隆到本地运行：

```bash
git clone https://github.com/alvinfunborn/attend && cd attend
npm install
npm start            # = node dist/cli.js
```

然后打开 `http://localhost:5050`（除非加 `--no-open`，否则会自动打开）。

> 需要 **Node ≥ 20**。Windows 与 macOS 均可用 —— 路径和默认值会按平台适配。聊天复用你已有的 Claude Code 登录态，无需 API key。

### 命令行 / 配置

```
attend [dirs...] [options]

  dirs                 要扫描的根目录（默认：当前目录）
  -p, --port <n>       端口（默认：5050）
      --host <addr>    绑定的 host（默认：127.0.0.1）
  -c, --config <path>  attend.config.json 路径
      --no-open        不自动打开浏览器
  -h, --help           帮助
```

**优先级：** 命令行参数 > 环境变量 > 配置文件 > 平台默认值。

**环境变量：** `ATTEND_VAULTS`（按路径分隔符分隔）、`ATTEND_PORT`、`ATTEND_HOST`、`ATTEND_CLAUDE_PROJECTS`、`ATTEND_CODEX_SESSIONS`。

可选 `attend.config.json`（放在 cwd，或用 `--config` 指定）：

```json
{
  "vaultRoots": ["D:\\workspace\\projects", "C:\\Users\\you\\notes"],
  "claudeProjects": "C:\\Users\\you\\.claude\\projects",
  "codexSessions": "C:\\Users\\you\\.codex\\sessions",
  "memorySources": [],
  "port": 5050
}
```

`memorySources` 为空 → 自动发现并合并各项目的 Claude 记忆（`~/.claude/projects/*/memory/MEMORY.md`）—— 与 Claude Code 同一套记忆模型。

### 接口

| 路由 | 用途 |
|---|---|
| `GET /` | 控制台 SPA |
| `GET /chat/stream` | SSE —— 先回放运行缓冲，再流式直播 |
| `POST /chat/send` | 恢复会话并喂入一轮 |
| `POST /chat/new` | 浏览器内新建 Claude 会话（目录 + 首条消息） |
| `POST /chat/fork` | 分叉（split）会话 |
| `POST /chat/abort` | 中止正在进行的运行 |
| `GET /chat/messages` | 会话的 JSONL 历史 |
| `GET /session/analysis` | 守护进程对某会话的最新结论 |
| `POST /launch` | 终端启动器（Codex `new`、回退用） |

### 架构

```
src/
  cli.ts                CLI 入口：解析参数、解析配置、启动服务、打开浏览器
  server.ts             Hono HTTP 服务：控制台 + 聊天接口
  config.ts             配置解析 + 平台默认值
  core/                 纯领域逻辑 —— 不依赖 server，单测覆盖
    vendor/             SessionSource 接缝：claude（JSONL）+ codex（桩）+ detect（探测 PATH）
    daemon/             分析守护进程基建：registry、cache、parse、overrides
    pattern.ts          行为分类器（会话推导）
    priority.ts         记忆主导的打分 + 理由（无守护进程时的回退）
    alignment.ts        TF-IDF 余弦记忆对齐（中文 bigram）
    memory.ts           Claude 约定的各项目记忆关键词
    launch.ts           各厂商的终端命令构造
  chat/                 浏览器内聊天
    engine.ts           ChatEngine —— 经 Agent SDK 驱动 Claude（query() 可注入）
    events.ts           把 SDK 消息规范化为小巧的 UiEvent 协议
    transcript.ts       读取会话 JSONL 作为历史
    daemon.ts           DaemonOrchestrator —— 按厂商路由分析，持有 registry/cache
    analyzer/           SessionAnalyzer 接缝：claude（真实）+ codex（桩）
  ui/console.ts         控制台 SPA（基于 EventSource + fetch 的原生 JS）
legacy/                 最初的 Python/Flask 守护进程（仅供参考 —— 不要扩展）
```

**关键不变量：** `src/core/` **不依赖 server** —— 这正是它可被单元测试的原因。厂商相关逻辑只留在 `core/vendor/`、`core/launch.ts`、`chat/analyzer/`；其余一律厂商中立。**新增一个厂商 = 一个新的 `SessionSource` + 一个新的 `SessionAnalyzer`；下游不需要任何改动。**

### 开发

```bash
npm install
npm run dev          # tsx —— 直接从源码跑，无需构建
npm test             # vitest
npx vitest run test/priority.test.ts   # 单个测试文件
npm run typecheck    # tsc --noEmit
npm run lint         # biome check src test （加 --write 自动修复）
npm run build        # tsup → dist/cli.js（单个打包的 ESM 文件）
```

严格 TS、ESM、`verbatimModuleSyntax`（类型用 `import type`；import 带 `.js` 后缀）。格式/lint 用 biome（100 列、双引号、2 空格）。测试是纯的 —— 不碰 fs/网络；`query` 函数可注入，所以测试永不联网。

### 设计不变量

非有明确理由不要动（详见 `DESIGN.md`）：

1. **brief = 状态，session = 缓存** —— 控制台知道的任何东西都不能只活在某个会话里。
2. **拉取，而非推送** —— 没有通知。（v2 已记录的例外：聊天用 SSE 流式呈现的是*你*发起的动作；分析守护进程做后台 LLM 工作 —— 二者都是刻意的、经用户授权的。）
3. **描述性埋点，绝不评判** —— Steel 2007。把输出做得更"激励"是一种倒退。Codex 桩宁可*什么都不返回*也不造假，正是这条的一部分。
4. **数据厂商中立，执行厂商绑定** —— 厂商逻辑只留在 `core/vendor/` 和 `chat/analyzer/`。
5. **单一轮询面** —— 一个 localhost 页面。经 `npx` 零安装，浏览器即 UI。**不是**可下载的原生应用（这正是 Tauri 被否决的原因 —— 见 `DESIGN.md`）。

### 它刻意*不*是什么

- 不是推送通知 —— 你按自己的节奏拉取。
- 不是 spec/SDD 工具 —— brief 是*恢复状态*（"我卡在哪"），不是"要造什么"。
- 不是多人协作 —— 是单人的注意力路由器。
- 不是可下载的原生应用 —— 经 `npx` 零安装，运行在你的浏览器里。

### 许可

[MIT](LICENSE)
