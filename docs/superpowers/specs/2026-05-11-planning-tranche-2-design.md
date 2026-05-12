# Planning Workflow Tranche 2 — Design

**Date:** 2026-05-11
**Builds on:** `docs/superpowers/specs/2026-05-11-planning-workflow-improvements-design.md` (tranche 1, already shipped on `planning-workflow-improvements`)
**Goal window:** ~10 hours of work. Lands before the next planning session.

## Context

Tranche 1 turned this from "a scenario viewer" into "a scenario viewer with a tight agent-edit loop and reliable error surfacing." It works. But it's still single-scenario at a time — the user sees ONE thing, has to flip between scenarios, and has to hold numbers in their head to compare alternatives.

Real product/roadmap planning is *choosing between alternatives.* This tranche moves the tool from "visualize one scenario" to "generate, compare, and choose between alternatives with hard numbers."

Four design agents independently surfaced the same four highest-leverage additions:
1. **Scenario comparison view** — see two scenarios side-by-side with deltas annotated.
2. **Aggregate metrics dashboard** — always-visible totals (cost, value, ROI, certainty) for the current scenario.
3. **Fork scenario** — one-click clone an existing scenario to a new editable one.
4. **Inspect-data CLI** — agents self-verify numerical changes without bothering the user.

Together they're roughly 10 hours, mostly additive, and they unlock the activities a real planning session demands.

## Goals

1. The user can put two scenarios on screen at once and see numerically and visually what differs.
2. Aggregate totals (cost, value, ROI, etc.) are always visible — no clicking required to see if a scenario is "good."
3. Forking a scenario to try an alternative is one click.
4. Agents iterating on data can self-check their changes by running a CLI, freeing the user from being a verification bottleneck.

## Non-goals

