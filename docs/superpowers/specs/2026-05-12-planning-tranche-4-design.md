# Planning Workflow Tranche 4 — Design

**Date:** 2026-05-12
**Builds on:** Tranches 1-3 (shipped on `planning-workflow-improvements`).
**Goal window:** ~5-6 hours.

## Context

Tranches 1-3 made the tool a real planning aid: tight edit loop, error surfacing, click-inspect, compare mode, fork, decision notes, three agent CLIs. Two gaps remain that will materially help dogfooding:

1. **Output**: when the user picks a scenario, they need to communicate it to stakeholders. Today the tool is self-contained — decisions can't easily leave. Export gives them shareable artifacts (PNG of the diagram + Markdown report).
2. **Agent context awareness**: agents can run CLIs (inspect/diff/rank) but can't see what the user is *currently looking at* without asking. State sidecar bridges this — `/tmp/adjacency-state.json` reflects the current webapp state so agents read it instead of asking.

## Goals

1. The user can click "Export" and walk away with a PNG of the current diagram plus a Markdown report containing scenario metadata, decision notes, aggregate metrics, and modified-from-base summary.
2. While the dev server is running, agents have read access to a `/tmp/adjacency-state.json` file that reflects which file, scenario, selection, compare scenario, and hover are currently active in the webapp.

## Non-goals

- Multi-scenario report (one scenario per export — picking N scenarios into one report is more complex and not yet needed).
- Multi-page PDF (Markdown is the canonical artifact; users can render to PDF themselves).
- Full-history audit log (state sidecar is a snapshot, not a log).
- Search / filter / tags UI / undo / layout improvements — bigger items, defer.

## Workstreams

### O. Export (PNG + Markdown report)

**The shape:** new "Export" button in the controls. Clicking opens a dialog (reuse the existing `dialog-element` like Readout does) with:
- A pre-filled, selectable Markdown report (top of dialog).
- A "Download PNG" button (below the Markdown) that triggers a PNG download of the current diagram.
- A "Copy Markdown" button (selects all text in the textarea).

**Markdown content:**

```markdown
# <map description>

**File:** `<filename>`
**Scenario:** `<scenario name or '(base)'>` — <scenario description>

## Decision
<decision text, or "_None recorded._">

## Reasoning
<reasoning text, or "_None recorded._">

## Aggregate metrics

| Property | Value |
|---|---|
| <prop> | <number> |
| ... | ... |

## Top nodes by `<candidate metric>`

1. <node> — <value>
2. ...

## Modified from base
- ~ <node>.<property>: <a> → <b> (<delta>)
- + <node> (added)
- - <node> (removed)
- _None_ (if base scenario)

---
Exported <YYYY-MM-DD HH:MM>
```

**PNG export:**
- Find the rendered `<svg class="main">` element in the diagram component.
- Serialize via `XMLSerializer`. Embed the document's relevant CSS as a `<style>` block inside the SVG (so the PNG isn't unstyled).
- Create a `Blob` of type `image/svg+xml`, then load via `new Image()`, draw to a canvas at the SVG's natural dimensions, `canvas.toBlob('image/png')`.
- Trigger download via a temporary `<a>` element.

**Implementation surface:**
- New `src/export.ts` — pure functions:
  - `generateMarkdownReport(state) : string`
  - `exportSVGToPNG(svgElement, width, height) : Promise<Blob>`
  - `downloadBlob(blob, filename)`
- `src/components/main-view.ts` — add an `'export'` dialog kind alongside `'readout'`/`'error'`; render the content with `_dialogContentExport`.
- `src/components/adjacency-map-controls.ts` — Export button. Always available when a map is loaded (regardless of editing state).
- `src/actions/dialog.ts` — `showExport()` action.
- `src/types.ts` — extend `DialogKind` with `'export'`.

**Edge cases:**
- The SVG references `<adjacency-map-diagram>`'s shadow-root styles. To export accurately, we serialize the SVG and inline a snapshot of the diagram component's styles into a `<style>` block before serialization.
- Mobile / hi-DPI: emit at 2x natural size for crisp output. The user gets a download regardless.

**Risk:** medium. SVG-to-PNG conversion has cross-browser quirks. Mitigation: smoke test downloads the PNG and asserts non-zero file size + correct MIME.

**Effort:** ~3 hrs.

### P. Webapp state sidecar

**The shape:** while `npm run serve` is running, a file `/tmp/adjacency-state.json` reflects:
```json
{
  "filename": "default",
  "scenarioName": "increased-certainty",
  "compareScenarioName": null,
  "selectedLayoutID": "node:base_pipeline",
  "hoveredLayoutID": null,
  "updatedAt": "2026-05-12T10:30:00Z"
}
```

Updated whenever the relevant slice of Redux state changes.

**Plumbing:**
- The webapp can't write `/tmp/` directly. We add a tiny middleware to `web-dev-server.config.mjs` that handles `POST /__state__` and writes the JSON body to `/tmp/adjacency-state.json`.
- The webapp has a small Redux subscriber in `src/store.ts` (or alongside it in a new file) that on state change builds the summary and POSTs to `/__state__` via `navigator.sendBeacon()` (or `fetch()` as fallback).
- Debounce to 250ms so rapid state changes don't spam writes.

**Implementation surface:**
- `web-dev-server.config.mjs` — add a `middleware` array entry. wds uses Koa-style middleware: `(ctx, next) => ...`. The middleware checks for `POST /__state__`, reads the JSON body, writes to `/tmp/adjacency-state.json`, returns 204.
- `src/state-sidecar.ts` (new) — `installSidecarSubscriber(store)`. Subscribes to store, debounces, builds summary, POSTs.
- `src/store.ts` — call `installSidecarSubscriber(store)` after store creation.
- `AGENTS.md` — new section pointing agents at `/tmp/adjacency-state.json` and explaining: "If this file exists, the user has a webapp open and you can see what they're viewing without asking."

**Failure modes:**
- Dev server not running — POST fails silently; sidecar file just doesn't exist. Agents fall back to asking the user.
- Multiple webapp tabs — last writer wins. Document this; not worth solving without evidence of multi-tab use.
- `sendBeacon` not available — fall back to `fetch` with `keepalive: true`.

**Risk:** low. Middleware is well-documented in wds. Subscriber is straightforward.

**Effort:** ~1.5 hrs.

## Architecture & dependencies

Both workstreams are independent of each other and additive to everything that exists.

Build order: **P (sidecar) → O (export)** because P is smaller and gets quick momentum, plus its failure modes are easier to detect (file written or not), while O has cross-browser PNG quirks.

## Testing

- Smoke test extension:
  - State sidecar: after navigating to scenario X, assert that `/tmp/adjacency-state.json` contains the expected `scenarioName: "X"`. Then click a node, assert `selectedLayoutID` updates.
  - Export: click Export button, verify the dialog opens with Markdown content containing the scenario name + decision text, click Download PNG, verify a PNG file lands on disk with non-zero size.

## Effort estimate

| Workstream | Estimate |
|---|---|
| P. State sidecar (middleware + subscriber + AGENTS.md) | 1.5 hrs |
| O. Export (export.ts + dialog + button) | 3 hrs |
| Smoke tests | 1 hr |
| **Total** | **~5.5 hrs** |

## Out of scope (carrying forward)

- Search / filter
- Tags UI (#21)
- Undo / redo
- Critical path highlighting / milestone swimlanes / uncertainty radiance
- Layout improvement (#29)
- In-UI live editing of arbitrary scenario fields beyond what already exists
- Multi-scenario report
