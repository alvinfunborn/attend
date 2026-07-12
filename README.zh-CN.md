# attend

一个用于管理 AI coding 任务注意力的本地网页控制台。目前已接入 Claude Code、Codex/ChatGPT 和 Cursor CLI。

[English README](README.md)

Attend 最初来自一个很简单的需求：**给任务加 tag**。

当 AI coding 工作分散在许多 session 里，只按项目或时间查找已经不够。Tag 是第一层真正有用的组织方式：把相关任务归在一起，建立专注视图，并在不重新梳理整个 workspace 的情况下回到正确的工作。由此又自然出现了一系列注意力管理问题：哪个任务还在生成？哪个已经回复？哪个在等决定？哪个可以稍后处理？哪段旁支讨论已经值得成为独立任务？

Attend 围绕这些问题逐步发展，把组织任务、判断注意力去向和继续推进对话放在同一个本地界面里。Server 默认只绑定 `127.0.0.1`。

## 从 tag 到注意力管理

- **用 tag 组织任务。** 给 session 添加 tag，按任意或全部已选 tag 过滤，并把常用筛选保存成可复用的 **Focus** 视图。
- **看清哪里需要注意力。** 在 **All**、**Active**、**Unread** 之间切换，用 `generating`、`new reply`、`in progress`、`read` 跟踪状态，并批量 archive 当前视图里已经看过的任务。
- **保留重新进入任务所需的上下文。** 搜索 session 信息和 transcript，编辑标题、pin 重要消息，并用 `brief`、`state`、`priority`、`etaMin`、`reason` 提供紧凑的交接信号。
- **拆分任务，同时保留来路。** 把 session fork 成相关分支并在 fork tree 中查看；也可以针对某条回复展开 comment thread，在讨论成长为独立任务时将它升级为普通 session。
- **在管理注意力的地方直接推进工作。** 继续对话、添加附件、停止 turn，以及排队或编辑后续消息，不必离开当前视图。
- **回看工作负载的形态。** 查看本地 session、prompt、对话量、生成重叠和 session breadth 等统计。

## 功能

下面是按当前界面控件和 tooltip 整理的完整功能列表。

- 浏览一个或多个项目目录下的 session，并搜索 session 信息和 transcript 内容。
- 在 **All**、**Active**、**Unread** 和可复用的 **Focus** 视图之间切换。
- 给 session 添加 tag，按任意或全部已选 tag 过滤，并按 priority 收窄列表。
- 用 `generating`、`new reply`、`in progress`、`read` 四种状态跟踪注意力；可以直接在列表中切换状态，也可以批量 archive 当前视图里已经看过的 session。
- 在浏览器里新建或继续已接入 vendor 的 session，并为下一次操作选择 vendor 及其支持的运行选项。
- 添加或粘贴图片及文件，停止正在运行的 turn；后续消息可以排队、编辑、立即发送或删除。
- 编辑 session 标题，手动调整 state、priority 和预计重新接手时间。
- 评论 AI 回复，包括仍在生成的回复。评论在隐藏的 side session 中继续，支持排队追加，并可升级为普通 session；第一次评论会 pin 原文，后续可以从原文或对应的 pin 打开。
- pin 消息、折叠已完成的 turn、从 transcript 刷新对话、预览附件和 diagram，以及在文件管理器中定位本地路径。
- 用当前 draft 作为第一条消息 fork session；fork 可以沿用或切换 provider，相关 session 可以在 fork tree 中查看。
- 查看近期 session 数、prompt 数、对话量和 session breadth 等本地工作统计。
- 切换明暗主题；Attend 自己维护的 session 信息和大部分界面偏好保存在本机。

部分 session 还会显示 analyzer 给出的字段：

- `brief`：当前线程的简短描述。
- `state`：建议的下一步交接状态，例如 `needs_input`、`needs_review` 或 `done`。
- `priority`：session 在当前 vault 内的相对优先级。
- `etaMin`：预计重新进入上下文需要的分钟数。
- `reason`：对当前信号的简短说明。

界面提供入口的字段可以手动修改。历史 session 或从 Attend 外部创建的 session 可能使用本地启发式分析。

## 快速开始

要求：

- Node.js `>= 20`
- 至少安装一个已支持的 CLI：Claude Code、Codex/ChatGPT 或 Cursor CLI（`cursor-agent`）

扫描当前目录：

```bash
npx @sinphife/attend
```

扫描指定项目目录或修改端口：

```bash
npx @sinphife/attend ~/projects ~/work --port 5050
```

也可以全局安装 `attend` 命令：

```bash
npm install --global @sinphife/attend
attend
```

直接从 GitHub 运行：

```bash
npx github:alvinfunborn/attend
```

除非设置 `--no-open`，Attend 会打开 `http://localhost:5050`。

## CLI

```text
attend [dirs...] [options]
attend new <name>

  dirs                         用于限定 session 列表的项目根目录
  new <name>                   创建 projects/<name>/brief.md
  -p, --port <n>               端口（默认：5050）
      --host <addr>            绑定地址（默认：127.0.0.1）
  -c, --config <path>          attend.config.json 路径
      --no-open                不自动打开浏览器
      --e2ee-passphrase <text> 加密浏览器与 server 之间的 API payload
  -h, --help                   帮助
```

## 开发

```bash
git clone https://github.com/alvinfunborn/attend
cd attend
npm install
npm run dev
```

检查：

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

## 许可

[MIT](LICENSE)
