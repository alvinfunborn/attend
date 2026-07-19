# attend

一个用于管理 AI coding 任务注意力的本地网页控制台。目前已接入 Claude Code、Codex/ChatGPT 和 Cursor CLI。

[English README](README.md)

Attend 最初来自一个很简单的需求：**给任务加 tag**。

当 AI coding 工作分散在许多 session 里，只按项目或时间查找已经不够。Tag 是第一层真正有用的组织方式：把相关任务归在一起，建立专注视图，并在不重新梳理整个 workspace 的情况下回到正确的工作。由此又自然出现了一系列注意力管理问题：哪个任务还在生成？哪个已经回复？哪个在等决定？哪个可以稍后处理？哪段旁支讨论已经值得成为独立任务？

Attend 围绕这些问题逐步发展，把组织任务、判断注意力去向和继续推进对话放在同一个本地界面里。Server 默认只绑定 `127.0.0.1`。

<p align="center">
  <img src="https://raw.githubusercontent.com/alvinfunborn/attend/main/docs/assets/attend-console-demo.jpg" alt="Attend 大规模多项目 demo vault：tag、session 卡片、chat 与 queued scheduled work">
</p>
<p align="center"><sub>纯合成 demo vault：12 个项目、240 个 session、约 4,800 轮生成对话。</sub></p>

## 主要能力

- 用 tag、搜索和 Focus 视图组织多个项目里的 session，并区分正在生成、未读、待继续和已处理的任务。
- 直接在网页里新建或继续 Claude Code、Codex/ChatGPT 与 Cursor CLI 会话，支持附件、交互提问、停止和持久消息队列。
- 在 composer 旁保存 shortcuts、notes、todos 和 Goal；也可以 pin 消息，并用 `@` 把需要的上下文带入下一轮。
- Fork session、评论某条回复，或把旁支讨论升级成独立任务，同时保留它与原任务的关系。
- 编辑标题和注意力信号，查看近期工作统计，并在明暗主题之间切换。
- 所有 Attend 状态保存在本机；原始对话仍由各 vendor CLI 管理。

## 功能速览

- 浏览一个或多个项目目录下的 session；用普通词、短语、排除词、`OR` 或受限的 `%regex%` 搜索元数据和 transcript。
- 在 **All**、**Active**、**Unread** 和已保存的 **Focus** 视图之间切换；桌面端可选由筛选驱动的中间 chats 面板。
- 添加、置顶、隐藏和拖动排序 tag；按任意或全部已选 tag 以及 priority 过滤。
- 跟踪 `generating`、`new reply`、`in progress` 和 `read`；手动切换状态或批量 archive 当前视图中已查看的 session。
- 新建或继续受支持的 provider session；选择动态发现的 model、effort 和 speed，并在 provider 支持时按 session 记住设置。
- 添加或粘贴文件和图片，回答 provider 提问与表单，停止 turn，以及排队、编辑、发送、fork 或删除持久化的后续消息。
- 在三个 composer 中通过一致的时钟按钮安排一次性 message、fork、comment 或 new session；同一位置有
  多个动作时，在时间弹层内选择 Send 或 Fork。Scheduled message 直接显示在 chat 的 queued 区域，
  queued 区域中可继续编辑内容或修改时间；scheduled new session 和冻结分支点的 scheduled fork 会立刻生成
  session 卡片并显示首条消息或冻结历史。在到点前从卡片发送即时消息会立即启动真实 session，原定时消息仍按
  原时间发送；不另设 scheduled 面板。
- 编辑 session 标题、state、priority 和预计重新进入时间。
- 在 composer 旁管理机器级 shortcuts 与 session 级 notes、todos；设置受支持的 Goal，并接受 analyzer 生成的消息 draft。
- 评论某条回复，包括它仍在生成时；在隔离的 side session 中继续、排队回复，或带着父配置和上下文升级讨论。
- Pin 消息并用 `@` 引用；可包含 pin 下的纯文本 comment thread、排除 tool block，并为 queued turn 固化引用上下文。
- 折叠已完成的 turn、从 provider transcript 刷新、预览附件与 diagram，以及定位引用的本地路径。
- 从当前 draft 或 queued turn fork，沿用或切换 provider，保留运行设置和相关 notes、todos，并查看 fork tree。
- 查看近期 session、prompt、对话量和 session breadth 等本地统计。
- 切换明暗主题；Attend 管理的 session 元数据和界面偏好保存在本机。

### Analyzer 建议

