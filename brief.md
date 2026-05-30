---
status: active
last_touch: 2026-05-30
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
- [x] pattern 分类 (avoidance / stalled / healthy / active / fresh), 中性表达
- [x] 优先级综合 memory keyword × pattern × 显式 blocker, 每条带 reason
- [x] detail 页 spawn 命令 (copy to clipboard)

v1.1 (shipped 2026-05, 见 DESIGN.md "v1.1: trust + cross-vendor"):
- [x] Node/TS 重写, `npx` 零安装分发, 跨 Win/macOS
- [x] Codex JSONL parser (按文档 rollout schema; 待真实样本确认)
- [x] `attend new <project>` 脚手架
- [x] 显式 blocker 正则收紧 (`等[具体内容]`)
- [x] trust 加固: avoidance 要求持续 dwell + 证据化 reason; memory alignment 改 TF-IDF cosine
- [x] vitest 46 测试, biome + tsc 干净

仍 open:
- [ ] `attend split <jsonl>` CLI: transcript → N 候选 brief (下一个高杠杆项; 输出是候选不是答案, 用户筛选闸门不能省)

deferred / killed (PM review):
- [ ] LLM-based priority (env-flag) — 推迟到启发式在真实 brief 上证明不够再做
- ~~dwell 热力图~~ / ~~in-browser edit~~ — 砍 (invariant 3 / 1)

## next

v1.1 已 ship: Node/TS + npx, Codex parser, trust 加固 (avoidance 持续 dwell + TF-IDF alignment), `attend new`。46 测试绿。两个 PM review 结论见 DESIGN.md v1.1。

下一步真二选一:

**A. (先做这个, 最高优先)** 用 `attend new` 给几个真实项目 (`作品B` / `lifeset` / `mcp`) 起 brief.md, 让 feed 有真实数据 —— 没数据无法验证 telemetry/priority 链, 也无法判断 trust 加固是否到位。低风险, 立刻产生信号。两个 PM 都把这个列为前置。

**B.** 写 `attend split` CLI——读 JSONL transcript, LLM 抽 N 个候选 brief, 用户筛选落 vault。剩下最高杠杆的 generative 项, 直接消化"一个 session 越聊越发散"。注意: 输出是候选不是答案, 用户筛选闸门不能省, LLM 走 env-flag。

待确认: Codex parser 是按开源文档 schema 写的, 本机无 Codex 装, 需在真实 rollout 文件上验证字段 (见 `src/core/vendor/codex.ts` 注释)。

DESIGN.md 的 invariants 是 hard rule, 不要碰 (尤其 invariant 3 telemetry 中性表达 — Steel 2007)。定位锚点: brief(task) 是主对象, session 派生; brief ≠ spec; 跨 vendor 是唯一护城河 (vs Agent View)。
