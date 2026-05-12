# Planning Workflow Tranche 5 — Design

**Date:** 2026-05-12
**Builds on:** Tranches 1-4.
**Goal window:** ~3 hours.

## Context

After four tranches the tool is feature-complete for the planning loop. Remaining friction is **session UX** — operations all require the mouse and there's no way to find a specific node by name. Two small, focused additions:

1. **Search/jump-to-node** — text field in controls. Typing dims non-matching nodes; Enter selects the first match.
2. **Keyboard help modal** — `?` opens a modal listing every keyboard shortcut and every CLI command. Pure discoverability win.

## Goals

1. The user can type part of a node id, display name, or tag name into a search field and immediately see only matching nodes (others dimmed). Hitting Enter selects the first match.
2. The user (or an agent reading AGENTS.md) can press `?` and see a one-page reference of every keyboard shortcut and CLI in the project.

## Non-goals

- Regex / advanced query syntax — substring match is sufficient for the data sizes we have.
- Persistent search state across reloads — clears on navigation, which is the expected behavior.
- Bigger UX overhauls (tags-as-filter sidebar, command palette, undo/redo). Defer.

## Workstreams

### Q. Search / jump-to-node

**The shape:**

- A text `<input>` in the controls, near the scenario dropdown, with placeholder "Search nodes…".
- Typing into it sets a Redux state field `searchQuery`. The query is normalized to lowercase.
- A selector `selectSearchMatches` returns the set of `LayoutID`s whose `node.id`, `node.displayName`, or any of `node.tags` keys contain the query as a substring.
- The diagram component takes a new prop `searchMatches: Set<LayoutID> | null`. When non-null and the query is non-empty, nodes NOT in the set get a `search-miss` CSS class (opacity 0.15).
- Enter dispatches `updateSelectedLayoutID(firstMatchID)`.
- Esc clears the search.

**Implementation surface:**
- `src/types.ts` — add `searchQuery?: string` to DataState (or wherever the data state shape lives).
- `src/actions/data.ts` — `setSearchQuery(q: string)` action + thunk.
- `src/reducers/data.ts` — reducer case + initial state.
- `src/selectors.ts` — `selectSearchQuery` + `selectSearchMatches`.
- `src/components/adjacency-map-controls.ts` — input element + handlers + state.
- `src/components/adjacency-map-diagram.ts` — accept `searchMatches`, apply CSS class.
- `src/components/main-view.ts` — wire `searchMatches` through to the diagram.

**CSS:**
```css
circle.search-miss, path.search-miss {
	opacity: 0.15;
	transition: opacity 200ms ease;
}
```

**Edge cases:**
- Empty query → no filtering, no class applied.
- Esc inside the input clears the input AND the redux state. Esc outside the input continues to clear selection (existing behavior).
- The search field shouldn't trigger the existing arrow-key scenario navigation; the `_handleKeyDown` in main-view already checks `composedPath` for input/textarea — good.

**Effort:** ~2 hrs.

### R. Keyboard help modal

**The shape:** when `?` is pressed (outside of inputs), open a dialog with kind `'help'` showing a static list of shortcuts and CLI commands:

- **Keyboard shortcuts**: ←/→ (cycle scenarios), Esc (clear selection or close dialog), ? (this help).
- **CLI commands**:
  - `npm run validate`
  - `npm run inspect -- <file> [scenario]`
  - `npm run diff -- <file> <a> <b>`
  - `npm run rank -- <file> <property>`
  - `npm run serve` (with state sidecar)
- **File conventions**: pointer to AGENTS.md.

**Implementation surface:**
- `src/types.ts` — extend `DialogKind` with `'help'`.
- `src/actions/dialog.ts` — `showHelp()` action.
- `src/components/main-view.ts` — dialog content + title for `'help'` kind; `_handleKeyDown` adds `?` case.

**Edge cases:**
- `?` inside an input shouldn't open help (the existing `composedPath` check covers this).
- Close via Esc or the existing dialog close button.

**Effort:** ~45 min.

## Architecture & dependencies

Both workstreams are independent. Build order: **R (smaller) → Q**.

## Testing

Smoke test additions:
- Type into search box (focus input, key by key) — assert non-matches get the `search-miss` class.
- Press `?` while not in an input — assert dialog opens with kind 'help' (or by checking dialog content includes "Keyboard shortcuts").

## Effort estimate

| Workstream | Estimate |
|---|---|
| R. Help modal | 45 min |
| Q. Search/jump | 2 hrs |
| Smoke tests | 30 min |
| **Total** | **~3 hrs** |

## Out of scope

- Tags-as-filter sidebar
- Command palette
- Undo/redo
- Search persistence across reloads
- Layout improvements (#29)
- Critical path / milestone swimlanes / uncertainty radiance