Attend 创建的受支持 session 会在每轮结束后得到简短的 `brief`、`state`、`priority`、`etaMin` 和
`reason`。Analyzer 还可能提供两种可编辑消息：

- `nextStep`：预测最可能的下一条用户消息。主输入框为空且聚焦时，它显示为 ghost，按 Tab 填入。
- `probe`：针对最新一轮的具体质疑、解释或验证请求，显示在 todo 右侧，点击后填入输入框。

两者彼此独立，也都可能留空；它们只填充 draft，不会自动发送，并在下一条用户消息开始时丢弃。
历史或从 Attend 外部创建的 session 可能使用本地启发式分析。

## 快速开始

要求：

- Node.js `>= 22.13`
- 至少安装一个已支持的 CLI：Claude Code、Codex/ChatGPT 或 Cursor CLI（`cursor-agent`）

Attend 会在启动时检测这些系统 CLI，只显示实际可运行的 Vendor。如果一个都不可用，选择器会
显示所有 Vendor 并提供安装提示。Claude Code 最低要求为 `2.1.0`；版本过旧时会被禁用并
明确提示升级。

### Claude 认证

Attend 不保存另一套 Claude 登录；Claude Agent SDK 子进程会继承 Attend 进程的认证环境。

偶尔在本机使用时，可以先通过 Claude Code 登录，再启动 Attend：

```bash
claude auth login
claude auth status
attend "$PWD"
```

普通本机使用到这里就配置完了。Attend 会解析系统 `claude` 命令，并把每次 Agent SDK 调用绑定到
这一份可执行文件，因此终端与 Attend 共用版本、配置和登录链路。SDK 自带的 Claude Code 不会作为
默认值或 fallback。只有托管环境明确需要另一份可执行文件时，才设置 `ATTEND_CLAUDE_BIN`。

`claude setup-token` 只作为无人值守服务器和自动化场景的高级选项。此时由服务的 secret manager
把输出注入 `CLAUDE_CODE_OAUTH_TOKEN`，再重启 Attend；不要把 token 放进命令行参数、仓库或项目
`.env`。

无需安装，显示当前项目目录下的 session：

```bash
npx --package=@sinphife/attend attend "$PWD"
```

将 session 列表限定在指定项目目录，或修改端口：

```bash
npx --package=@sinphife/attend attend ~/projects ~/work --port 5050
```

这里的多个目录只是同一个 Attend 实例的 session 筛选范围，页面会显示这些目录的并集；它们不是多个独立 vault。启动时会解析符号链接、去重，并删除已经被父目录覆盖的子目录；同一组物理目录会得到稳定的内部 `scopeId`。需要分别管理不同 workspace 时，建议启动不同实例并使用不同端口：

```bash
attend ~/projects/product-a --port 5050
attend ~/projects/product-b --port 5051
```

这些实例共享 `~/.attend/attend.sqlite3` 中的 Attend 状态，但各自只展示命令行目录范围内的 session。数据库启用 WAL，工作事件使用索引表；标题、状态、pin、队列、tag 和 analyzer 结果等较小结构使用事务化文档行。多目录启动只是聚合视图：它会合并各单目录 scope 的 tag、Focus 视图和 tag 显示偏好（置顶/隐藏），修改时直接写入各单目录 scope，不再拥有独立的组合 scope。旧版全局 JSON 和 `<workspace>/.attend/` 状态会被幂等导入，并保留为迁移备份。原始 transcript 仍由各 vendor CLI 保存在它们自己的目录中。

保留周期按数据语义区分：活动和可重建遥测会过期，排队工作和用户显式偏好不会自动删除。详见 [存储与保留策略](docs/storage-retention.md)。

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

  dirs                         用于限定 session 列表的项目根目录
  -p, --port <n>               端口（默认：5050）
      --host <addr>            绑定地址（默认：127.0.0.1）
  -c, --config <path>          attend.config.json 路径
      --no-open                不自动打开浏览器
      --e2ee-passphrase <text> 加密浏览器与 server 之间的 API payload
  -v, --version                显示已安装版本
  -h, --help                   帮助
```

## 开发

```bash
git clone https://github.com/alvinfunborn/attend
cd attend
npm install
npm run dev
```

如需截图或进行大数据量视觉测试，可以启动纯合成 demo vault：

```bash
npm run demo:readme
```

它会在 `http://127.0.0.1:5099` 提供 demo，不会读取或修改真实的 Attend 状态。

检查：

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

## 许可

[MIT](LICENSE)
