# Background analysis policy

The work session owns its provider, model, effort, and speed. Background analysis
has a separate installation-wide setting under **Background analysis** in the
sidebar. It never writes `modelPrefs` or `sessionRunConfigs`.

| Mode | Behavior |
| --- | --- |
| Economical | Same provider, verified lightweight configuration; otherwise local heuristics. |
| Follow work session | Explicitly follows the session's saved/provider-observed configuration, filling missing values from workspace/model defaults. Unresolved configurations use local heuristics. |
| Off | No new background AI calls. Existing in-flight results are discarded. Local heuristics remain available. |
| Existing CLI defaults | Internal migration mode: retain the old implicit CLI defaults and existing daemon sessions until the user chooses another mode. |

New installations start in Economical. An existing database or legacy UI/daemon/
analysis file selects Existing CLI defaults. Initialization happens before runtime
workers create state. The SQLite setting is shared across instances; mode changes
increment a durable revision. It is not a per-tab work-model preference.

## Economical model compatibility

All candidates must be present in a fresh provider-owned catalog. There is no
cross-provider switch or automatic escalation to an expensive/default model.

| Provider | Configuration | Availability requirement |
| --- | --- | --- |
| Codex | `gpt-5.6-luna`, `low`, `default` speed | Live CLI catalog advertises both values. Bundled/cache catalogs cannot authorize economical calls. |
| Claude | Resolved `claude-haiku-4-5` ID; thinking disabled; fast mode off; no effort | CLI `haiku` alias resolves to the audited Haiku family. Unknown/custom mappings fail closed. Fallback model is pinned to the same model. |
| Cursor | Luna Low, non-Fast, non-Max | Exact CLI/Desktop configuration matrix entry; its vendor-owned variant is passed as `--model`. No synthesized flags or bracket strings. |
| Antigravity | `gemini-3.8-flash-low`; no extra effort | CLI catalog includes this exact slug. Parser accepts single-tab TSV, multi-space and dash formats without inventing effort metadata. |
| Copilot | Luna Low; compatible candidates Haiku 4.5 (no effort) and GPT-5 mini Low | Authenticated account catalog, permitted policy, real per-model effort. Advertised billing multiplier ranks this audited set; missing/equal billing uses Luna, Haiku, mini order. Auto is never an economical candidate. |

OpenCode uses its CLI model catalog and variants in Follow work session mode. There
is no audited economical OpenCode profile yet, so Economical uses local heuristics.

Copilot discovery uses pinned official SDK 1.0.13, explicitly bound to the user's
configured CLI executable and inherited authentication. It starts only a metadata
connection (`getAuthStatus`, `listModels`), never a session or prompt. The SDK is an
optional dependency so unsupported native runtimes or `--omit=optional` installs
retain existing behavior. SDK/protocol/auth failures fall back to help choices for
the work picker; these do not authorize economical background calls. Settings
respect `COPILOT_HOME` and `effortLevel`.

Catalogs are cached for 60 seconds per provider/workspace. Authentication changes
may take up to this interval to refresh; provider errors invalidate the catalog and
apply a 60-second cooldown, with local analysis during that interval. No paid
availability probe is used. The currently installed Copilot CLI/account was checked
via the SDK on 2026-09-16 and advertised only Auto, so it uses local analysis in
Economical mode.

## Session lifecycle

The same explicit execution configuration is passed to seed creation, analysis,
and avoidance drafting. A changed profile gets a new daemon conversation. Old and
new daemon IDs stay hidden across restarts. Product sessions created while off or
unavailable stay enrolled for later re-enabling; historical/external sessions do
not become enrolled automatically.

In-flight requests finish under their original configuration. Revision/profile and
work-configuration checks prevent their results from being reused after a change.
Analysis and drafting serialize within an instance; shared collaboration leases
prevent duplicate creation/analysis across instances. An asynchronous policy lookup
does not bypass turn-end coalescing.

When a provider reports a different model, the economical stream is stopped and
subsequent execution falls back locally. Not all providers report a model; the UI
therefore labels the profile as **Background selection**, not verified billing or
actual-model evidence. A provider can already have charged for work before its
first model report. No claim of guaranteed provider-side billing is made.

API: `GET /analyzer/settings`, `POST /analyzer/settings` with
`{"mode":"economical"|"follow"|"off"}`. `GET /session/analysis` adds `execution`
with the requested profile, source, catalog timestamp, revision and fallback reason.
Settings changes refresh the session projection without starting a batch of AI calls.

## Validation and limits

Targeted coverage includes legacy migration, durable revisions, five-provider
selection, real TSV format, account capabilities, auth/protocol/timeouts, settings
isolation, explicit parameters on all three analyzer entry points, in-flight
invalidation, model-mismatch interruption, concurrent turn coalescing, cross-instance
seed leases, API validation, and the browser selector.

No paid inference or running Attend service restart is required for these tests.
This change retains the existing seed/transcript contract. Reducing seed calls,
context size, and tool/MCP overhead remains a separate optimization.

Implementation verification (2026-09-16): 85 targeted tests and 146 server
functional tests passed, as did TypeScript, Biome, build and packed CLI installation
with optional dependencies omitted. The separate 5,000-session timing test passed
in isolation but also intermittently exceeded its 50ms limit on both this branch
and an untouched `f1d2eb7` checkout; its threshold was not changed.
