# Planning Workflow Improvements — Design

**Date:** 2026-05-11
**Branch:** `planning-workflow-improvements`
**Goal window:** ~1.5–2 days of work, before user begins dogfooding for real product/roadmap planning.

## Context

`adjacency-map` is a TypeScript / lit-element webapp that loads adjacency-map data files (TS modules under `data/`) and renders them as interactive graphs for scenario planning. The owner plans to use it for real product/roadmap planning over the next few days, with AI coding agents editing `data/*.ts` files on disk and the webapp visualizing the resulting scenarios.

Four parallel exploration agents audited the codebase. The consistent picture:

- The edit-refresh loop is broken: `data/*.ts` changes require manual `npm run generate:config` before they're visible. Agents and the user will forget.
- Validation errors are caught but not reliably surfaced; malformed data produces silent failures (issue #23).
- Several issues are already partly wired in the code and just need finishing (#22 node inspection).
- The codebase is otherwise in solid shape — no major rewrites needed.

A subsequent critic agent confirmed the design directions and corrected one major assumption: web-dev-server does **not** have ES-module HMR. A real "soft reload" would require building a custom signaling layer. Full reload + URL-persisted selection achieves ~95% of the value at a fraction of the risk.

## Goals

1. The agent-edit → browser-refresh loop is automatic and reliable: agent edits `data/*.ts`, webapp updates with no manual step.
2. When data is malformed, the user sees the error immediately and clearly.
3. The user can click any node to inspect its properties and see its place in the graph.
4. The user can omit nodes from scenarios for "what if X didn't exist" exploration.
5. AI agents have the docs and tooling to edit data files reliably without bothering the user with mechanics.

## Non-goals (deliberate cuts)

- Side-by-side scenario diff (valuable but big)
- Save-back-to-file (keep the existing readout→paste flow)
- Pan/zoom (#29)
- Screenshotting (#9)
- In-UI scenario editing (#24) — agent-driven editing replaces this need
- Tags (#21), meta nodes (#12), value-definition polish (#3/#4), multi-input-files (#7)
- Layout improvements (#29)

These remain open and can be picked up later.

## Workstreams

### A. Tight edit-refresh loop

**Mechanism:** chokidar file watcher on `data/**/*.ts`, started alongside `wds` in the existing `npm run serve` script. On change, runs `tools/config.ts` to regenerate `src/data.GENERATED.ts`. Because `data.GENERATED.ts` is in `src/` and watched by `wds`, the browser auto-reloads via wds's built-in file watching.

**Selection persistence across full reload:** add the currently-selected node ID to the URL (alongside the existing `file` and `scenario` URL params). On load, the app reads this and restores selection. Combined with existing URL params (file, scenario) and localStorage (edit overlays), a full reload preserves essentially everything the user cares about.

**Implementation surface:**
- New `tools/watch-data.ts` (or extend `tools/config.ts` with `--watch` flag) that uses chokidar to monitor `data/**/*.ts` and re-runs the existing generation logic.
- Update `npm run serve` in `package.json` to launch the watcher in parallel with `wds` and `tsc --watch`.
- Add `selectedLayoutID` to the URL state. Existing URL handling lives in `src/components/main-view.ts` and `src/actions/`. Wire selection changes to update the URL, and URL parsing on load to restore selection.
- Add a guard in selectors / a Redux middleware that nulls out `selectedLayoutID` if it doesn't resolve to a node in the current scenario's graph. Prevents stale-ID crashes after reload, scenario switch, or omit toggle.

**Risk:** low. wds reload is well-established; URL state management is already in place for other fields.

### B. Persistent visible validation errors (issue #23)

**Mechanism:** a `<div>` near the top of the main view that conditionally renders whenever `selectAdjacencyMapError(state)` returns a non-empty value. Binds directly on the selector return value via lit's template binding — does **not** rely on a separate property change-detection path (which is the bug the audit identified).

**Content:** the raw error message from the `AdjacencyMap` constructor, plus the file and scenario context if available, plus a "Reload" link.

**Implementation surface:**
- `src/components/main-view.ts` — add the error banner element and the lit binding.
- Confirm `selectAdjacencyMapError` exists in `src/selectors.ts` and returns the format we need; extend if necessary.
- Style: visible, non-dismissable while error persists; sits above the diagram.

**Risk:** low.

### C. Small robustness fixes

- `src/util.ts:107-111` (`fetchOverlaysFromStorage`): wrap `JSON.parse` in try/catch. On failure, log `console.warn` with the parse error, return an empty `ScenariosOverlays` object. Prevents corrupted localStorage from crashing app boot.
- Any other small robustness issues that surface during implementation get added here.

**Risk:** trivial.

### D. Node inspection with neighbor highlighting (issue #22)

The audit found click handling and sidebar updates are mostly already wired. This workstream finishes #22.

**Additions:**
- **Neighbor highlighting:** when a node is selected, dim non-neighbor nodes in the SVG via CSS opacity, and accent direct in/out edges with a stronger stroke. Implementation in `src/components/adjacency-map-diagram.ts`. Compute the neighbor set from the selected node's parents and children. Apply CSS classes (e.g., `selected`, `neighbor`, `dim`) to rendered elements.
- **Esc to deselect:** keyboard handler in `src/components/main-view.ts` alongside the existing arrow-key scenario navigation. Esc clears `selectedLayoutID` (which also clears the URL param).

**UX details:**
- Dim transition: ~200ms ease. If it feels sluggish on large graphs, drop the transition and toggle classes instantly.
- Selection survives across reloads (workstream A).

**Risk:** low to medium. Visual polish on the highlight may need iteration.

### E. Omit nodes from scenarios (issue #26)

**Schema:** new boolean field `removed` on per-scenario node overrides:

```ts
scenarios: {
  'no-feature-x': {
    nodes: {
      feature_x: { removed: true }
    }
  }
}
```

**Semantics** (per issue #26 body and confirmed with user):

The data model: each node declares zero or more edges; each edge points to a `parent` node (the thing this node depends on). So if node `A` has an edge with `parent: 'B'`, A depends on B.

When `B` has `removed: true` in the current scenario:
- `B` is excluded from graph rendering and from `AdjacencyMap` computation as if it didn't exist.
- `B`'s own edges (the dependencies B itself declares) are dropped because B isn't there to have dependencies.
- Edges declared by *other* nodes that point to `B` as `parent` are silently dropped from those nodes.
- Nodes whose only parent-edge was to `B` become orphaned (they remain as disconnected nodes unless they have other parents).
- Underlying data is preserved; toggling `removed: false` (or removing the override) instantly restores the node. The data is never destructively modified.

**Implementation surface:**
- `src/types.ts` — add `removed?: boolean` to the scenario-node override type. Ensure no other types reject it.
- `src/adjacency-map.ts` — add a filter step early in graph construction (before `_cachedChildren` is built around line 862) that drops nodes whose effective scenario override has `removed: true`. Edges referencing dropped nodes are also dropped.
- Selection guard (workstream A) handles the case where the currently-selected node gets omitted: selection clears.

**Tests** (new file under `test/`):
- Omit a leaf node (no children) — node disappears, parent unaffected.
- Omit an internal node — node disappears, children with edges only to it become orphans, other relationships preserved.
- Omit a node and toggle back on — full restoration.
- Reference a non-existent omitted node — should be a no-op, not an error.
- Edge from a removed node — silently dropped, no error.

**Risk:** medium. `adjacency-map.ts` is 2100 lines; the filter must land at exactly the right point in the construction order. Tests are the safety net.

### F. Agent collaboration kit

**`AGENTS.md` at repo root.** Contents:
- Overview: what this project is, what agents will be asked to do.
- The data file model: file naming (`data/*.ts` auto-discovered; `*SAMPLE*` excluded), the `RawMapDefinition` shape, how scenarios overlay base data.
- Worked examples (with full minimal diffs):
  - Adding a new node.
  - Adding a new edge.
  - Adding a new scenario.
  - Omitting a node from a scenario.
- Workflow checklist:
  1. Edit the data file.
  2. Run `npm run validate`. If it fails, fix and re-run.
  3. The webapp auto-reloads when the watcher is running (`npm run serve`).
- Common gotchas: edge `type` must match a defined property; parent references must point to existing node IDs (unless the parent is omitted); `data/common.SAMPLE.ts` is a template, not a real data file.
- Pointer to `src/types.ts` as the canonical schema.

**JSDoc comments on `src/types.ts`.** Doc strings on `RawMapDefinition`, `RawNode`, `RawEdge`, `ScenarioNode` (or whatever the per-scenario override type is called), and the new `removed` field. Each comment explains the field's purpose and gives a one-line example.

**`tools/validate-data.ts`.** New CLI:
- Runs `npm run generate:config` first (reusing the production import path so validator can't drift from runtime behavior).
- Imports `DATA` from `src/data.GENERATED.ts`.
- For each `(file, scenario)` pair (including base scenario per file), instantiates `new AdjacencyMap(rawData, scenarioName)` in a try/catch.
- Reports each failure with file, scenario, and the raw error message.
- Exits non-zero if any failures.
- Wired as `npm run validate`.

**Rename `data/common.ts` → `data/common.SAMPLE.ts`.** Currently a starter stub, untracked in git. Rename + commit so it's preserved as a template without polluting auto-discovery. Document the `.SAMPLE.ts` convention in AGENTS.md.

**Risk:** low. Mostly mechanical.

## Architecture & dependencies between workstreams

```
A (loop) ──→ depends on selection-survives-reload, which is its own piece
       └──→ uses URL persistence which is independent

B (errors) ──→ standalone

C (robustness) ──→ standalone

D (inspection) ──→ uses URL-persisted selection from A for cross-reload survival

E (omit) ──→ uses selection guard from A so omitting selected node doesn't crash
       └──→ A's selection guard becomes the contract E depends on

F (agent kit) ──→ validate-data depends on E for `removed` to validate cleanly
            └──→ AGENTS.md should reference all of the above
```

Build order: **C → B → A → D → E → F** (each later piece builds on earlier ones). C and B are quick wins; A unblocks D and E.

## Testing

- **Unit tests:**
  - Omit semantics (workstream E) — new file under `test/`.
  - Selection guard — small unit test that selectedLayoutID for a non-existent node resolves to null.
- **Manual smoke tests** (after each workstream):
  - C: corrupt localStorage manually, reload, verify graceful fallback + warning in console.
  - B: introduce a bad reference in a data file, reload, verify error banner shows the message.
  - A: edit a data file with the watcher running, verify auto-reload happens and selection persists.
  - D: click a node, verify sidebar, verify neighbor highlight, press Esc, verify deselect.
  - E: add `removed: true` to a scenario, verify node disappears, toggle off, verify restoration.
- **Validation:** `npm run validate` passes on existing `data/*.ts` files before merge.
- **Existing test suite** continues to pass.

## Effort estimate

Per the critic's bottom-up breakdown:

| Workstream | Estimate |
|---|---|
| A. Edit-refresh loop + URL selection | 2 hrs |
| B. Error banner | 0.5 hrs |
| C. JSON.parse robustness | 0.5 hrs |
| D. Inspection + neighbor highlight + Esc | 2 hrs |
| E. Omit nodes (incl. tests) | 3-4 hrs |
| F. AGENTS.md + JSDoc + validate-data + rename | 2-3 hrs |
| **Total** | **~10-12 hours (~1.5 days)** |

Biggest risks:
1. **Omit (E) cascade effects** in the 2100-line `adjacency-map.ts`. Mitigation: thorough tests.
2. **wds reload signal** may need configuration tweaks if auto-reload doesn't pick up `data.GENERATED.ts` regeneration. Mitigation: it already reloads on TS file changes in src/; this should just work.

## Out of scope / future

Issues left open and explicitly deferred: #2, #3, #4, #5, #6, #7, #9, #10, #11, #12, #13, #14, #16, #18, #19, #20, #21, #24, #25, #28, #29. Most are valuable; none are blockers for the planning use case in the next few days.
