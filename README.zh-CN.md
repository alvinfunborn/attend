# attend

一个用于管理 AI coding 任务注意力的本地网页控制台。目前已接入 Claude Code、Codex/ChatGPT 和 Cursor CLI。

[English README](README.md)

Attend 最初来自一个很简单的需求：**给任务加 tag**。

当 AI coding 工作分散在许多 session 里，只按项目或时间查找已经不够。Tag 是第一层真正有用的组织方式：把相关任务归在一起，建立专注视图，并在不重新梳理整个 workspace 的情况下回到正确的工作。由此又自然出现了一系列注意力管理问题：哪个任务还在生成？哪个已经回复？哪个在等决定？哪个可以稍后处理？哪段旁支讨论已经值得成为独立任务？

Attend 围绕这些问题逐步发展，把组织任务、判断注意力去向和继续推进对话放在同一个本地界面里。Server 默认只绑定 `127.0.0.1`。

## 从 tag 到注意力管理

- **用 tag 组织任务。** 给 session 添加 tag，按任意或全部已选 tag 过滤，并把常用筛选保存成可复用的 **Focus** 视图。
- **看清哪里需要注意力。** 在 **All**、**Active**、**Unread** 之间切换，用 `generating`、`new reply`、`in progress`、`read` 跟踪状态，并批量 archive 当前视图里已经看过的任务。
- **保留重新进入任务所需的上下文。** 搜索 session 信息和 transcript，把 shortcuts、notes、todos 和 Goal 放在 composer 旁，显式引用 pin 的上下文，并用 analyzer 信号完成紧凑交接。
- **拆分任务，同时保留来路。** 把 session fork 成相关分支并在 fork tree 中查看；也可以针对某条回复展开 comment thread，在讨论成长为独立任务时将它升级为普通 session。
- **在管理注意力的地方直接推进工作。** 继续对话、回答 provider 提问、添加附件、停止 turn，以及排队、编辑或 fork 后续消息，不必离开当前视图。
- **回看工作负载的形态。** 查看本地 session、prompt、对话量、生成重叠和 session breadth 等统计。

## 功能

下面是按当前界面控件和 tooltip 整理的完整功能列表。

- 浏览一个或多个项目目录下的 session；用普通词、短语、排除词、`OR` 或受限的 `%regex%` 搜索 session 信息和 transcript 内容。
- 在 **All**、**Active**、**Unread** 和可复用的 **Focus** 视图之间切换；桌面端还可以打开由当前筛选驱动的中间 chats 面板。
- 添加、置顶、隐藏和拖动排序 session tag；按任意或全部已选 tag 过滤，并按 priority 收窄列表。
- 用 `generating`、`new reply`、`in progress`、`read` 四种状态跟踪注意力；可以直接在列表中切换状态，也可以批量 archive 当前视图里已经看过的 session。
- 在浏览器里新建或继续已接入 vendor 的 session，为下一次操作选择动态发现的 model、effort 和 speed；provider 能提供精确值时，Attend 会按 session 记住选择。
- 添加或粘贴图片及文件，回答 provider 的交互式问题和表单，停止正在运行的 turn；后续消息可以排队、编辑、立即发送、直接 fork 或删除。队列由 server 持久维护，可跨 tab、浏览器刷新和 Attend 重启恢复。
- 编辑 session 标题，手动调整 state、priority 和预计重新接手时间。
- 在 composer 固定栏维护机器级 shortcuts 与 session 级 notes、todos；provider 支持时，可以把下一条消息设为 Goal。Analyzer 给出的 next step 只会填入 composer，绝不会自动发送。
- 评论 AI 回复，包括仍在生成的回复。评论在隔离的 side session 中继续，支持排队追加，并可带着父 session 的配置和工作上下文升级为普通 session；第一次评论会 pin 原文，后续可以从原文或对应的 pin 打开。
- pin 消息，并在主 composer 输入 `@` 引用某个 pin。若该 pin 带有 comment thread，Attend 会附带整个纯文本 thread；tool 内容块会被明确排除。排队时会冻结当时引用的上下文。
- 折叠已完成的 turn、从 transcript 刷新对话、预览附件和 diagram，以及在文件管理器中定位本地路径。
- 用当前 draft 或 queued turn 作为第一条消息 fork session；fork 可以沿用或切换 provider，分支会保留所选运行配置并复制相关 notes 和 todos，相关 session 可以在 fork tree 中查看。
- 查看近期 session 数、prompt 数、对话量和 session breadth 等本地工作统计。
- 切换明暗主题；Attend 自己维护的 session 信息和大部分界面偏好保存在本机。

部分 session 还会显示 analyzer 给出的字段：

- `brief`：当前线程的简短描述。
- `state`：建议的下一步交接状态，例如 `needs_input`、`needs_review` 或 `done`。
- `priority`：session 在当前 vault 内的相对优先级。
- `etaMin`：预计重新进入上下文需要的分钟数。
- `reason`：对当前信号的简短说明。
- `nextStep`：为明显的机械性下一步准备的可编辑 draft。

界面提供入口的字段可以手动修改。`nextStep` 只负责填充 composer，不会自行发送。历史 session
或从 Attend 外部创建的 session 可能使用本地启发式分析。

### Composer 上下文

Shortcuts 在整套 Attend 安装中共享；notes 和 todos 属于具体 session。Comment thread 默认不会进入
父 session 的后续聊天。需要带入时，先 pin 它的 anchor，再从主 composer 的 `@` picker 选择该 pin。
Server 会在发送时解析引用（排队时则立即冻结），作为隐藏的 provider context 发送，同时不让这段
上下文污染可见 transcript。

## 快速开始

要求：

- Node.js `>= 22.13`
- 至少安装一个已支持的 CLI：Claude Code、Codex/ChatGPT 或 Cursor CLI（`cursor-agent`）

Attend 会在启动时检测这些系统 CLI，只启用实际可运行的 Vendor。缺失或无法运行的 CLI 仍会在
界面中显示为不可用，并提供安装提示。Claude Code 最低要求为 `2.1.0`；版本过旧时会被禁用并
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
