# Planning Tranche 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move adjacency-map from "visualize one scenario" to "generate, compare, and choose between alternatives with hard numbers" — by adding an inspect CLI, a metrics dashboard, fork-scenario, and side-by-side scenario comparison.

**Architecture:** Four workstreams from `docs/superpowers/specs/2026-05-11-planning-tranche-2-design.md`. Build order **K → I → J → H** (smallest first; comparison is largest and benefits from the metrics-strip already being in place). Plus a smoke-test pass at the end.

**Tech Stack:** Same as tranche 1 — TypeScript 4.7, lit-element 2, Redux + redux-thunk, reselect, web-dev-server, mocha, playwright. No new deps.

**Spec:** `docs/superpowers/specs/2026-05-11-planning-tranche-2-design.md`

---

## Workstream K: Inspect-data CLI

### Task 1: Create `tools/inspect-data.ts`

**Files:**
- Create: `tools/inspect-data.ts`
- Modify: `package.json` (add `inspect` script)

The validator pattern in `tools/validate-data.ts` is the template — same generate-then-import dance, same `Record<string, any>` casts to bypass keyof typing.

- [ ] **Step 1: Write the CLI**

Create `tools/inspect-data.ts`:

```ts
import { spawnSync } from 'child_process';

const main = async () => {
	const args = process.argv.slice(2);
	const fileArg = args[0];
	const scenarioArg = args[1] !== undefined ? args[1] : '';

	// Regenerate the manifest first so we pick up sidecars + new data files.
	const gen = spawnSync('npm', ['run', 'generate:config'], { stdio: 'pipe' });
	if (gen.status !== 0) {
		console.error('generate:config failed');
		process.stderr.write(gen.stderr?.toString() || '');
		process.exit(1);
	}

	const generated = await import('../src/data.GENERATED.js');
	const { AdjacencyMap } = await import('../src/adjacency-map.js');
	const DATA = generated.DATA as Record<string, any>;
	const SIDECAR_EDITS = (generated.SIDECAR_EDITS || {}) as Record<string, any>;

	if (!fileArg) {
		console.log('Usage: npm run inspect -- <file> [scenario]');
		console.log('Files:', Object.keys(DATA).join(', '));
		process.exit(0);
	}
	if (!(fileArg in DATA)) {
		console.error(`Unknown file: ${fileArg}. Available: ${Object.keys(DATA).join(', ')}`);
		process.exit(1);
	}

	const baseRaw = DATA[fileArg];
	const sidecar = SIDECAR_EDITS[fileArg] || {};
	const merged = {
		...baseRaw,
		scenarios: { ...(baseRaw.scenarios || {}), ...sidecar }
	};

	// Resolve scenario name. Array-valued scenarios expand to name_0, name_1, ...
	const allScenarios : string[] = [''];
	for (const [name, def] of Object.entries(merged.scenarios || {})) {
		if (Array.isArray(def)) {
			for (let i = 0; i < def.length; i++) allScenarios.push(`${name}_${i}`);
		} else {
			allScenarios.push(name);
		}
	}
	if (!allScenarios.includes(scenarioArg)) {
		console.error(`Unknown scenario '${scenarioArg}' in ${fileArg}. Available: ${allScenarios.map(s => s || '(base)').join(', ')}`);
		process.exit(1);
	}

	const map = new AdjacencyMap(merged, scenarioArg);
	const baseMap = scenarioArg ? new AdjacencyMap(merged, '') : null;

	const out : string[] = [];
	out.push(`File: ${fileArg}`);
	out.push(`Scenario: ${scenarioArg || '(base)'}`);
	if (map.scenario && map.scenario.description) out.push(`Description: ${map.scenario.description}`);
	out.push(`Map description: ${map.description || '(none)'}`);
	out.push('');

	const nodeIDs = Object.keys(map.nodes).filter(id => id !== '');
	out.push(`Nodes: ${nodeIDs.length}`);
	const removed = (map as any)._removedNodeIDs as Set<string>;
	if (removed && removed.size > 0) out.push(`Removed in scenario: ${[...removed].join(', ')}`);
	out.push(`Edges: ${map.edges.length}`);
	out.push('');

	out.push('Root aggregate values:');
	const result = map.result;
	for (const [k, v] of Object.entries(result)) {
		const num = typeof v === 'number' ? v.toFixed(2) : String(v);
		out.push(`  ${k.padEnd(16)} ${num}`);
	}
	out.push('');

	// Top 5 nodes by 'value' (or whatever property looks like a leaderboard candidate).
	const candidateMetric = 'value' in result ? 'value' : Object.keys(result)[0];
	if (candidateMetric) {
		const ranked = nodeIDs.map(id => {
			const nv = map.node(id).values || {};
			return { id, score: typeof nv[candidateMetric] === 'number' ? nv[candidateMetric] : 0 };
		}).sort((a, b) => b.score - a.score).slice(0, 5);
		out.push(`Top 5 by ${candidateMetric}:`);
		for (const r of ranked) {
			out.push(`  ${r.id.padEnd(24)} ${r.score.toFixed(2)}`);
		}
		out.push('');
	}

	if (baseMap) {
		out.push('Modified from base scenario:');
		let anyDiff = false;
		const allIDs = new Set([...Object.keys(map.nodes), ...Object.keys(baseMap.nodes)]);
		for (const id of allIDs) {
			if (id === '') continue;
			const inBase = id in baseMap.nodes;
			const inThis = id in map.nodes;
			if (!inBase && inThis) { out.push(`  + ${id} (added)`); anyDiff = true; continue; }
			if (inBase && !inThis) { out.push(`  - ${id} (removed)`); anyDiff = true; continue; }
			const bv = baseMap.node(id).values || {};
			const tv = map.node(id).values || {};
			for (const k of new Set([...Object.keys(bv), ...Object.keys(tv)])) {
				const a = bv[k];
				const b = tv[k];
				if (typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) > 1e-9) {
					out.push(`  ~ ${id}.${k}: ${a.toFixed(2)} -> ${b.toFixed(2)} (${(b - a >= 0 ? '+' : '')}${(b - a).toFixed(2)})`);
					anyDiff = true;
				} else if (a !== b && typeof a !== 'number' && typeof b !== 'number') {
					out.push(`  ~ ${id}.${k}: ${JSON.stringify(a)} -> ${JSON.stringify(b)}`);
					anyDiff = true;
				}
			}
		}
		if (!anyDiff) out.push('  (no value diffs from base)');
		out.push('');
	}

	console.log(out.join('\n'));
};

main().catch(err => {
	console.error(err);
	process.exit(1);
});
```

