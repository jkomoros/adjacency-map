# Planning Workflow Tranche 3 — Design

**Date:** 2026-05-11
**Builds on:** Tranches 1 + 2 (both shipped on `planning-workflow-improvements`).
**Goal window:** ~3-4 hours.

## Context

Tranches 1 + 2 took the tool from "single-scenario viewer" to "compare alternatives, fork freely, see aggregate numbers, agents can self-verify." This tranche is two small but high-leverage fast-follows that the design agents called out, plus one obvious CLI sibling to `inspect`.

## Goals

1. The user can capture *why* a scenario was kept/rejected directly in the scenario, so the rationale travels with the data.
2. Agents (and the user via CLI) can quickly see what's different between two scenarios numerically, without opening the webapp.
3. Agents (and the user via CLI) can rank scenarios by a chosen aggregate metric — fastest way to answer "which scenario maximizes value / minimizes cost / etc."

## Non-goals

- Webapp state sidecar (`/tmp/adjacency-state.json`) — needs dev-server middleware, deferred to a future tranche when scope is justified.
- Export / screenshot — pairs nicely with decision notes (decision becomes part of the export), but not in this tranche.
- Search / filter / undo / redo — useful but bigger lifts; not blocking dogfooding.

## Workstreams

### L. Decision notes on scenarios

**Schema:** add two optional string fields to `RawScenario` and `Scenario`:

```ts
decision? : string,    // e.g., "Chosen because cost is lower and risk acceptable."
reasoning? : string;   // e.g., "Q3 spend cap, see PRD-1234."
```

Both propagate through `processMapDefinition` — the scenario extension chain should carry them too (child scenarios inherit unless they specify their own).

**UI:** when a scenario is selected (the existing summary panel in the controls), show two inline text fields below the description for `Decision` and `Reasoning`. Editable when the scenario is editable (matches the existing editing model). Empty fields render nothing in non-editing mode and a placeholder/empty input in editing mode.

**Actions:** two new thunks:
- `updateEditingScenarioDecision(decision : string)`
- `updateEditingScenarioReasoning(reasoning : string)`

Following the pattern of the existing `updateEditingScenarioDescription`.

**Storage:** the existing save path (localStorage overlays + `Save to file` → `data/<name>.edits.json`) already carries scenario objects through wholesale. The new fields ride along for free.

**Agents:** AGENTS.md should mention these fields — agents can write decision/reasoning when generating scenario proposals, so the rationale is captured from the start.

**Effort:** ~2 hrs.

### M. Scenario diff CLI

**The shape:** `npm run diff -- <file> <scenarioA> <scenarioB>`.

Output: a structured table similar to inspect's "Modified from base scenario" section, but explicitly between two named scenarios. Includes:
- Description / decision / reasoning of each scenario (so the user sees context).
- Per-property aggregate deltas at root (matches the compare-mode strip).
- Per-node value deltas, plus added/removed nodes.

**Implementation:** new `tools/diff-data.ts`. Reuses the same pattern as inspect-data.ts (regenerate manifest, dynamic-import, instantiate AdjacencyMap twice).

**Effort:** ~30 min.

### N. Scenario rank CLI

**The shape:** `npm run rank -- <file> <property>`.

Output: a sorted list of all scenarios for the file, ranked by the given property's aggregate value at the root. Format:

```
File: default
Ranking by: value (descending)

  increased-certainty       104.25
  increased-value           105.00
  (base)                    104.25
  implemented_0              98.50
  ...
```

Optional `--ascending` flag to flip sort direction. Optional `--by <other-property>` if the user prefers explicit flagging — but for one positional arg, the property name itself is the rank key.

**Implementation:** new `tools/rank-data.ts`. Iterates all scenarios (expanding arrays), instantiates AdjacencyMap for each, reads `map.result[property]`, sorts.

**Effort:** ~30 min.

## Architecture

All three workstreams are independent. Build order:
1. M (diff CLI) — smallest, builds momentum
2. N (rank CLI) — same pattern as M
3. L (decision notes) — largest, involves UI changes

Decision notes ride through the same save/load infrastructure that exists; no new state-management surface.

## Testing

- Smoke test extension: assert the diff CLI runs and produces "Modified" / "Per-property" sections, assert the rank CLI produces a sorted list, assert the Decision and Reasoning fields render when set.
- A small data-file fixture (or just add decision+reasoning to an existing scenario in `data/default.ts`) so smoke tests have something to assert against.

## Effort estimate

| Workstream | Estimate |
|---|---|
| M. Scenario diff CLI | 30 min |
| N. Scenario rank CLI | 30 min |
| L. Decision notes on scenarios | 2 hrs |
| Smoke tests | 30 min |
| **Total** | **~3.5 hrs** |

## Out of scope (carrying forward)

Deferred from prior design analysis:
- State sidecar (browser↔FS bridge)
- Export / screenshot
- Search / filter / undo / redo
- Critical path highlighting, milestone swimlanes, uncertainty radiance
- Layout improvement (#29)
- Tags UI (#21)
