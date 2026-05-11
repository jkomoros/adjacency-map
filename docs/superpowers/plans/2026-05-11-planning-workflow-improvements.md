# Planning Workflow Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Get `adjacency-map` to a state where an AI agent can edit `data/*.ts` files and the user watches scenarios evolve live in the webapp, with visible validation errors, click-to-inspect, omit-node-from-scenario, and File System Access API save-back.

**Architecture:** Seven workstreams from the design spec (C → B → A → D → E → G → F). Each task changes a small set of files with a focused purpose. Commit after each task. The webapp is lit-element + Redux + reselect; data files are TypeScript modules under `data/`; a build step (`tools/config.ts`) emits `src/data.GENERATED.ts` that imports every data file.

**Tech Stack:** TypeScript, lit-element, Redux + redux-thunk, reselect, web-dev-server (wds), chokidar (new dep for the watcher), mocha (existing test runner), File System Access API.

**Spec:** `docs/superpowers/specs/2026-05-11-planning-workflow-improvements-design.md`

---

## Workstream C: Robustness

### Task 1: Wrap `fetchOverlaysFromStorage` JSON.parse in try/catch

**Files:**
- Modify: `src/util.ts:107-111`

- [ ] **Step 1: Update the function**

In `src/util.ts`, replace the body of `fetchOverlaysFromStorage`:

```ts
export const fetchOverlaysFromStorage = () : ScenariosOverlays => {
	const rawObject = window.localStorage.getItem(SCENARIOS_OVERLAYS_LOCAL_STORAGE_KEY);
	if (!rawObject) return {};
	try {
		return JSON.parse(rawObject) as ScenariosOverlays;
	} catch (err) {
		console.warn('Corrupt scenario overlays in localStorage, ignoring:', err);
		return {};
	}
};
```

- [ ] **Step 2: Verify the build**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/util.ts
git commit -m "Guard fetchOverlaysFromStorage against corrupt localStorage"
```

---

## Workstream B: Persistent Error Banner

### Task 2: Render error banner in main-view

**Files:**
- Modify: `src/components/main-view.ts` (styles block, `render()`, and the `updated()` block that currently dispatches `showError`)

Background: `_dataError` is already a `@state()` populated from `selectAdjacencyMapError(state)` in `stateChanged` (line 220). The bug is that the error is only surfaced via `updated()` → dispatching a dialog when the prop **changes**. We add a persistent banner driven directly from `this._dataError` in `render()`.

- [ ] **Step 1: Add banner styling**

In `static override get styles()`, append a `.error-banner` rule to the CSS block:

```css
.error-banner {
	position: absolute;
	top: 0;
	left: 0;
	right: 0;
	z-index: 100;
	background: #b00020;
	color: white;
	padding: 0.5em 1em;
	font-family: monospace;
	font-size: 0.85em;
	white-space: pre-wrap;
	box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}
.error-banner strong {
	display: block;
	margin-bottom: 0.25em;
	font-family: var(--app-text-font-family, sans-serif);
	font-size: 1em;
}
.error-banner a {
	color: white;
	text-decoration: underline;
	cursor: pointer;
}
```

- [ ] **Step 2: Render banner conditionally**

In `render()`, wrap the existing template to add the banner as the first child of `.container`:

```ts
override render() : TemplateResult {
	return html`
		<div class='container'>
				${this._dataError ? html`
					<div class='error-banner'>
						<strong>Data error in <code>${this._filename}</code></strong>
						${this._dataError}
						<div><a @click=${() => window.location.reload()}>Reload</a></div>
					</div>` : ''}
				<adjacency-map-controls></adjacency-map-controls>
				<adjacency-map-diagram @node-clicked=${this._handleNodeClicked} @node-hovered=${this._handleNodeHovered} .map=${this._adjacencyMap} .hoveredEdgeID=${this._hoveredEdgeID} .hoveredLayoutID=${this._hoveredLayoutID} .selectedLayoutID=${this._selectedLayoutID} .scale=${this._scale} .editedNodes=${this._editedNodes}></adjacency-map-diagram>
				<dialog-element .open=${this._dialogOpen} .title=${this._dialogTitle} @dialog-should-close=${this._handleDialogShouldClose} .hideClose=${true}>${this._dialogContent}</dialog-element>
		</div>
	`;
}
```

- [ ] **Step 3: Remove the now-redundant dialog dispatch on data error**

In `updated()`, remove the block that dispatches `showError(this._dataError)`. The banner replaces the dialog flow. Keep the `console.warn` log:

```ts
if (changedProps.has('_dataError') && this._dataError) {
	console.warn(this._dataError);
}
```

- [ ] **Step 4: Verify build**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Smoke test (manual, optional now)**

Skip if testing-on-the-go feels expensive; we'll smoke-test all the UI features at the end.

- [ ] **Step 6: Commit**

```bash
git add src/components/main-view.ts
git commit -m "Add persistent data-error banner (#23)"
```

---

## Workstream A: Edit-Refresh Loop + URL-Persisted Selection

### Task 3: Add chokidar dependency

**Files:**
- Modify: `package.json` (devDependencies)

- [ ] **Step 1: Install chokidar**

```bash
npm install --save-dev chokidar
```

- [ ] **Step 2: Verify package.json change**

Run: `git diff package.json`
Expected: chokidar appears in devDependencies.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "Add chokidar for data-file watching"
```

### Task 4: Create the data-file watcher