- [ ] **Step 2: Add npm script**

In `package.json` scripts, add right after the existing `validate` line:

```json
"inspect": "node --loader ts-node/esm tools/inspect-data.ts",
```

- [ ] **Step 3: Run it**

```bash
npm run inspect -- default
npm run inspect -- default increased-certainty
```

Expected: structured output as in the spec sample. No errors. Exit code 0.

- [ ] **Step 4: Update AGENTS.md**

In `AGENTS.md`, append to the "Workflow checklist" section, after the validate step:

```markdown
4. **Run `npm run inspect -- <file> <scenario>`** to see the numerical effect of your change (aggregate totals, top nodes by value, diff from base). If the numbers don't match what the user asked for, fix and re-run.
```

Renumber the following items if needed (the `Don't touch src/data.GENERATED.ts` becomes step 5, etc.).

- [ ] **Step 5: Commit**

```bash
git add tools/inspect-data.ts package.json AGENTS.md
git commit -m "Add npm run inspect for agent-side numerical verification"
```

---

## Workstream I: Aggregate metrics dashboard

### Task 2: Extend `RawMapDisplay` with `headlineMetrics`

**Files:**
- Modify: `src/types.ts` (find `RawMapDisplay` — search via grep)

- [ ] **Step 1: Find and extend the type**

Run: `grep -n "RawMapDisplay\b" src/types.ts | head -5`

Then add `headlineMetrics?: PropertyName[]` to the type. Sample shape (adapt to whatever fields exist):

```ts
export type RawMapDisplay = {
	// ... existing fields ...
	/**
	 * Properties to surface in the always-visible metrics strip above the
	 * diagram. If omitted, all properties with a non-zero aggregate value at
	 * the root are shown (capped at 6).
	 */
	headlineMetrics?: PropertyName[];
};
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "Add optional headlineMetrics to RawMapDisplay"
```

### Task 3: Add `selectHeadlineMetrics` selector

**Files:**
- Modify: `src/selectors.ts`

- [ ] **Step 1: Add the selector**

In `src/selectors.ts`, after the existing summary selectors (the section around `selectSummaryValues`), add:

```ts
export const selectHeadlineMetrics = createSelector(
	selectAdjacencyMap,
	(map) : {property: string, value: number}[] => {
		if (!map) return [];
		const result = map.result || {};
		const configured = map.data?.display?.headlineMetrics;
		const entries : {property: string, value: number}[] = [];
		const candidates = configured && configured.length > 0
			? configured
			: Object.keys(result).filter(k => typeof result[k] === 'number' && Math.abs(result[k] as number) > 1e-9);
		for (const k of candidates) {
			const v = result[k];
			if (typeof v !== 'number') continue;
			entries.push({ property: k, value: v });
		}
		// Soft cap when auto-picking.
		if (!configured) entries.splice(6);
		return entries;
	}
);
```

