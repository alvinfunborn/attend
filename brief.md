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

v1 roadmap (`DESIGN.md` 末尾有完整列表):
- [ ] `attend split <jsonl>` CLI: transcript → N 候选 brief
- [ ] Codex JSONL parser (待用户启用 Codex CLI 后采样 schema)
- [ ] `attend new <project>` 脚手架
- [ ] LLM-based priority option (env-flag)
- [ ] 显式 blocker 正则收紧 (现在"等"字会误触 "(作品B 等)")
- [ ] dwell 分布热力图
- [ ] in-browser brief edit

## next

v0 已 ship 并 running 在 localhost:5050。下一步真二选一:

**A.** 给几个真实项目 (`作品B` / `lifeset` / `mcp` 等) 起 `brief.md` 骨架, 让 feed 立刻有数据, 验证 cwd-based 匹配在实际项目上工作。低风险, 快速产生信号。

**B.** 写 `attend split` CLI——读 Claude JSONL transcript, LLM 抽 N 个候选 brief, 用户筛选落 vault。高 ROI, 直接消化"一个 session 越聊越发散"的痛点。

选 B 时注意: split 工具的 prompt 设计要克制——它的输出是候选, 不是答案。用户筛选环节是闸门, 不能省。

DESIGN.md 的 invariants 是 hard rule, 不要碰 (尤其 invariant 3 telemetry 中性表达 — Steel 2007)。
