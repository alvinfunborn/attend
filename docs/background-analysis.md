# Background analysis policy

The work session owns its provider, model, effort, and speed. Background analysis
defaults to Economical without a sidebar setting. It never writes `modelPrefs`
or `sessionRunConfigs`. The internal API retains explicit mode overrides.

| Mode | Behavior |
| --- | --- |
| Economical | Same provider, verified lightweight configuration; otherwise follow the work session. Unresolved work configurations use local heuristics. |
| Follow work session | Explicitly follows the session's saved/provider-observed configuration, filling missing values from workspace/model defaults. Unresolved configurations use local heuristics. |
| Off | No new background AI calls. Existing in-flight results are discarded. Local heuristics remain available. |
| Existing CLI defaults | Internal migration mode: migrated automatically to Economical. |

New and existing installations default to Economical. Persisted Existing CLI
defaults are migrated to Economical, incrementing the durable revision to invalidate
in-flight results. Explicit API overrides are preserved. The SQLite setting is
shared across instances; it is not a per-tab work-model preference.

## Economical model compatibility

All candidates must be present in a fresh provider-owned catalog. There is no
cross-provider switch. If no candidate is available, background analysis follows
the work session, including its model, effort, and speed.

| Provider | Configuration | Availability requirement |
| --- | --- | --- |
| Codex | `gpt-5.6-luna`, `low`, `default` speed | Live CLI catalog advertises both values. Bundled/cache catalogs cannot authorize economical calls. |
| Claude | Resolved `claude-haiku-4-5` ID; thinking disabled; fast mode off; no effort | CLI `haiku` alias resolves to the audited Haiku family. Unknown/custom mappings fail closed. Fallback model is pinned to the same model. |
| Cursor | Luna Low, non-Fast, non-Max | Exact CLI/Desktop configuration matrix entry; its vendor-owned variant is passed as `--model`. No synthesized flags or bracket strings. |
| Antigravity | `gemini-3.8-flash-low`; no extra effort | CLI catalog includes this exact slug. Parser accepts single-tab TSV, multi-space and dash formats without inventing effort metadata. |
| Copilot | Luna Low; compatible candidates Haiku 4.5 (no effort) and GPT-5 mini Low | Authenticated account catalog, permitted policy, real per-model effort. Advertised billing multiplier ranks this audited set; missing/equal billing uses Luna, Haiku, mini order. Auto is never an economical candidate. |

OpenCode uses its CLI model catalog and variants in Follow work session mode. There
is no audited economical OpenCode profile yet, so Economical falls back to Follow work session.

Copilot discovery uses pinned official SDK 1.0.13, explicitly bound to the user's
configured CLI executable and inherited authentication. It starts only a metadata
connection (`getAuthStatus`, `listModels`), never a session or prompt. The SDK is an
optional dependency so unsupported native runtimes or `--omit=optional` installs
retain existing behavior. SDK/protocol/auth failures fall back to help choices for
the work picker; these do not authorize economical background calls. Settings
respect `COPILOT_HOME` and `effortLevel`.

Background analysis catalogs are loaded only when a task needs policy resolution,
and are cached for 60 seconds per provider/workspace. Authentication changes
may take up to this interval to refresh; provider errors invalidate the catalog and
apply a 60-second cooldown, with local analysis during that interval. No paid
availability probe is used. The currently installed Copilot CLI/account was checked
via the SDK on 2026-09-16 and advertised only Auto; under the current policy, that
catalog triggers the work-session fallback in Economical mode.

The work-model picker uses a separate one-hour in-memory catalog cache for all
providers. Available providers are prewarmed asynchronously at server startup and
automatically refreshed hourly after successful discovery. Minute timer ticks only
check expiry; they do not request a fresh catalog each minute. Concurrent requests
share discovery, and cached lists are returned immediately during refresh. Only an
initial request without a cached list waits for discovery. Failures retain the last
list and retry after 1, 2, 4, 8, 16, 32, then 60 minutes; success resets this backoff.
Unavailable providers are skipped. The cache-only Codex fallback reads its local
file on request without network discovery. Executable version checks at startup
and task-triggered background analysis discovery are separate from this policy.

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
subsequent execution falls back locally. Not all providers report a model; the execution profile is requested configuration,
not verified billing or actual-model evidence. A provider can already have charged for work before its
first model report. No claim of guaranteed provider-side billing is made.

API: `GET /analyzer/settings`, `POST /analyzer/settings` with
`{"mode":"economical"|"follow"|"off"}`. `GET /session/analysis` adds `execution`
with the requested profile, source, catalog timestamp, revision and fallback reason.
Settings changes refresh the session projection without starting a batch of AI calls.

## Validation and limits

Regular daemon verdicts also suggest business issue tags without a separate model
call. Normally one tag names the business object and its concrete problem or
desired change. Extra tags require independently resolvable issues in the same
session, with a safety limit of three tags (24 characters, at most four words each).

The prompt identifies the issue from the conversation before consulting the current
session's tags and up to twelve recent tagged sessions in the same project. These
records pair subjects with labels so the same issue can keep one name across turns
and sessions. Existing labels are fallible, and matching a project or component
alone does not establish the same issue. A different issue can receive a new name.
A few manually tagged sessions teach naming style only. No global candidate catalog
or frequency ranking is supplied. Automatic assignments can provide issue continuity,
but do not count as manual style evidence. Persistence merges equivalent spellings;
semantic matching remains the analyzer's responsibility. Existing catalog entries
are not migrated or deleted by this change.

New catalog tags created by the daemon start in the Hidden area of the scope's
tag filters; their session chips stay visible. Reusing an existing tag leaves its
visibility unchanged, including tags the user has restored from Hidden.

Attend reconciles only automatic tags and preserves manual assignments. Manual
removals are remembered, clearing a session's tags disables automatic tagging for
that session, and deleting or unbinding a catalog tag blocks automatic reuse until
it is explicitly created again. Adding tags manually re-enables that session.
An untagged new session or a legacy empty assignment does not disable tagging;
only a recorded manual clear does.
Changes persist under the stable session ID and update the live session projection.
Only accepted fresh verdicts can write tags; older cached returns, stale results,
and results discarded after turning the daemon off cannot. External sessions without
a daemon are unchanged.

Targeted coverage includes legacy migration, durable revisions, five-provider
selection, real TSV format, account capabilities, auth/protocol/timeouts, settings
isolation, explicit parameters on all three analyzer entry points, in-flight
invalidation, model-mismatch interruption, concurrent turn coalescing, cross-instance
seed leases, API validation, and absence of the sidebar settings.

No paid inference or running Attend service restart is required for these tests.
This change retains the existing seed/transcript contract. Reducing seed calls,
context size, and tool/MCP overhead remains a separate optimization.

Implementation verification (2026-09-16): 85 targeted tests and 146 server
functional tests passed, as did TypeScript, Biome, build and packed CLI installation
with optional dependencies omitted. The separate 5,000-session timing test passed
in isolation but also intermittently exceeded its 50ms limit on both this branch
and an untouched `f1d2eb7` checkout; its threshold was not changed.