(Verify `map.data.display` is the right access path. `grep -n "data.display\|get data" src/adjacency-map.ts | head -5` if unsure.)

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/selectors.ts
git commit -m "Add selectHeadlineMetrics selector"
```

### Task 4: Render the metrics strip in main-view

**Files:**
- Modify: `src/components/main-view.ts`

- [ ] **Step 1: Add the state + selector import**

In the imports section of `src/components/main-view.ts`, add to the existing selector import:

```ts
import {
	// ... existing imports ...
	selectHeadlineMetrics,
} from "../selectors.js";
```

Add a new `@state()` field near the other state declarations:

```ts
@state()
_headlineMetrics : {property: string, value: number}[] = [];
```

In `stateChanged(state)`, populate it:

```ts
this._headlineMetrics = selectHeadlineMetrics(state);
```

- [ ] **Step 2: Add CSS**

In `static override get styles()`, append inside the existing `css\`...\``:

```css
.metrics-strip {
	position: absolute;
	top: 0;
	right: 0;
	z-index: 50;
	display: flex;
	gap: 0.5em;
	padding: 0.5em;
	background: rgba(255, 255, 255, 0.85);
	border-bottom-left-radius: 8px;
	font-size: 0.85em;
	box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
}
.metric-tile {
	display: flex;
	flex-direction: column;
	align-items: flex-start;
	padding: 0.25em 0.5em;
	border-right: 1px solid #ddd;
}
.metric-tile:last-child {
	border-right: none;
}
.metric-label {
	font-size: 0.75em;
	color: #555;
	text-transform: uppercase;
	letter-spacing: 0.05em;
}
.metric-value {
	font-weight: bold;
	font-variant-numeric: tabular-nums;
}
```

- [ ] **Step 3: Render the strip in `render()`**

Modify `render()` to add the metrics strip before `<adjacency-map-controls>`:

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
				${!this._dataError && this._headlineMetrics.length > 0 ? html`
					<div class='metrics-strip'>
						${this._headlineMetrics.map(m => html`
							<div class='metric-tile'>
								<span class='metric-label'>${m.property}</span>
								<span class='metric-value'>${m.value.toFixed(2)}</span>
							</div>
						`)}
					</div>` : ''}
				<adjacency-map-controls></adjacency-map-controls>
				<adjacency-map-diagram @node-clicked=${this._handleNodeClicked} @node-hovered=${this._handleNodeHovered} .map=${this._adjacencyMap} .hoveredEdgeID=${this._hoveredEdgeID} .hoveredLayoutID=${this._hoveredLayoutID} .selectedLayoutID=${this._selectedLayoutID} .scale=${this._scale} .editedNodes=${this._editedNodes}></adjacency-map-diagram>
				<dialog-element .open=${this._dialogOpen} .title=${this._dialogTitle} @dialog-should-close=${this._handleDialogShouldClose} .hideClose=${true}>${this._dialogContent}</dialog-element>
		</div>
	`;
}
```

- [ ] **Step 4: Verify build**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/main-view.ts
git commit -m "Render headline metrics strip above the diagram"
```

---

## Workstream J: Fork scenario

### Task 5: Add `forkScenario` thunk and reducer case

**Files:**
- Modify: `src/actions/data.ts`
- Modify: `src/reducers/data.ts`

The pattern: like `BEGIN_EDITING_SCENARIO` (existing) but the new scenario's nodes object is materialized from the CURRENT map's resolved scenario, not just an empty placeholder.

- [ ] **Step 1: Add the action constant**

In `src/actions/data.ts`, near the other action-type exports at the top (after `SAVE_SCENARIOS_SUCCESS`):

```ts
export const FORK_SCENARIO_SUCCESS = 'FORK_SCENARIO_SUCCESS';
```

- [ ] **Step 2: Add the `forkScenario` thunk**

At the end of `src/actions/data.ts`:

```ts
// Serializes a node's current scenario-resolved state back to a RawScenario node
// override that, when applied to the base data, reproduces the same effective
// node. Used by forkScenario to materialize a scenario as a free-standing copy.
const serializeScenarioNode = (resolvedValues : {[name : string] : number | string | boolean}, resolvedEdges : EdgeValue[]) : { values: {[k:string]: number | string | boolean}, edges: { add: EdgeValue[] } } => {
	return {
		values: { ...resolvedValues },
		edges: { add: resolvedEdges.map(e => ({ ...e })) }
	};
};