**Files:**
- Create: `tools/watch-data.ts`
- Modify: `package.json` (scripts: replace the `serve` script)

- [ ] **Step 1: Create the watcher**

Create `tools/watch-data.ts`:

```ts
import chokidar from 'chokidar';
import { spawnSync } from 'child_process';

const DATA_GLOB = 'data/**/*.{ts,json}';

const regenerate = (path : string) => {
	console.log(`[watch-data] change detected in ${path}; regenerating data manifest`);
	const result = spawnSync('npm', ['run', 'generate:config'], { stdio: 'inherit' });
	if (result.status !== 0) {
		console.warn('[watch-data] generate:config failed');
	}
};

console.log('[watch-data] watching', DATA_GLOB);
chokidar
	.watch(DATA_GLOB, { ignoreInitial: true })
	.on('add', regenerate)
	.on('change', regenerate)
	.on('unlink', regenerate);
```

- [ ] **Step 2: Wire it into `npm run serve`**

In `package.json`, replace the `serve` script:

```json
"serve": "tsc --watch --preserveWatchOutput & node --loader ts-node/esm tools/watch-data.ts & wds --node-resolve --port=8081"
```

- [ ] **Step 3: Quick sanity check**

Run: `node --loader ts-node/esm tools/watch-data.ts &`
Wait 1 second, then `echo '// touch' >> data/default.ts` in another shell — actually skip the live test; we'll test the full path after the dust settles. Just confirm there are no syntax errors:

Run: `npx tsc --noEmit tools/watch-data.ts` (errors about chokidar type? skip if it's just `npm install` lag.)

If problems persist, see if chokidar needs `import chokidar = require('chokidar');` (CJS form). The codebase uses ESM; `import chokidar from 'chokidar'` should work.

- [ ] **Step 4: Commit**

```bash
git add tools/watch-data.ts package.json
git commit -m "Add data-file watcher that regenerates manifest on change"
```

### Task 5: Encode `selectedLayoutID` in URL hash

**Files:**
- Modify: `src/selectors.ts` (`selectHashForCurrentState`)
- Modify: `src/actions/data.ts` (find where hash params are parsed and add `n=`)

The existing hash format is `s=<scenarioName>`. We add `n=<layoutID>` for the selected node.

- [ ] **Step 1: Update `selectHashForCurrentState` to include selection**

In `src/selectors.ts` around line 151-158, replace:

```ts
export const selectHashForCurrentState = createSelector(
	selectScenarioName,
	selectSelectedLayoutID,
	(scenarioName, selectedLayoutID) => {
		const pieces : URLHashArgs = {};
		if (scenarioName != DEFAULT_SCENARIO_NAME) pieces.s = scenarioName;
		if (selectedLayoutID) pieces.n = selectedLayoutID;
		return Object.entries(pieces).map(entry => entry[0] + '=' + entry[1]).join('&');
	}
);
```

- [ ] **Step 2: Add `n` to the URLHashArgs type**

In `src/types.ts`, find `URLHashArgs` and add `n?: string`. Check existing declaration first (`grep -n URLHashArgs src/types.ts`); if it's a wide-open object type, no change needed.

- [ ] **Step 3: Update the hash parser to read `n`**

Find where `s=` is parsed (likely in `src/actions/app.ts` or `src/actions/data.ts`, around the `updateHash` action). The parser splits on `&` and on `=`. Add handling so that when key is `n`, dispatch `updateSelectedLayoutID(value)`.

Sketch (place where existing `s` parsing lives):

```ts
if (key === 's') {
	dispatch(updateScenarioName(value));
} else if (key === 'n') {
	dispatch(updateSelectedLayoutID(value as LayoutID));
}
```

Run `grep -rn "case 's'\|key === 's'\|=== 's'" src/actions/` to locate the existing parser.

- [ ] **Step 4: Verify build**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add src/selectors.ts src/types.ts src/actions/
git commit -m "Persist selected layout ID in URL hash"
```

### Task 6: Guard against stale `selectedLayoutID`

**Files:**
- Modify: `src/selectors.ts` (`selectSelectedNodeID` becomes resilient)

When the URL says `n=foo` but `foo` doesn't exist in the current scenario, we want graceful fallback (null), not a crash.

- [ ] **Step 1: Update `selectSelectedNodeID` (and related selectors that use it)**

In `src/selectors.ts`, modify `selectSelectedNodeID` to check that the resolved node actually exists in the current map. The current implementation:

```ts
export const selectSelectedNodeID = createSelector(
	selectSelectedLayoutID,
	(layoutID) => nodeIDFromLayoutID(layoutID)
);
```

Wrap it to verify against the map:

```ts
export const selectSelectedNodeID = createSelector(
	selectSelectedLayoutID,
	selectAdjacencyMap,
	(layoutID, map) => {
		const nodeID = nodeIDFromLayoutID(layoutID);
		if (nodeID === undefined) return undefined;
		if (!map) return undefined;
		try {
			map.layoutNode(layoutID!);
		} catch {
			return undefined;
		}
		return nodeID;
	}
);
```

(If `map.layoutNode` doesn't throw for missing IDs, use whatever the equivalent existence-check is; check with `grep -n "layoutNode\b" src/adjacency-map.ts | head -10`.)

- [ ] **Step 2: Confirm summary selectors still behave**

Read the selectors that use `selectSelectedLayoutID` (lines 67-73, 160-201). They use it for the summary panel — should now also fall back gracefully if the node disappeared.

Modify `selectSummaryLayoutID` to use the guarded ID:

```ts
export const selectSummaryLayoutID = createSelector(
	selectHoveredLayoutID,
	selectSelectedLayoutID,
	selectAdjacencyMap,
	(hoveredLayoutID, selectedLayoutID, map) => {
		const valid = (id?: LayoutID) => {
			if (!id || !map) return undefined;
			try { map.layoutNode(id); return id; } catch { return undefined; }
		};
		return valid(hoveredLayoutID) || valid(selectedLayoutID);
	}
);
```

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/selectors.ts
git commit -m "Guard selectedLayoutID against missing nodes"
```

---

## Workstream D: Node Inspection with Neighbor Highlighting

### Task 7: Esc-to-deselect

**Files:**
- Modify: `src/components/main-view.ts` (the `_handleKeyDown` method, around line 261-278)

- [ ] **Step 1: Add Esc handler**

In `_handleKeyDown`, alongside the existing arrow-key handling, add:

```ts
if (e.key == 'ArrowRight') {
	store.dispatch(nextScenarioName());
} else if (e.key == 'ArrowLeft') {
	store.dispatch(previousScenarioName());
} else if (e.key == 'Escape') {
	store.dispatch(updateSelectedLayoutID(undefined));
}
```

(The action `updateSelectedLayoutID` is already imported.)

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/main-view.ts
git commit -m "Esc clears node selection"
```

### Task 8: Neighbor highlighting in the diagram

**Files:**
- Modify: `src/components/adjacency-map-diagram.ts`
- Possibly modify: `src/selectors.ts` (add a selector for the neighbor set of the selected node)

Goal: when a node is selected, nodes/edges not directly connected to it get dimmed (CSS opacity ~0.3); the selected node and its neighbors stay full opacity; direct edges get an accent stroke.

- [ ] **Step 1: Compute the neighbor set in the diagram component**

Read `src/components/adjacency-map-diagram.ts` and find where rendered nodes and edges are emitted (likely a `.map()` over the layout result). The component already receives `.map=` (the `AdjacencyMap` instance) and `.selectedLayoutID=` as properties.

Add a private getter / computed value: for the selected layout ID, the neighbor set is the union of `map.layoutNode(selectedID).parents` (the layout IDs of nodes the selected node depends on) and the set of layout IDs that have the selected node as a parent (its children).

Concrete implementation: confirm the available accessors on `AdjacencyMap.layoutNode(id)`. Likely candidates: `.parents`, `.children`, `.edges`. Run `grep -n "get parents\|get children\|get edges" src/adjacency-map.ts | head -10`. Use whatever's there.

Sketch:

```ts
private _neighborLayoutIDs() : Set<LayoutID> {
	const result = new Set<LayoutID>();
	if (!this.selectedLayoutID || !this.map) return result;
	result.add(this.selectedLayoutID);
	try {
		const node = this.map.layoutNode(this.selectedLayoutID);
		for (const edge of node.edges) {
			if (edge.parent) result.add(edge.parent);
		}
		for (const otherID of this.map.allLayoutNodeIDs()) {
			const other = this.map.layoutNode(otherID);
			if (other.edges.some(e => e.parent === this.selectedLayoutID)) {
				result.add(otherID);
			}
		}
	} catch {
		// selected node gone; treat as no selection
	}
	return result;
}
```

(Verify the API names — `allLayoutNodeIDs` may not exist; use whatever iteration the existing render code uses.)

- [ ] **Step 2: Apply CSS classes based on neighbor membership**

In the template render in `adjacency-map-diagram.ts`, when there IS a selection, add `class="dim"` to nodes/edges NOT in the neighbor set, and `class="accent"` to edges where source AND parent are both the selected node or a neighbor. When there's NO selection, no class is applied.

Add CSS:

```css
.dim { opacity: 0.25; transition: opacity 200ms ease; }
.accent { stroke-width: 3px; }
g.node, line.edge, g.edge { transition: opacity 200ms ease, stroke-width 200ms ease; }
```

(Adapt selectors to the actual element shapes the component renders.)

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/adjacency-map-diagram.ts
git commit -m "Highlight neighbors of selected node (#22)"
```

---

## Workstream E: Omit Nodes from Scenarios

### Task 9: Add `removed` to types

**Files:**
- Modify: `src/types.ts` (lines 685-725: `RawScenario.nodes[id]` and `ScenarioNode`)

- [ ] **Step 1: Add `removed?: boolean` to both RawScenario.nodes value type and ScenarioNode**

Change `src/types.ts:691-705`:

```ts
nodes: {
	[id : NodeID] : {
		removed? : boolean,
		values?: NodeValuesOverride,
		group? : GroupID,
		edges?: {
			add?: RawEdgeInput,
			remove?: {
				[previousID : EdgeValueMatchID]: true
			},
			modify?: {
				[previousID : EdgeValueMatchID]: EdgeValue
			}
		}
	}
}
```

And in `ScenarioNode` (line 719-725):

```ts
export type ScenarioNode = {
	removed? : boolean,
	group? : GroupID,
	values: {
		[propertyName : PropertyName]: ValueDefinition
	}
	edges: ScenarioNodeEdges
}
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: no new errors (TypeScript should accept the optional field everywhere).

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "Add optional removed flag to scenario node override (#26)"
```

### Task 10: Write failing test for omit semantics

**Files:**
- Modify: `test/base/test.js` (or new test file in `test/base/`)

- [ ] **Step 1: Find the existing test pattern**

Run: `head -100 test/base/test.js`
Read enough to understand the existing `legalBaseInput`-style fixtures and `describe` / `it` shape.

- [ ] **Step 2: Add tests for omit**

Append a new test block at the end of `test/base/test.js`:

```js
describe('scenario node removal (#26)', () => {

	const baseInput = {
		properties: {
			engineering: { value: 1 }
		},
		nodes: {
			a: { description: 'a' },
			b: { description: 'b', edges: [{ type: 'engineering', parent: 'a' }] },
			c: { description: 'c', edges: [{ type: 'engineering', parent: 'b' }] }
		},
		scenarios: {
			'omit-b': {
				description: 'b is removed',
				nodes: {
					b: { removed: true }
				}
			}
		}
	};

	it('omits the removed node from the resulting graph', () => {
		const map = new AdjacencyMap(deepCopy(baseInput), 'omit-b');
		const nodeIDs = Object.keys(map.nodes);
		assert.ok(!nodeIDs.includes('b'), 'b should be omitted');
		assert.ok(nodeIDs.includes('a'), 'a should remain');
		assert.ok(nodeIDs.includes('c'), 'c should remain (orphaned)');
	});

	it('drops edges that point to the removed node', () => {
		const map = new AdjacencyMap(deepCopy(baseInput), 'omit-b');
		const c = map.nodes.c;
		const edges = c.edges || [];
		const edgesToB = edges.filter(e => e.parent === 'b');
		assert.strictEqual(edgesToB.length, 0, 'edges from c -> b should be dropped');
	});

	it('does not affect base scenario', () => {
		const map = new AdjacencyMap(deepCopy(baseInput), '');
		const nodeIDs = Object.keys(map.nodes);
		assert.ok(nodeIDs.includes('b'), 'b should still exist in base scenario');
	});

	it('toggling removed off restores the node', () => {
		const input = deepCopy(baseInput);
		input.scenarios['omit-b'].nodes.b.removed = false;
		const map = new AdjacencyMap(input, 'omit-b');
		const nodeIDs = Object.keys(map.nodes);
		assert.ok(nodeIDs.includes('b'), 'b should be present when removed=false');
	});

	it('referencing a non-existent node in a removed entry is a no-op', () => {
		const input = deepCopy(baseInput);
		input.scenarios['omit-b'].nodes.nonexistent = { removed: true };
		// Should not throw.
		const map = new AdjacencyMap(input, 'omit-b');
		assert.ok(map);
	});

});
```

- [ ] **Step 3: Run tests — confirm they FAIL**

Run: `npm test`
Expected: the new `scenario node removal` block fails (likely with errors about `removed` being unsupported, or about edges to `b` still existing).

If the test errors before reaching the new block (e.g., `b is not found` somewhere because the map's `.nodes` access uses a different shape), adjust the test to use whatever exact accessor the codebase uses. Reading the existing tests' use of `map.nodes` or `map.layoutNode()` is the canonical guide.

- [ ] **Step 4: Commit**

```bash
git add test/base/test.js
git commit -m "Add failing tests for omit-node semantics (#26)"
```

### Task 11: Implement the omit filter

**Files:**
- Modify: `src/adjacency-map.ts`

- [ ] **Step 1: Locate the construction point**

The constructor processes the scenario overlay onto the base nodes. Run:

```bash
grep -n "scenario\|_scenario\|scenarioName\|nodes\b" src/adjacency-map.ts | head -40
```

Find where:
- The effective per-scenario `ScenarioNode` for each node is computed.
- Nodes are added to the graph.
- `_cachedChildren` (or equivalent) is built.

You're looking for the moment a node becomes a "real" node in the graph. Filter must happen before that.

- [ ] **Step 2: Skip removed nodes during node construction**

In the node-creation loop, before adding a node to the internal map, check the scenario override for that node ID. If it has `removed === true`, skip — don't add the node and don't process its edges.

Then, when processing OTHER nodes' edges, drop any edge whose `parent` resolves to a node that's been skipped.

Pseudocode (adapt to the actual constructor shape):

```ts
const removedNodeIDs = new Set<NodeID>();
for (const [nodeID, override] of Object.entries(scenarioNodeOverrides)) {
	if (override.removed) removedNodeIDs.add(nodeID);
}

for (const nodeID of Object.keys(baseNodes)) {
	if (removedNodeIDs.has(nodeID)) continue;
	// ... existing node-construction logic ...
	// When building edges:
	const filteredEdges = edges.filter(e => !removedNodeIDs.has(e.parent));
}
```

- [ ] **Step 3: Run tests until they pass**

Run: `npm test`
Expected: the scenario-node-removal tests now pass. Existing tests still pass.

If existing tests break: revisit the filter — it may be removing more than intended. The filter should only fire when `override.removed === true`.

- [ ] **Step 4: Commit**

```bash
git add src/adjacency-map.ts
git commit -m "Implement omit-node-from-scenario filter (#26)"
```

---

## Workstream G: Save-Back via File System Access API

### Task 12: Extend `tools/config.ts` to discover JSON sidecars

**Files:**
- Modify: `tools/config.ts`

- [ ] **Step 1: Discover `.edits.json` files alongside `.ts` files**

Update `tools/config.ts`. After collecting `datafiles`, scan for sidecars:

```ts
import { readdirSync, writeFileSync, existsSync } from 'fs';
import { basename } from 'path';
import { camelCaseFilename } from '../src/util.js';

const DYNAMIC_TYPES_FILE = 'src/data.GENERATED.ts';
const DATA_DIRECTORY = 'data';

const generateConfig = () => {
	const datafiles : string[] = [];
	const sidecars : string[] = [];
	for (const file of readdirSync(DATA_DIRECTORY)) {
		if (file.endsWith('.edits.json')) {
			sidecars.push(basename(file, '.edits.json'));
			continue;
		}
		if (!file.endsWith('.ts')) continue;
		if (file.endsWith('.d.ts')) continue;
		const filename = basename(file, '.ts');
		if (filename.includes('SAMPLE')) continue;
		datafiles.push(filename);
	}

	const sidecarImports = sidecars
		.filter(name => datafiles.includes(name))
		.map(name => `import ${camelCaseFilename(name)}Edits from '../data/${name}.edits.json' assert {type: 'json'};`)
		.join('\n');

	const sidecarMap = sidecars
		.filter(name => datafiles.includes(name))
		.map(name => `\t'${name}': ${camelCaseFilename(name)}Edits`)
		.join(',\n');

	const data = `//This file was generated by 'npm run generate:config'

//We import all data files directly into the build because they aren't that big
//and this way we can get direct typescript type checking at compile time.

import {
	RawMapDefinition,
	RawScenariosDefinition
} from './types.js';

${datafiles.map(filename => `import ${camelCaseFilename(filename) + 'Data'} from '../data/${filename}.js';`).join('\n')}
${sidecarImports}

export type DataFilename = ${datafiles.map(filename => `'${filename}'`).join(' | ')};

export const DATA : {[filename in DataFilename]: RawMapDefinition} = {
${datafiles.map(filename => `\t'${filename}': ${camelCaseFilename(filename) + 'Data'}`).join(',\n')}
};

export const SIDECAR_EDITS : Partial<{[filename in DataFilename]: RawScenariosDefinition}> = {
${sidecarMap}
};
`;

	writeFileSync(DYNAMIC_TYPES_FILE, data);
};

generateConfig();
```

- [ ] **Step 2: Run the generator**

Run: `npm run generate:config`
Expected: `src/data.GENERATED.ts` is rewritten with the new `SIDECAR_EDITS` export. No sidecars exist yet, so `SIDECAR_EDITS` will be `{}`.

- [ ] **Step 3: Verify build still compiles**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add tools/config.ts src/data.GENERATED.ts
git commit -m "Extend config generator to discover .edits.json sidecars"
```

### Task 13: Merge sidecar scenarios into runtime data

**Files:**
- Modify: `src/selectors.ts` (`selectData` merges sidecar scenarios)

- [ ] **Step 1: Import SIDECAR_EDITS and merge**

In `src/selectors.ts`, update the imports:

```ts
import {
	DATA,
	SIDECAR_EDITS
} from './data.GENERATED.js';
```

Replace `selectData`:

```ts
const selectSidecarScenarios = createSelector(
	selectFilename,
	(filename) => SIDECAR_EDITS[filename] || {}
);

export const selectData = createSelector(
	selectRawData,
	selectSidecarScenarios,
	selectCurrentScenarioOverlay,
	(rawData, sidecar, overlay) => ({
		...rawData,
		scenarios: {...rawData.scenarios, ...sidecar, ...overlay}
	})
);
```

Order: base scenarios → sidecar JSON (saved edits) → current localStorage overlay (in-progress edits). Latest wins.

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/selectors.ts
git commit -m "Merge sidecar JSON scenarios into runtime data"
```

### Task 14: Create the file-save module (FSA wrapper + IndexedDB handle persistence)

**Files:**
- Create: `src/file-save.ts`

- [ ] **Step 1: Implement the module**

Create `src/file-save.ts`:

```ts
import { DataFilename } from './data.GENERATED.js';
import { ScenariosDefinition } from './types.js';

const DB_NAME = 'adjacency-map-file-handles';
const DB_VERSION = 1;
const STORE = 'handles';

export const fileSaveAvailable = () : boolean => {
	return typeof window !== 'undefined' && 'showSaveFilePicker' in window;
};

const openDB = () : Promise<IDBDatabase> => new Promise((resolve, reject) => {
	const req = indexedDB.open(DB_NAME, DB_VERSION);
	req.onupgradeneeded = () => {
		req.result.createObjectStore(STORE);
	};
	req.onsuccess = () => resolve(req.result);
	req.onerror = () => reject(req.error);
});

const idbGet = async (key : string) : Promise<FileSystemFileHandle | undefined> => {
	const db = await openDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE, 'readonly');
		const req = tx.objectStore(STORE).get(key);
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
};

const idbSet = async (key : string, value : FileSystemFileHandle) : Promise<void> => {
	const db = await openDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE, 'readwrite');
		tx.objectStore(STORE).put(value, key);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
};

const idbDelete = async (key : string) : Promise<void> => {
	const db = await openDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE, 'readwrite');
		tx.objectStore(STORE).delete(key);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
};

const ensurePermission = async (handle : FileSystemFileHandle) : Promise<boolean> => {
	// @ts-ignore - queryPermission is in the FSA spec but not yet in lib.dom
	const status = await handle.queryPermission({ mode: 'readwrite' });
	if (status === 'granted') return true;
	// @ts-ignore
	const reqStatus = await handle.requestPermission({ mode: 'readwrite' });
	return reqStatus === 'granted';
};

const pickHandle = async (filename : DataFilename) : Promise<FileSystemFileHandle> => {
	// @ts-ignore - FSA is not yet in lib.dom for all TS configs
	const handle = await window.showSaveFilePicker({
		suggestedName: `${filename}.edits.json`,
		types: [{
			description: 'Adjacency map scenario edits',
			accept: { 'application/json': ['.json'] }
		}]
	}) as FileSystemFileHandle;
	await idbSet(filename, handle);
	return handle;
};

export const saveScenarios = async (filename : DataFilename, scenarios : ScenariosDefinition) : Promise<void> => {
	let handle = await idbGet(filename);
	if (handle) {
		const ok = await ensurePermission(handle);
		if (!ok) {
			await idbDelete(filename);
			handle = undefined;
		}
	}
	if (!handle) handle = await pickHandle(filename);

	try {
		const writable = await handle.createWritable();
		await writable.write(JSON.stringify(scenarios, null, '\t'));
		await writable.close();
	} catch (err) {
		// File handle invalid (file deleted/moved): clear and re-prompt next time.
		await idbDelete(filename);
		throw err;
	}
};

export const clearStoredHandle = async (filename : DataFilename) : Promise<void> => {
	await idbDelete(filename);
};
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: no errors. (The `@ts-ignore` comments suppress missing FSA type definitions.)

- [ ] **Step 3: Commit**

```bash
git add src/file-save.ts
git commit -m "Add file-save module wrapping File System Access API"
```

### Task 15: Add Save-to-file button + clear-overlays-after-save action

**Files:**
- Modify: `src/components/adjacency-map-controls.ts` (add the button conditional on FSA availability)
- Modify: `src/actions/data.ts` (add a `saveScenariosToFile` thunk that calls `saveScenarios` and dispatches a state reset)

- [ ] **Step 1: Add the thunk action**

In `src/actions/data.ts`, add:

```ts
import { saveScenarios, fileSaveAvailable } from '../file-save.js';

export const SAVE_SCENARIOS_SUCCESS = 'SAVE_SCENARIOS_SUCCESS';

export const saveScenariosToFile = () : ThunkAction<Promise<void>, RootState, unknown, AnyAction> => async (dispatch, getState) => {
	if (!fileSaveAvailable()) {
		throw new Error('File save not supported in this browser');
	}
	const state = getState();
	const filename = selectFilename(state);
	const overlay = selectCurrentScenarioOverlay(state);
	await saveScenarios(filename, overlay);
	dispatch({ type: SAVE_SCENARIOS_SUCCESS, filename });
};
```

Re-export `fileSaveAvailable` so components can check.

- [ ] **Step 2: Handle the success action in the data reducer**

Find `src/reducers/data.ts`. In the reducer's switch, on `SAVE_SCENARIOS_SUCCESS`, clear the localStorage overlay for that filename (since it just got promoted to the sidecar JSON):

```ts
case SAVE_SCENARIOS_SUCCESS:
	return {
		...state,
		scenariosOverlays: {
			...state.scenariosOverlays,
			[action.filename]: {}
		}
	};
```

(Verify the existing `scenariosOverlays` shape; it should be `{[filename]: ScenariosDefinition}`.)

- [ ] **Step 3: Add the Save button to the controls**

In `src/components/adjacency-map-controls.ts`, find where the "Readout changes" button lives. Adjacent to it, add a "Save to file" button:

```ts
${fileSaveAvailable() ? html`
	<button @click=${this._handleSaveToFile}>Save to file</button>
` : ''}
```

And the handler:

```ts
async _handleSaveToFile() {
	try {
		await store.dispatch(saveScenariosToFile());
	} catch (err) {
		console.warn('Save failed:', err);
	}
}
```

Import `fileSaveAvailable` and `saveScenariosToFile`.

- [ ] **Step 4: Verify build**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/actions/data.ts src/reducers/data.ts src/components/adjacency-map-controls.ts
git commit -m "Add Save-to-file button using FSA + clear overlays after save"
```

---

## Workstream F: Agent Collaboration Kit (last)

### Task 16: Rename `data/common.ts` to `data/common.SAMPLE.ts`

**Files:**
- Rename: `data/common.ts` → `data/common.SAMPLE.ts`

- [ ] **Step 1: Rename**

```bash
git mv data/common.ts data/common.SAMPLE.ts 2>/dev/null || mv data/common.ts data/common.SAMPLE.ts
```

(Note: `common.ts` is currently untracked per git status — the `mv` form is necessary.)

- [ ] **Step 2: Regenerate config**

Run: `npm run generate:config`
Expected: `src/data.GENERATED.ts` no longer references `common`. (It was filtered by `SAMPLE` check, so this should just remove a stray import if any was lurking.)

- [ ] **Step 3: Commit**

```bash
git add data/common.SAMPLE.ts src/data.GENERATED.ts
git commit -m "Rename starter stub to common.SAMPLE.ts to match convention"
```

### Task 17: Add JSDoc comments to types.ts

**Files:**
- Modify: `src/types.ts` (RawMapDefinition, RawScenario, the inline node-override type, and the new `removed` field)

- [ ] **Step 1: Add doc comments**

In `src/types.ts`, add JSDoc above key types:

```ts
/**
 * Top-level shape of a data file under `data/`. Each data file exports
 * a default `RawMapDefinition`. Scenarios overlay the base node values
 * and edges.
 */
export type RawMapDefinition = { ... };

/**
 * A scenario: a named overlay that modifies the base graph. Scenarios
 * can `extends` another scenario. Per-node overrides can adjust values,
 * add/remove/modify edges, or mark a node as `removed: true` to omit
 * it from the rendered graph entirely.
 */
export type RawScenario = { ... };
```

And on the inline node override (`RawScenario.nodes[id]`), add a doc comment for `removed`:

```ts
nodes: {
	[id : NodeID] : {
		/**
		 * If true, this node is omitted from the rendered graph for this
		 * scenario. Edges from other nodes that reference this node as
		 * `parent` are silently dropped. Children whose only parent was
		 * this node become orphans. Setting `removed: false` or removing
		 * the override restores the node.
		 */
		removed? : boolean,
		// ... rest unchanged
	}
}
```

Add at least: `RawMapDefinition`, `RawScenario`, `RawNode` (or whatever the base node type is), `removed` field.

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "Add JSDoc to key data-file types for agent readability"
```

### Task 18: Create `tools/validate-data.ts` + npm script

**Files:**
- Create: `tools/validate-data.ts`
- Modify: `package.json` (add `validate` script)

- [ ] **Step 1: Implement the validator**

Create `tools/validate-data.ts`:

```ts
import { spawnSync } from 'child_process';

const main = async () => {
	// Re-generate the manifest so we pick up any new files / sidecars.
	const gen = spawnSync('npm', ['run', 'generate:config'], { stdio: 'inherit' });
	if (gen.status !== 0) {
		console.error('generate:config failed');
		process.exit(1);
	}

	// Dynamic import after regeneration.
	const { DATA, SIDECAR_EDITS } = await import('../src/data.GENERATED.js');
	const { AdjacencyMap } = await import('../src/adjacency-map.js');

	let failures = 0;

	for (const filename of Object.keys(DATA)) {
		const baseRaw = DATA[filename];
		const sidecar = (SIDECAR_EDITS as Record<string, unknown>)[filename] || {};
		const merged = {
			...baseRaw,
			scenarios: { ...baseRaw.scenarios, ...(sidecar as object) }
		};

		const scenarioNames = ['', ...Object.keys(merged.scenarios || {})];
		for (const scenarioName of scenarioNames) {
			try {
				new AdjacencyMap(merged, scenarioName);
			} catch (err) {
				failures++;
				const e = err as Error;
				console.error(`FAIL ${filename} [${scenarioName || '(base)'}]: ${e.message}`);
			}
		}
	}

	if (failures > 0) {
		console.error(`\n${failures} validation failure(s).`);
		process.exit(1);
	}
	console.log('All data files validate.');
};

main().catch(err => {
	console.error(err);
	process.exit(1);
});
```

- [ ] **Step 2: Add the npm script**

In `package.json` scripts:

```json
"validate": "node --loader ts-node/esm tools/validate-data.ts"
```

- [ ] **Step 3: Run it**

Run: `npm run validate`
Expected: "All data files validate." (or surfaces real validation failures we should fix.)

If the test reports failures in existing data files, evaluate: did our changes break something, or were they always broken? Fix or document.

- [ ] **Step 4: Commit**

```bash
git add tools/validate-data.ts package.json
git commit -m "Add npm run validate to check all data files + scenarios"
```

### Task 19: Write AGENTS.md

**Files:**
- Create: `AGENTS.md` at repo root

- [ ] **Step 1: Write the doc**

Create `AGENTS.md`:

````markdown
# Agent guide to adjacency-map

This file tells AI agents how to safely edit the data files in this project.

## What this project is

`adjacency-map` is a webapp that visualizes graph-shaped data for scenario planning. Each file in `data/*.ts` is a `RawMapDefinition` — nodes with edges, plus named scenarios that overlay modifications.

The user's typical workflow:
1. They ask you to add/change/remove nodes, edges, scenarios, or properties.
2. You edit a TypeScript file in `data/`.
3. You run `npm run validate` to confirm the file is valid.
4. The dev server's file watcher picks up the change; the webapp auto-reloads.

## File conventions

- Files ending in `.ts` directly under `data/` are auto-discovered and become loadable in the webapp.
- Files containing `SAMPLE` in the name are skipped (e.g., `data/common.SAMPLE.ts` is a template, not an active data file).
- Files ending in `.edits.json` are user-saved scenario overrides. Don't edit these by hand unless you're explicitly "promoting" user edits into the canonical TS file (in which case: copy the entries into the TS file's `scenarios` block, then delete the corresponding entries from the JSON).

## The shape of a data file

The canonical schema lives in `src/types.ts` (look for `RawMapDefinition`, `RawScenario`, `RawNode`). A minimal example:

```ts
import { RawMapDefinition } from '../src/types.js';

const data: RawMapDefinition = {
	description: 'Short description of what this map models',
	import: 'product',  // Library that defines edge property types
	nodes: {
		feature_a: { description: 'Feature A' },
		feature_b: {
			description: 'Feature B',
			edges: [{ type: 'engineering', parent: 'feature_a' }]
		}
	},
	scenarios: {
		'no-feature-b': {
			description: 'What if we don\'t build B',
			nodes: {
				feature_b: { removed: true }
			}
		}
	}
};

export default data;
```

## Common operations

### Adding a node

Add an entry to the top-level `nodes` map. Choose an ID that's unique within the file. The simplest node is `{description: 'text'}`.

### Adding an edge

An edge lives on the dependent node and points to its parent:

```ts
nodes: {
	feature_x: {
		description: 'Feature X',
		edges: [
			{ type: 'engineering', parent: 'some_other_node' },
			{ type: 'ux', parent: 'some_other_node', cost: 5 }
		]
	}
}
```

The `type` must be a property defined in the imported library (`product` library defines `engineering`, `ux`, `data`, etc. — check `src/libraries.ts`).

### Adding a scenario

A scenario overlays modifications onto the base data:

```ts
scenarios: {
	'aggressive-roadmap': {
		description: 'Push everything by Q3',
		nodes: {
			feature_a: { values: { certainty: 0.9 } },
			feature_b: { removed: true }
		}
	}
}
```

### Omitting a node from a scenario

Use `removed: true` in the scenario's node override:

```ts
scenarios: {
	'without-x': {
		description: 'What if X is descoped',
		nodes: {
			feature_x: { removed: true }
		}
	}
}
```

The omitted node disappears from the rendered graph in this scenario. Edges pointing to it from other nodes are silently dropped. Children with no other parent become orphans. The data is preserved — toggling `removed: false` (or removing the override entirely) restores everything.

## Workflow checklist

Before claiming a change is done:

1. **Edit the file.**
2. **Run `npm run validate`.** If it fails, read the error, fix, re-run.
3. **Don't touch `src/data.GENERATED.ts`** — it's auto-generated.
4. **If a scenario name has spaces or special characters,** quote it: `'my scenario': {...}`.

If the dev server is running (`npm run serve`), the watcher regenerates the manifest on save and the browser reloads automatically.

## Gotchas

- **Don't add comments inside the data structure** if the user has enabled save-back; whole-file saves preserve only the structural data. (Comments at the very top of the file, outside the `const data = {}` block, are safe.)
- **Edge `type` must match a defined property.** If you invent a new property name, define it in the data file's `properties` block too, or use one from the imported library.
- **Parent references must resolve.** An edge with `parent: 'foo'` where `foo` doesn't exist will fail validation — unless `foo` is omitted via `removed: true`, in which case the edge is silently dropped.
- **Scenario names** are arbitrary strings. The default scenario is the empty string.

## Save-back (user-side)

The webapp has a "Save to file" button (Chromium browsers only). When the user clicks it, the webapp uses the File System Access API to write their inline-edited scenarios to `data/<name>.edits.json`. That file is then merged into the live data at runtime. You can read it to see what edits the user has saved; if they ask you to "make these edits canonical", copy the scenarios from the JSON into the corresponding `data/<name>.ts` file under `scenarios:`, then delete the entries from the JSON.

## Pointers

- Canonical schema: `src/types.ts`
- Libraries that define property types: `src/libraries.ts`
- Validator: `tools/validate-data.ts` (run via `npm run validate`)
- Generator: `tools/config.ts` (run via `npm run generate:config`)
- Watcher: `tools/watch-data.ts` (started by `npm run serve`)
````

- [ ] **Step 2: Commit**

```bash
git add AGENTS.md
git commit -m "Add AGENTS.md guide for AI-assisted data editing"
```

---

## Final integration / smoke test

### Task 20: End-to-end smoke test

- [ ] **Step 1: Run the test suite**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 2: Run the validator**

Run: `npm run validate`
Expected: all data files validate.

- [ ] **Step 3: Start the dev server**

Run: `npm run serve`
Expected: server starts, both `tsc --watch` and `watch-data.ts` and `wds` are running.

- [ ] **Step 4: Open browser and verify**

Open `http://localhost:8081/?file=default` (or whatever the existing path is).
Check:
1. Page loads, diagram renders.
2. Click a node → sidebar updates, neighbors highlight, others dim.
3. Press Esc → selection clears.
4. Press Arrow keys → scenarios cycle.
5. URL hash updates to include `s=` and `n=` as you navigate.
6. (If on Chromium) "Save to file" button is visible when there are inline edits.

- [ ] **Step 5: Test the watcher**

In a separate terminal, edit `data/default.ts` (add a trivial comment). Watch the wds reload.

- [ ] **Step 6: Test the error banner**

Introduce a deliberate bug in `data/default.ts` (e.g., reference a non-existent parent). Verify the banner appears with the error message. Revert.

- [ ] **Step 7: Test omit**

Add `removed: true` to a node in a scenario in `data/default.ts`. Verify in the webapp that the node disappears from that scenario.

- [ ] **Step 8: Final commit if any cleanup happened**

If smoke testing surfaced minor fixes, commit them with a clear message:

```bash
git add <changed files>
git commit -m "Smoke-test fixes for planning workflow"
```

---

## Self-Review notes

- All seven workstreams (A-G) from the spec map to tasks 1-19.
- Task ordering follows the spec's recommended build order (C → B → A → D → E → G → F).
- Each task ends in a commit, per "commit early and often."
- Smoke test (Task 20) covers the integration the spec calls out.
- The "removed" field is added to types in Task 9, tested in Task 10, implemented in Task 11, validated in Task 18, and documented in Tasks 17 + 19 — coverage chain complete.
