# 从使用痛点到官网内容

依据 main `4935c9a` 的实现，以及作者确认的两项高频操作：**标签找任务、自定义 label**。

## 阅读覆盖

本轮按连续分块覆盖 `src/` 生产代码：`src/chat/`、`src/core/` 全部 120 个源文件；`src/server.ts`；`src/ui/console.ts`（含类型、HTML、样式、全部业务逻辑）；`src/cli.ts`、`src/config.ts`。同时阅读设计演变、更新记录、中英 README、三份 docs、scripts、legacy 与打包配置。测试阅读针对场景与边界，不等于已运行或逐行审计全部测试。

## 产品主线

并发任务多是作者的常态。目标是让人能找回、辨认并继续工作。早期 DESIGN 的 brief-centric、只读控制台与“不做聊天”已被后续迭代取代，不能当成当前能力。当前 brief 是分析器摘要，用户无需维护 brief.md。

| 使用时刻 | 功能与场景 | 代码证据 |
| --- | --- | --- |
| 记得主题，忘了在哪个工具或项目聊过 | 自定义 tag 与 vendor/project tag；任一/全部匹配；跨项目搜索 | `src/core/tags.ts`、`src/chat/search-query.ts`、`src/ui/console.ts` 的 `toggleFilterTag`、`filteredSessions` |
| 每天重复筛同一批工作 | 多个 Focus；All 中点 tag 自动进入相应 Focus；Active/Unread 局部筛选；置顶、隐藏与排序标签 | `src/core/ui-state.ts`、`src/ui/console.ts` Focus 与 tag 管理 |
| “进行中”不足以提醒自己 | 自定义状态文字与颜色；手动优先于迟到分析；下一回合清除当前状态 | `src/core/daemon/overrides.ts`、UI `saveOverride` / `clearTurnScopedSignals`、`test/overrides.test.ts` |
| 打开看过了，还没决定怎么处理 | 未读、看过待跟进、已处理与生成信号分开；手动管理注意池 | `src/core/session-status.ts`、UI attention handlers |
| 回来要重读一大段才知道下一句 | 摘要、首/最新提示、重新投入 ETA；人写 notes/todos；nextStep 与 probe 草稿 | `src/chat/analyzer/contract.ts`、UI composer rail |
| 生成中想起下一件事 | 耐久队列、编辑/删除/立即发送/分支；Stop 后保留并 park 后续项 | `src/chat/queue.ts`、server queue routes、UI `renderQueue` |
| 现在想好，晚些再开始 | 消息/新会话/分支/评论一次性定时；直接出现在现有卡片与队列 | `src/core/schedules.ts`、server schedule dispatcher、UI schedule popover |
| 一句回答值得另问，但不想拖散主线 | 选段/消息/tool comment、侧边继续、提升为普通任务；原执行目录共享 | server comment routes、UI CommentPanel |
| 关键结论被埋、分支还要复用 | Pin 消息/选段，@ 引用快照；显式带回主线 | `src/core/ui-state.ts`、server pin context、UI pin picker |
| 想换工具验证思路 | 同工具 native fork（支持时）；跨工具可见文本播种；查看分支关系 | `src/core/vendor/capabilities.ts`、server fork routes、UI fork tree |
| 每次重设工作环境 | 模型/effort/speed 预设、shortcuts、目录范围主题/布局、JSON 自定义主题 | `src/core/session-run-config.ts`、`src/core/themes.ts`、`src/core/theme-colors.ts`、UI settings |
| 想回看多任务的实际节奏 | 工作回合、切换、并行等本地统计；不是所有外部历史的完整生产力评分 | `src/core/work-events.ts`、`src/core/work-stats.ts`、`src/core/collaboration.ts` |

## 准确性边界

- Label 是当前交接状态，不是永久分类；tag 是长期组织。Label 最长 80 字，手工设置覆盖本轮迟到分析，新用户/队列回合释放。
- ETA 是人重新理解并回复的时间估计，不是模型完工时间。
- 队列 UI 没有任意拖动排序或独立暂停按钮。可以挑选发送、转分支；Stop 会 park。
- `nextStep` 与 `probe` 只填草稿；probe 会替换当前草稿。队列与定时则是用户已安排的发送。
- 评论隔离对话上下文，但与主任务共享目录且可执行修改；不能声称文件执行隔离或只读。
- 跨供应商播种有预算，不是无损迁移隐藏状态。工具 Pin 不进入 @ 的引用候选。
- Schedule 是 one-shot，执行需本地服务运行；不是关机执行或周期自动化。
- 原生 fork、steer、Goals、交互与附件按能力矩阵区分。Codex 不接受 PDF。
- 默认本地绑定不代表全部推理离线。Economical 可能跟随工作模型，Off 停止新后台 AI；原始 transcript 仍受供应商生命周期管理。
- 最新实现按目录 scope 保留主题/布局/分析设置，部分早期文档中 installation-wide 描述已过时。
- 桌面可三栏；移动端在列表与聊天之间切换，不能用三栏手机示意图。
- 240 sessions / 12 projects 来自合成 fixture，不是用户规模或性能承诺。
- 用户尚无 Ko-fi 主页，官网不发布猜测 URL；`config.mjs` 留有开关。