Deferred to future tranches:
- Decision notes on scenarios (small but separate concern; ~1 hr; can land as a fast-follow if this tranche goes quickly).
- Webapp-state sidecar (`/tmp/adjacency-state.json`) for cross-process awareness (~45 min; same fast-follow bucket).
- Search / filter nodes (~2 hrs).
- Undo / redo in the editor (~2-3 hrs).
- Export / screenshot (~2 hrs).
- Critical path highlighting, milestone swimlanes, uncertainty radiance, scenario progression view — all real wins but they polish the existing single-scenario capability rather than open new ones.
- Layout improvement (issue #29).
- Tags UI (#21), live editing UI (#24).

## Workstreams

### H. Scenario comparison view

**The shape:** the existing single-scenario route stays. A new "compare" mode is toggled via a UI control AND directly addressable via URL. When in compare mode, two `<adjacency-map-diagram>` elements render side-by-side. Above them, a small numerical-diff strip shows "Scenario A: cost 47 | Scenario B: cost 52 | Δ +5". Nodes that have value changes between A and B get a small badge or color tint.

**URL encoding:** extend the existing hash format. Today: `#s=foo&n=node:bar`. Add: `#c=other-scenario` meaning "compare current scenario `s=` against `c=`." When `c` is present, render compare mode.

**Implementation surface:**
- `src/types.ts` — extend `URLHashArgs` with `c?: ScenarioName`.
- `src/actions/app.ts` — parse `c` in `parseHash`/`ingestHash`; new action `updateCompareScenario(name?)`.
- `src/reducers/data.ts` — store `compareScenarioName` alongside `scenarioName`.
- `src/selectors.ts` — `selectCompareScenarioName`, `selectCompareAdjacencyMap` (analogous to `selectAdjacencyMap` but for the comparison scenario), `selectComparisonDelta` (per-node and aggregate value diffs).
- `src/components/main-view.ts` — render the diff strip + the second diagram when in compare mode.
- `src/components/adjacency-map-diagram.ts` — accept a `compareMap` prop; when present, render at half-width and add a `diff` class to nodes whose values differ.
- `src/components/adjacency-map-controls.ts` — a "Compare with…" dropdown that picks the second scenario (or clears compare).

**Diff strip content:** for each property in `map.result` that exists in both scenarios, show `value-a / value-b / Δ`. Color the delta by sign. Skip properties that are 0 in both.

**Visual diff annotations:** for each `LayoutID` that exists in both maps, compare the per-node `values` object. Nodes with any value delta get a `diff-changed` CSS class. Nodes present in only one scenario get `diff-added` or `diff-removed`. These compose with the existing `selected` / `dim` / `accent` classes.

**Risk:** medium. The biggest unknown is layout stability: if scenario B removes a node, the layout shifts, making side-by-side comparison visually noisier. Mitigation: render both maps with their own independent layouts. We're not trying to align positions across maps — the diff strip carries the precise numerical comparison.

**Effort:** ~4-5 hrs.

### I. Aggregate metrics dashboard

**Core insight:** `map.result` (in `adjacency-map.ts:981`) already aggregates property values across the whole map. The existing sidebar shows it when nothing is selected ("Union of all nodes"). The work is making this prominently visible *always*, not buried below a selection.

**The shape:** a thin strip above the diagram (or in a fixed corner of the sidebar) that always shows 3-5 headline metrics for the current scenario. When in compare mode (workstream H), the strip splits to show both scenarios' metrics with deltas.

**Configurable headlines:** the data file's existing `display` configuration already drives node/edge styling. Extend it with a `headlineMetrics?: PropertyName[]` field — the data file says which properties to surface. If unset, pick all properties whose value at root is non-zero.

**Implementation surface:**
- `src/types.ts` — extend `RawMapDisplay` with `headlineMetrics?: PropertyName[]`.
- `src/selectors.ts` — `selectHeadlineMetrics` returns `{property, value}[]` derived from `map.result` filtered by the data's `headlineMetrics` config (or auto-picked).
- `src/components/main-view.ts` — render a `<div class='metrics-strip'>` above the diagram (or above the diff strip in compare mode). Each metric is a small card: label + value.
- `src/components/adjacency-map-controls.ts` — leave the existing sidebar Values block alone; it still works for inspecting per-node values.

**Edge case:** when an error banner is showing (no map), the strip should hide cleanly.

**Risk:** low. Logic already exists; this is mostly placement and styling.

**Effort:** ~2 hrs.

### J. Fork scenario

**The shape:** a "Fork" button next to the scenario dropdown. Clicking it:
1. Prompts for a new scenario name (or auto-suggests `<source>-fork`).
2. Creates a new entry in the localStorage overlay for the current file, named the new name.
3. The new entry's `nodes` object is a deep copy of the current scenario's fully-resolved node overrides (NOT an `extends:` — fully materialized).
4. Switches the current scenario to the new fork.

**Why fully materialized, not `extends`:** `extends:` creates a dependency on the parent. If the user later edits the parent scenario, the fork picks up those changes — usually NOT what someone wants when they fork. Materializing decouples the fork from the source, which is the expected "make a copy" mental model.

**Implementation surface:**
- `src/actions/data.ts` — new thunk `forkScenario(sourceName?: ScenarioName, newName?: ScenarioName)`. Reads the current map's resolved scenario via `selectAdjacencyMap` (which gives us the post-`processMapDefinition` form), serializes the node overrides back into the raw form, writes to the overlay, dispatches scenario-name change.
- `src/reducers/data.ts` — handle a new `FORK_SCENARIO_SUCCESS` action that writes the new scenario into `scenariosOverlays[filename]`.
- `src/components/adjacency-map-controls.ts` — Fork button + a small modal or prompt for the new name.

**Edge cases:**
- Forking the base (unnamed) scenario — fine, materialize from `map.nodes` defaults.
- Name conflicts — surface error in UI; suggest a unique suffix.
- Forked scenarios that should later "rebase" onto a different base — out of scope. The fork is independent.

**Risk:** low. Requires careful serialization of `ScenarioNode` → `RawScenario.nodes[id]`. Most fields map directly; edges need to be re-expressed as `add`/`remove`/`modify` (in this case, since we're materializing, treat all of the fork's edges as direct `add`s with the base edges treated as removed). Test cases for the serializer should cover round-trip identity.

**Effort:** ~1.5 hrs.

### K. Inspect-data CLI

**The shape:** `npm run inspect <file> [scenario]` prints a structured summary. Output format (text, readable but parseable):

```
File: default
Scenario: increased-certainty
Description: Override to increase the certainty of certain values...

Nodes: 9 (1 omitted)
Edges: 14
Aggregate (root):
  certainty:     1.00
  value:        118.50
  expectedValue: 67.32
  engineering:   98.0
  ux:            39.5
  cost:           7.5

Top 5 nodes by value:
  base_pipeline   value=24.0
  base_train      value=20.0
  base_infer_gui  value=18.5
  ...

Modified from base scenario:
  base_pipeline.certainty: 0.5 → 0.8 (+0.3)
  base_train.implemented:  0   → 1.0
```

**Without a scenario argument:** prints the same for the base scenario, plus a list of all available scenarios with their description.

**Implementation surface:**
- `tools/inspect-data.ts` — new file. Same shape as `tools/validate-data.ts`: runs `generate:config`, imports `DATA` and `SIDECAR_EDITS`, instantiates `AdjacencyMap`, walks `map.result` and `map.layoutNodes` to build the report.
- `package.json` — `"inspect": "node --loader ts-node/esm tools/inspect-data.ts"`.
- `AGENTS.md` — add a new section: "After editing a data file, run `npm run validate` AND `npm run inspect <file> <scenario>` to confirm the numerical effect of your change before claiming done."

**Risk:** low. Mostly data-formatting code.

**Effort:** ~1.5 hrs.

## Architecture & dependencies

```
H (compare) ─┬─ uses URL hash extension, parallel to existing s= n=
             └─ overlays diff classes on existing diagram (workstream D's classes still work)

I (metrics) ─── standalone; reads existing map.result; both H and I read it

J (fork)    ─── standalone; writes to localStorage overlay path

K (inspect) ─── standalone tool; reuses same import path as validate-data
```

Build order: **K → I → J → H** (smallest first; H is the largest and depends on classes/state that don't conflict but get cleaner if metrics-strip is already in place).

## Testing

- **Compare-mode smoke test:** extend `tools/smoke-test.mjs` with a section that navigates to `#s=increased-certainty&c=` (empty compare) then to `#s=increased-certainty&c=increased-value` and asserts both diagrams render, the diff strip is populated, at least one node has the `diff-changed` class.
- **Metrics dashboard smoke test:** assert the metrics strip is always visible, shows at least one metric, and updates when scenario changes.
- **Fork smoke test:** click Fork in the UI, confirm a new scenario appears in the dropdown, confirm switching to it shows the same diagram as the source, confirm an edit to the fork doesn't affect the source.
- **Inspect CLI:** add a section to the existing test pipeline (`test:all`) that runs `npm run inspect default` and asserts exit 0 and that the output contains "Aggregate".
- **Unit tests:** at least one test for the fork serializer (round-trip ScenarioNode → Raw → AdjacencyMap → ScenarioNode produces the same effective output).

## Effort estimate

| Workstream | Estimate |
|---|---|
| K. Inspect-data CLI | 1.5 hrs |
| I. Aggregate metrics dashboard | 2 hrs |
| J. Fork scenario | 1.5 hrs |
| H. Scenario comparison view | 4-5 hrs |
| Smoke tests + integration | 1 hr |
| **Total** | **~10-11 hrs** |

## Out of scope (deliberate)

Carrying forward the cuts from tranche 1, plus:
- Aligning node positions across compared scenarios (let layouts vary independently — diff strip carries precise numbers).
- Bidirectional fork-then-merge (we materialize on fork; no merge back).
- A query language for the inspect CLI (`map nodes where cost > 5`) — useful but defer until we know what queries the user actually wants.
- Saving inspect output anywhere — it's stdout, agents capture what they need.

## Open questions for the user before implementation

(None blocking — but worth confirming during implementation:)
1. **Headline metric default:** should the metrics strip show ALL properties whose root value is non-zero, or pre-pick a sensible default like `value` + `cost` + `expectedValue` + `certainty`? Recommend: data-file `headlineMetrics` config takes precedence; falls back to "all non-zero properties" with a soft cap of 6.
2. **Fork naming:** auto-suggest `<source>-fork` or always prompt? Recommend: auto-fill, but keep the prompt so user can rename in one keystroke.
3. **Compare mode visual treatment:** when a node exists in scenario A but is removed in B, render it in B as a faint ghost (so positions align) or just omit it (so the layout reflows)? Recommend: omit. Trying to maintain ghosts forces shared layout, which loses the per-scenario layout quality.