export const forkScenario = (sourceName : ScenarioName, newName : ScenarioName) : ThunkAction<void, RootState, unknown, AnyAction> => (dispatch, getState) => {
	const state = getState();
	const filename = selectFilename(state);
	const map = selectAdjacencyMap(state);
	if (!map) throw new Error('No map loaded');

	// Trim & validate new name.
	const trimmed = newName.trim();
	if (!trimmed) throw new Error('Scenario name must not be empty');
	const overlay = selectCurrentScenarioOverlay(state);
	if (overlay[trimmed]) throw new Error(`Scenario '${trimmed}' already exists in overlay`);
	if (map.data.scenarios && map.data.scenarios[trimmed]) throw new Error(`Scenario '${trimmed}' already exists in base data`);

	// Build materialized nodes from the current map's view.
	const nodes : {[id : string]: { values: any, edges: { add: any[] } }} = {};
	for (const [id, node] of Object.entries(map.nodes)) {
		if (id === '') continue;
		// node.values returns the resolved value object (numbers/bools).
		const resolved : {[k:string]: number | string | boolean} = {};
		for (const [k, v] of Object.entries(node.values || {})) {
			if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') resolved[k] = v;
		}
		// node.edges returns ExpandedEdgeValue[]; we serialize as plain EdgeValue.
		const edges : EdgeValue[] = (node.edges || []).map(e => {
			const cleaned : any = { type: e.type, parent: e.parent };
			// Carry numeric constants.
			for (const [ck, cv] of Object.entries(e)) {
				if (ck === 'type' || ck === 'parent' || ck === 'source') continue;
				if (typeof cv === 'number') cleaned[ck] = cv;
			}
			return cleaned as EdgeValue;
		});
		nodes[id] = serializeScenarioNode(resolved, edges);
	}

	dispatch({
		type: FORK_SCENARIO_SUCCESS,
		filename,
		sourceName,
		newName: trimmed,
		nodes
	});
	dispatch(updateScenarioName(trimmed));
};
```

- [ ] **Step 3: Handle the action in the reducer**

In `src/reducers/data.ts`, add `FORK_SCENARIO_SUCCESS` to the action-type imports at the top, then add a case to the switch (after `BEGIN_EDITING_SCENARIO`):

```ts
case FORK_SCENARIO_SUCCESS:
{
	const filename = action.filename as DataFilename;
	const existing = state.scenariosOverlays[filename] || {};
	const newScenario : ScenarioWithExtends = {
		description: `Forked from ${action.sourceName || '(base)'}`,
		nodes: action.nodes
	};
	return {
		...state,
		scenariosOverlays: {
			...state.scenariosOverlays,
			[filename]: {
				...existing,
				[action.newName]: newScenario
			}
		}
	};
}
```

(Verify `ScenarioWithExtends` is imported in this file. If not, add to imports from `'../types.js'`.)

- [ ] **Step 4: Verify build**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/actions/data.ts src/reducers/data.ts
git commit -m "Add forkScenario thunk that materializes the resolved scenario"
```

### Task 6: Add Fork button to controls

**Files:**
- Modify: `src/components/adjacency-map-controls.ts`

- [ ] **Step 1: Add imports**

In the imports from `'../actions/data.js'`, add `forkScenario`.

- [ ] **Step 2: Add the button**

