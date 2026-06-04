---
status: active
last_touch: 2026-05-31
defer_until:
---

## what
人与 AI 共事时的注意力 / 决策 / 发散管理。session = cache, brief = state, 跨 Claude + Codex vendor-neutral。本地网页 dashboard, single polling surface 替代多 IDE tab 的 polling。

完整设计上下文在 `DESIGN.md` (问题 / 模型 / 组件 / 拒绝的路径 / research touchstones)。后续 session 进来读这一份就能 onboard。

## accept

v0 (shipped):
- [x] daemon 跑在 localhost:5050
- [x] 扫描 vault, 渲染 ranked feed
- [x] Claude JSONL telemetry: sessions / prompts / actions / dwell / last_touch
- [x] pattern 分类收敛为 3 个可见信号 (avoidance / stalled / healthy), 中性表达
- [x] 优先级综合 memory keyword × pattern × 显式 blocker, 每条带 reason
- [x] detail 页 spawn 命令 (copy to clipboard)

v1.1 (shipped 2026-05, 见 DESIGN.md "v1.1: trust + cross-vendor"):
- [x] Node/TS 重写, `npx` 零安装分发, 跨 Win/macOS
- [x] Codex JSONL parser (按文档 rollout schema; 待真实样本确认)
- [x] `attend new <project>` 脚手架
- [x] 显式 blocker 正则收紧 (`等[具体内容]`)
- [x] trust 加固: avoidance 要求持续 dwell + 证据化 reason; memory alignment 改 TF-IDF cosine
- [x] vitest 46 测试, biome + tsc 干净

- [x] split = 手动 fork (无 LLM): detail 页每个 session 一个 "split ⑂" 按钮, 调 vendor fork CLI (`claude --resume <id> --fork-session` / `codex fork <id>`) 在新终端开 fork, 刷新后 split 出来 (v1.2; 显式覆盖 spawn=copy-only invariant)

v2 (shipped, 见 DESIGN.md "v2"→"v2.2"):
- [x] 浏览器内 chat console: Claude Agent SDK 驱动, 续聊/新建/fork 全在页内 (SSE 流式); Codex 仍走终端 launcher
- [x] 信号跟着 session 走 (per-session pattern/priority/telemetry), `/briefs` 降为可选 rollup
- [x] memory/session 分层 (2026-05-31): session 推断 brief/埋点/pattern(含回避); 整个 memory 推断优先级(记忆主导, pattern 仅微调)与 ETA(按对齐深度, 不再用 transcript 字数)
- [x] brief 顶部内联显示 (name + 单行 what summary, 服务端截短), 无需点击

deferred / killed (PM review):
- [ ] LLM-based priority (env-flag) — 推迟到启发式在真实 brief 上证明不够再做
- ~~LLM 版 attend split~~ — 用户改为手动 fork, 不用 LLM (见上)
- ~~dwell 热力图~~ / ~~in-browser edit~~ — 砍 (invariant 3 / 1)

## next

v1.1 已 ship: Node/TS + npx, Codex parser, trust 加固 (avoidance 持续 dwell + TF-IDF alignment), `attend new`。46 测试绿。两个 PM review 结论见 DESIGN.md v1.1。

split(手动 fork)已 ship。下一步最高优先:

**用 `attend new` 给几个真实项目 (`作品B` / `lifeset` / `mcp`) 起 brief.md**, 让 feed 有真实数据 —— 没数据无法验证 telemetry/priority/trust 加固是否到位。低风险, 立刻产生信号。两个 PM 都把这个列为前置。

待确认 (需真机):
- Codex parser 按开源文档 schema 写, 本机无 Codex, 需真实 rollout 文件验证字段 (见 `src/core/vendor/codex.ts` 注释)。
- split ⑂ 的终端启动: Windows 路径本机可测; macOS (`osascript`) 与真实 `claude/codex` fork 需你在装了 vendor 的机器上点一次确认。

DESIGN.md 的 invariants 是 hard rule, 不要碰 (尤其 invariant 3 telemetry 中性表达 — Steel 2007)。定位锚点: brief(task) 是主对象, session 派生; brief ≠ spec; 跨 vendor 是唯一护城河 (vs Agent View)。