In the controls render template, find the existing scenario-related buttons (search for `PLUS_ICON` — it's around line 275 in the existing code). Right after the scenario dropdown (around line 270-274), add a Fork button:

```ts
${this._adjacencyMap ? html`<button class='small' title='Fork the current scenario into a new editable copy' @click=${this._handleForkScenarioClicked}>Fork</button>` : ''}
```

The button shows whenever a map is loaded (regardless of editing mode — forking is itself an act of starting to edit).

- [ ] **Step 3: Add the click handler**

In the same component, add (near other handlers):

```ts
_handleForkScenarioClicked() {
	const currentName = this._adjacencyMap?.scenarioName || '';
	const suggested = currentName ? `${currentName}-fork` : 'fork';
	const newName = window.prompt('New scenario name:', suggested);
	if (newName === null) return;
	try {
		store.dispatch(forkScenario(currentName, newName));
	} catch (err) {
		const e = err as Error;
		alert(`Fork failed: ${e.message}`);
	}
}
```

- [ ] **Step 4: Verify build**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/adjacency-map-controls.ts
git commit -m "Add Fork button that materializes the current scenario as a new editable copy"
```

---

## Workstream H: Scenario comparison view

### Task 7: Add compare-scenario state

**Files:**
- Modify: `src/types.ts` (extend `URLHashArgs`)
- Modify: `src/actions/data.ts` (action constant + thunk)
- Modify: `src/reducers/data.ts` (reducer case + initial state)

- [ ] **Step 1: Extend `URLHashArgs`**

In `src/types.ts`, find `URLHashArgs` (around line 796). Add `c?: ScenarioName`:

```ts
export type URLHashArgs = {
	s? : ScenarioName,
	n? : LayoutID,
	c? : ScenarioName
};
```

- [ ] **Step 2: Add the data action**

In `src/actions/data.ts`, near the other action-type exports:

```ts
export const UPDATE_COMPARE_SCENARIO_NAME = 'UPDATE_COMPARE_SCENARIO_NAME';
```

Add a thunk near the other scenario-name thunks:

```ts
export const updateCompareScenarioName = (scenarioName : ScenarioName | undefined) : AnyAction => {
	return {
		type: UPDATE_COMPARE_SCENARIO_NAME,
		scenarioName
	};
};
```

- [ ] **Step 3: Reduce it**

In `src/reducers/data.ts`, import `UPDATE_COMPARE_SCENARIO_NAME` from `'../actions/data.js'`. Add an initial-state field by finding the `INITIAL_STATE` constant and adding:

```ts
compareScenarioName: undefined as ScenarioName | undefined,
```

(Locate `INITIAL_STATE` via `grep -n "INITIAL_STATE\|const initialState\|const INITIAL" src/reducers/data.ts | head -3`.)

Add the case:

```ts
case UPDATE_COMPARE_SCENARIO_NAME:
	return {
		...state,
		compareScenarioName: action.scenarioName
	};
```

Also update the `RootState`-or-equivalent `DataState` type to include the field. Find the type near the top of `src/reducers/data.ts` or in `src/types.ts`. Add `compareScenarioName?: ScenarioName;`.

- [ ] **Step 4: Hash parse and emit `c=`**

In `src/actions/app.ts`, find `parseHash` (around line 51). Add a case for `'c'`:

```ts
case 'c':
	args.c = val;
	break;
```

In `ingestHash` (around line 69), add:

```ts
case 'c':
	dispatch(updateCompareScenarioName(value || undefined));
	break;
```

And add `updateCompareScenarioName` to the imports.

In `src/selectors.ts`, find `selectHashForCurrentState` (around line 167). Add `compareScenarioName` to its inputs:

```ts
export const selectCompareScenarioName = (state : RootState) => state.data ? state.data.compareScenarioName : undefined;

export const selectHashForCurrentState = createSelector(
	selectScenarioName,
	selectSelectedLayoutID,
	selectCompareScenarioName,
	(scenarioName, selectedLayoutID, compareScenarioName) => {
		const pieces : URLHashArgs = {};
		if (scenarioName != DEFAULT_SCENARIO_NAME) pieces.s = scenarioName;
		if (selectedLayoutID) pieces.n = selectedLayoutID;
		if (compareScenarioName !== undefined) pieces.c = compareScenarioName;
		return Object.entries(pieces).map(entry => entry[0] + '=' + entry[1]).join('&');
	}
);
```

(The existing function signature may differ slightly — match the current style. Other agent work may have touched this file; check first.)

- [ ] **Step 5: Verify build**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/actions/data.ts src/actions/app.ts src/reducers/data.ts src/selectors.ts
git commit -m "Track compareScenarioName in state + URL"
```

### Task 8: Build the compare AdjacencyMap selectors

**Files:**
- Modify: `src/selectors.ts`

- [ ] **Step 1: Add `selectCompareAdjacencyMap`**

After `selectAdjacencyMap` in `src/selectors.ts`, add:

```ts
export const selectCompareAdjacencyMap = createSelector(
	selectData,
	selectCompareScenarioName,
	selectRenderGroups,
	(data, scenarioName, renderGroups) => {
		if (!data || scenarioName === undefined) return null;
		try {
			return new AdjacencyMap(data, scenarioName, !renderGroups);
		} catch {
			return null;
		}
	}
);
```

- [ ] **Step 2: Add `selectComparisonDelta`**

After `selectCompareAdjacencyMap`, add a selector that produces:
- A map of `nodeID -> { changed, added, removed }`
- An array of per-property aggregate deltas (`{property, a, b, delta}`)

```ts
type CompareDelta = {
	perNode: {[id : string]: 'changed' | 'added' | 'removed'},
	perProperty: {property: string, a: number, b: number, delta: number}[]
};

export const selectComparisonDelta = createSelector(
	selectAdjacencyMap,
	selectCompareAdjacencyMap,
	(mapA, mapB) : CompareDelta | null => {
		if (!mapA || !mapB) return null;
		const perNode : {[id : string]: 'changed' | 'added' | 'removed'} = {};
		const allIDs = new Set([...Object.keys(mapA.nodes), ...Object.keys(mapB.nodes)]);
		for (const id of allIDs) {
			if (id === '') continue;
			const inA = id in mapA.nodes;
			const inB = id in mapB.nodes;
			if (inA && !inB) perNode[id] = 'removed';
			else if (!inA && inB) perNode[id] = 'added';
			else {
				const av = mapA.node(id).values || {};
				const bv = mapB.node(id).values || {};
				let changed = false;
				for (const k of new Set([...Object.keys(av), ...Object.keys(bv)])) {
					const a = av[k];
					const b = bv[k];
					if (typeof a === 'number' && typeof b === 'number') {
						if (Math.abs(a - b) > 1e-9) { changed = true; break; }
					} else if (a !== b) {
						changed = true; break;
					}
				}
				if (changed) perNode[id] = 'changed';
			}
		}
		const resA = mapA.result || {};
		const resB = mapB.result || {};
		const perProperty : CompareDelta['perProperty'] = [];
		for (const k of new Set([...Object.keys(resA), ...Object.keys(resB)])) {
			const a = typeof resA[k] === 'number' ? resA[k] as number : 0;
			const b = typeof resB[k] === 'number' ? resB[k] as number : 0;
			if (Math.abs(a) < 1e-9 && Math.abs(b) < 1e-9) continue;
			perProperty.push({ property: k, a, b, delta: b - a });
		}
		return { perNode, perProperty };
	}
);
```

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/selectors.ts
git commit -m "Add selectCompareAdjacencyMap and selectComparisonDelta"
```

### Task 9: Diff classes on nodes in the diagram

**Files:**
- Modify: `src/components/adjacency-map-diagram.ts`

The diagram component already accepts a `map` property. Add an optional `compareDelta` property and a `compareMap` property. When `compareDelta` is set:
- Nodes get `diff-changed` / `diff-added` / `diff-removed` class based on their entry in `compareDelta.perNode`.
- Visual: changed = blue tint, added = green tint, removed = red strikethrough (or just opacity).

- [ ] **Step 1: Add properties**

In `src/components/adjacency-map-diagram.ts`, near the other `@property` decorators:

```ts
@property({type: Object})
compareDelta : {perNode: {[id: string]: 'changed' | 'added' | 'removed'}} | null = null;
```

- [ ] **Step 2: Apply classes in `_svgForNode`**

In `_svgForNode`, after the existing class assignment for selected/edited/dim, add:

```ts
const diffKind = this.compareDelta ? this.compareDelta.perNode[(node as any).id] : undefined;
const diffChanged = diffKind === 'changed';
const diffAdded = diffKind === 'added';
const diffRemoved = diffKind === 'removed';
const classes : ClassInfo = {
	selected,
	edited,
	dim,
	'diff-changed': diffChanged,
	'diff-added': diffAdded,
	'diff-removed': diffRemoved
};
```

- [ ] **Step 3: Add CSS**

In the `static override get styles()` css block:

```css
circle.diff-changed {
	stroke: #1e88e5;
	stroke-width: 4px;
}
circle.diff-added {
	stroke: #43a047;
	stroke-width: 4px;
}
circle.diff-removed {
	stroke: #e53935;
	stroke-width: 4px;
	opacity: 0.4 !important;
}
```

- [ ] **Step 4: Verify build**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/adjacency-map-diagram.ts
git commit -m "Apply diff classes to nodes when compareDelta is provided"
```

### Task 10: Render two diagrams + diff strip in main-view

**Files:**
- Modify: `src/components/main-view.ts`

- [ ] **Step 1: Add state**

Near the other `@state()` declarations:

```ts
@state()
_compareScenarioName : string | undefined = undefined;

@state()
_compareAdjacencyMap : AdjacencyMap | null = null;

@state()
_comparisonDelta : { perNode: {[id: string]: 'changed' | 'added' | 'removed'}, perProperty: {property: string, a: number, b: number, delta: number}[] } | null = null;
```

In the imports from `'../selectors.js'`:

```ts
selectCompareScenarioName,
selectCompareAdjacencyMap,
selectComparisonDelta,
```

In `stateChanged(state)`:

```ts
this._compareScenarioName = selectCompareScenarioName(state);
this._compareAdjacencyMap = selectCompareAdjacencyMap(state);
this._comparisonDelta = selectComparisonDelta(state);
```

- [ ] **Step 2: Add CSS**

Append to the existing `css\`...\``:

```css
.compare-strip {
	position: absolute;
	top: 0;
	left: 50%;
	transform: translateX(-50%);
	z-index: 40;
	display: flex;
	gap: 0.75em;
	padding: 0.5em 1em;
	background: rgba(255, 255, 255, 0.9);
	border-bottom-left-radius: 8px;
	border-bottom-right-radius: 8px;
	font-size: 0.85em;
	box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
}
.compare-metric {
	display: flex;
	flex-direction: column;
	align-items: center;
}
.compare-metric .label {
	font-size: 0.75em;
	color: #555;
}
.compare-metric .values {
	font-variant-numeric: tabular-nums;
}
.compare-delta-pos { color: #43a047; font-weight: bold; }
.compare-delta-neg { color: #e53935; font-weight: bold; }
.diagram-pair {
	display: flex;
	gap: 0.5em;
}
.diagram-pair > * {
	flex: 1 1 0;
	min-width: 0;
}
```

- [ ] **Step 3: Render the diff strip and second diagram**

Modify `render()` to render the compare elements when `_compareAdjacencyMap` is non-null:

```ts
override render() : TemplateResult {
	const compareOn = !!this._compareAdjacencyMap;
	return html`
		<div class='container'>
				${this._dataError ? html`
					<div class='error-banner'>
						<strong>Data error in <code>${this._filename}</code></strong>
						${this._dataError}
						<div><a @click=${() => window.location.reload()}>Reload</a></div>
					</div>` : ''}
				${!this._dataError && this._headlineMetrics.length > 0 && !compareOn ? html`
					<div class='metrics-strip'>
						${this._headlineMetrics.map(m => html`
							<div class='metric-tile'>
								<span class='metric-label'>${m.property}</span>
								<span class='metric-value'>${m.value.toFixed(2)}</span>
							</div>
						`)}
					</div>` : ''}
				${compareOn && this._comparisonDelta ? html`
					<div class='compare-strip'>
						${this._comparisonDelta.perProperty.slice(0, 6).map(p => html`
							<div class='compare-metric'>
								<span class='label'>${p.property}</span>
								<span class='values'>${p.a.toFixed(2)} / ${p.b.toFixed(2)}</span>
								<span class='${p.delta >= 0 ? 'compare-delta-pos' : 'compare-delta-neg'}'>${p.delta >= 0 ? '+' : ''}${p.delta.toFixed(2)}</span>
							</div>
						`)}
					</div>` : ''}
				<adjacency-map-controls></adjacency-map-controls>
				${compareOn ? html`
					<div class='diagram-pair'>
						<adjacency-map-diagram @node-clicked=${this._handleNodeClicked} @node-hovered=${this._handleNodeHovered} .map=${this._adjacencyMap} .compareDelta=${this._comparisonDelta} .hoveredEdgeID=${this._hoveredEdgeID} .hoveredLayoutID=${this._hoveredLayoutID} .selectedLayoutID=${this._selectedLayoutID} .scale=${this._scale * 0.5} .editedNodes=${this._editedNodes}></adjacency-map-diagram>
						<adjacency-map-diagram .map=${this._compareAdjacencyMap} .compareDelta=${this._comparisonDelta} .scale=${this._scale * 0.5}></adjacency-map-diagram>
					</div>
				` : html`
					<adjacency-map-diagram @node-clicked=${this._handleNodeClicked} @node-hovered=${this._handleNodeHovered} .map=${this._adjacencyMap} .hoveredEdgeID=${this._hoveredEdgeID} .hoveredLayoutID=${this._hoveredLayoutID} .selectedLayoutID=${this._selectedLayoutID} .scale=${this._scale} .editedNodes=${this._editedNodes}></adjacency-map-diagram>
				`}
				<dialog-element .open=${this._dialogOpen} .title=${this._dialogTitle} @dialog-should-close=${this._handleDialogShouldClose} .hideClose=${true}>${this._dialogContent}</dialog-element>
		</div>
	`;
}
```

(Watch out: `selectHashForCurrentState`'s update-loop currently triggers `canonicalizeHash` on hash changes. Compare-mode adds `c=` to the hash, which is fine — it canonicalizes through the same path. The existing infrastructure should handle this without changes.)

- [ ] **Step 4: Verify build**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/main-view.ts
git commit -m "Render compare mode: two diagrams + diff strip"
```

### Task 11: Add "Compare with" dropdown in controls

**Files:**
- Modify: `src/components/adjacency-map-controls.ts`

- [ ] **Step 1: Wire imports**

Add to the imports from `'../actions/data.js'`:

```ts
updateCompareScenarioName,
```

Add to imports from `'../selectors.js'`:

```ts
selectCompareScenarioName,
```

Add a `@state()` field:

```ts
@state()
_compareScenarioName : string | undefined = undefined;
```

In `stateChanged`:

```ts
this._compareScenarioName = selectCompareScenarioName(state);
```

- [ ] **Step 2: Add the dropdown**

In the render template, after the scenario dropdown, add a compare-with dropdown. Find the existing scenario `<select>` (search for `_legalScenarioNames.map`) and add right after it:

```ts
${this._legalScenarioNames.length > 1 ? html`
	<label for='compareScenarios'>Compare with</label>
	<select id='compareScenarios' @change=${this._handleCompareScenarioChanged}>
		<option .value=${''} .selected=${this._compareScenarioName === undefined}>(off)</option>
		${this._legalScenarioNames.map(scenarioName => html`<option .value=${scenarioName} .selected=${scenarioName === this._compareScenarioName}>${scenarioName || 'Default'}</option>`)}
	</select>` : ''}
```

Add the handler:

```ts
_handleCompareScenarioChanged(e : Event) {
	const target = e.target as HTMLSelectElement;
	const value = target.value;
	if (value === '' && this._compareScenarioName === undefined) return;
	store.dispatch(updateCompareScenarioName(value === '' ? undefined : value));
}
```

Note: distinguishing "off" (undefined) from "compare with base scenario" (empty string). The first option in the dropdown is "(off)" which dispatches `undefined`. To compare with base, the user picks "Default" which has value `''`. We need to handle that: when the dropdown value is `''` but the user just picked it (vs initial state), we want to dispatch `''` not `undefined`.

Simpler approach: use a sentinel value `__off__` for the off option:

```ts
${this._legalScenarioNames.length > 1 ? html`
	<label for='compareScenarios'>Compare with</label>
	<select id='compareScenarios' @change=${this._handleCompareScenarioChanged}>
		<option .value=${'__off__'} .selected=${this._compareScenarioName === undefined}>(off)</option>
		${this._legalScenarioNames.map(scenarioName => html`<option .value=${scenarioName || '__base__'} .selected=${(scenarioName === '' ? '__base__' : scenarioName) === (this._compareScenarioName === '' ? '__base__' : this._compareScenarioName)}>${scenarioName || 'Default'}</option>`)}
	</select>` : ''}
```

```ts
_handleCompareScenarioChanged(e : Event) {
	const target = e.target as HTMLSelectElement;
	const value = target.value;
	if (value === '__off__') store.dispatch(updateCompareScenarioName(undefined));
	else if (value === '__base__') store.dispatch(updateCompareScenarioName(''));
	else store.dispatch(updateCompareScenarioName(value));
}
```

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/adjacency-map-controls.ts
git commit -m "Add Compare-with dropdown to controls"
```

---

## Smoke tests + final integration

### Task 12: Extend smoke test with tranche-2 coverage

**Files:**
- Modify: `tools/smoke-test.mjs`

- [ ] **Step 1: Add checks after the existing sidecar test**

Just before the final console-errors section in `tools/smoke-test.mjs`, append these blocks:

```js
// ---------- Section: metrics dashboard ----------
await page.goto(`${BASE_URL}/main/default/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(300);
const metricsCount = await page.locator('.metrics-strip .metric-tile').count();
if (metricsCount > 0) pass(`metrics strip shows ${metricsCount} tile(s)`);
else fail('metrics strip empty or hidden on healthy load');

// ---------- Section: fork scenario ----------
// We use the keyboard to drive the prompt() dialog. Playwright handles prompt
// via page.on('dialog').
page.once('dialog', async (dialog) => {
	await dialog.accept('smoke-fork-test');
});
// Trigger fork via the button. Find by title attribute.
const forkBtn = page.locator('button[title*="Fork"]').first();
if (await forkBtn.count() > 0) {
	await forkBtn.click();
	await page.waitForTimeout(500);
	const scenarioOptions = await page.locator('#scenarios option').allTextContents();
	if (scenarioOptions.some(t => t.includes('smoke-fork-test'))) {
		pass('fork created new scenario in dropdown');
	} else {
		fail(`fork did not produce new scenario (saw: ${scenarioOptions.join(', ')})`);
	}
} else {
	fail('Fork button not found in controls');
}

// ---------- Section: compare mode ----------
// Navigate with c= to enable compare mode against the increased-certainty scenario.
await page.goto(`${BASE_URL}/main/default/#c=increased-certainty`, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
const diagrams = await page.locator('adjacency-map-diagram').count();
if (diagrams === 2) pass('compare mode renders two diagrams');
else fail(`compare mode rendered ${diagrams} diagrams (expected 2)`);

const compareStrip = await page.locator('.compare-strip').count();
if (compareStrip > 0) pass('compare diff strip rendered');
else fail('compare diff strip missing');

const diffChanged = await page.locator('svg.main circle.diff-changed, svg.main circle.diff-added, svg.main circle.diff-removed').count();
if (diffChanged > 0) pass(`${diffChanged} nodes flagged with diff class`);
else log('no diff classes — could be valid if scenarios are identical');

await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06-compare-mode.png') });

// ---------- Section: inspect CLI ----------
// (Run separately, not via browser. Spawn it sync.)
{
	const r = spawnSync('npm', ['run', 'inspect', '--', 'default', 'increased-certainty'], { encoding: 'utf8' });
	if (r.status === 0 && r.stdout.includes('Root aggregate values')) pass('inspect CLI produces expected output');
	else fail(`inspect CLI failed (status=${r.status}, stdout=${r.stdout.slice(0, 200)})`);
}
```

(`spawnSync` is already imported at the top of smoke-test.mjs.)

- [ ] **Step 2: Run the smoke test**

Run: `npm run test:smoke`
Expected: all checks pass including the new metrics, fork, compare-mode, and inspect-CLI sections.

If failures: debug, fix, re-run. Do NOT commit failing tests.

- [ ] **Step 3: Commit**

```bash
git add tools/smoke-test.mjs
git commit -m "Extend smoke test with metrics, fork, compare-mode, inspect coverage"
```

### Task 13: Final test:all pass

- [ ] **Step 1: Full pipeline**

Run: `npm run test:all`
Expected:
- `test:base` — all unit tests pass
- `validate` — all data files validate
- `test:smoke` — all browser checks pass

- [ ] **Step 2: If any cleanup commits**

If smoke testing surfaced minor fixes, commit them clearly:

```bash
git add <files>
git commit -m "Smoke-test fixes for tranche 2"
```

---

## Self-review notes

- All four workstreams (K, I, J, H) from the spec are covered by tasks 1-11.
- Smoke test (Task 12) covers each workstream's user-visible behavior.
- Final integration (Task 13) is the gate.
- Build order matches the spec: K (Task 1) → I (Tasks 2-4) → J (Tasks 5-6) → H (Tasks 7-11) → smoke (Tasks 12-13).
- Open spec questions are handled inline: headline metrics default to non-zero properties capped at 6; fork uses `window.prompt`; compare-mode lets layouts vary independently (no shared positions).
- No placeholders; each step has either real code or a specific verification command.
