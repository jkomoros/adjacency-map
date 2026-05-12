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
- Files ending in `.edits.json` are user-saved scenario overrides written by the webapp's "Save to file" button. Don't edit these by hand unless you're explicitly "promoting" user edits into the canonical TS file (in which case: copy the entries into the TS file's `scenarios` block, then delete the corresponding entries from the JSON).

## The shape of a data file

The canonical schema lives in `src/types.ts` (look for `RawMapDefinition`, `RawScenario`). A minimal example:

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

The `type` must be a property defined in the imported library (the `product` library defines `engineering`, `ux`, `data`, etc. — check `src/libraries.ts`).

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

The omitted node disappears from the rendered graph in this scenario. Edges from other nodes that referenced it as `parent` are silently dropped. Children with no other parent become orphans. The data is preserved — toggling `removed: false` (or removing the override entirely) restores everything.

### Array-valued scenarios

A scenario can be an ARRAY of scenarios, which the runtime expands to `name_0`, `name_1`, ... — each automatically extending the previous one. Useful for modeling a progression:

```ts
scenarios: {
	'rollout': [
		{ nodes: { phase_1: { values: { implemented: 1.0 } } } },
		{ nodes: { phase_2: { values: { implemented: 1.0 } } } }
	]
}
```

### Events

Sometimes a roadmap or strategy hinges on something that isn't a node — "did the demo happen?", "did the deadline pass?", "did the regulator approve?". These are event-shaped semantics with no natural place in the node graph. The map has a top-level `events` field for exactly that.

Define an event:

```ts
events: {
	q3_window_open: {
		description: 'Q3 ship window is still open.',
		defaultPresent: true   // optional; defaults to true
	}
}
```

Reference it from a value definition via the `{event: ...}` form of `nodeRef`:

```ts
nodes: {
	voice_full_duplex: {
		description: 'Conversational voice.',
		values: {
			// 3 + 6 if the window is still open. When the event flips to
			// absent, voice_full_duplex.selfValue drops 9 -> 3.
			selfValue: {
				operator: '+',
				a: 3,
				b: {
					operator: '*',
					a: { event: 'q3_window_open' },
					b: 6
				}
			}
		}
	}
}
```

Flip an event in a scenario via `events.<id>.present`:

```ts
scenarios: {
	'duplex-q4-missed': {
		description: 'Q3 window closed before we shipped.',
		events: { q3_window_open: { present: false } },
		nodes: {}
	}
}
```

Effective presence in a scenario = scenario override's `present` (if set), else event's `defaultPresent`, else `true`. `{event: ...}` returns 1 if present, 0 otherwise. Events have no other properties — the only thing you can ask is whether they're present.

When to reach for events vs. nodes:

- **Use a node** if the thing carries engineering cost, has a parent/child relationship, or is something you'd visualize in the diagram.
- **Use an event** if it's a "did this happen yet?" flag with no work attached — a deadline, a partnership signing, a regulatory clearance, a competitor's announcement.

Encoding events as sentinel nodes (an earlier prototype) made them appear in the rendered diagram as fake-looking capabilities. The dedicated `events` field keeps them out of the node namespace.

### Decision notes on scenarios

A scenario can carry two optional free-form strings explaining *why* the user kept or rejected it:

```ts
scenarios: {
	'aggressive-roadmap': {
		description: 'Push everything by Q3',
		decision: 'Rejected: timeline too tight for legal review.',
		reasoning: 'Legal needs 4 weeks for compliance review on the partnerships changes.',
		nodes: { ... }
	}
}
```

When you generate scenario proposals for the user, populate `decision` and `reasoning` with your own rationale — the user can edit them in the UI or accept them as-is.

## Workflow checklist

Before claiming a change is done:

1. **Edit the file.**
2. **Run `npm run validate`.** If it fails, read the error, fix, re-run.
3. **Run `npm run inspect -- <file> <scenario>`** to see the numerical effect of your change (aggregate totals, top nodes by value, diff from base). If the numbers don't match what the user asked for, fix and re-run.
4. **Don't touch `src/data.GENERATED.ts`** — it's auto-generated.
5. **If a scenario name has spaces or special characters,** quote it: `'my scenario': {...}`.

If the dev server is running (`npm run serve`), the watcher regenerates the manifest on save and the browser reloads automatically.

## Gotchas

- **Edge `type` must match a defined property.** If you invent a new property name, define it in the data file's `properties` block too, or use one from the imported library.
- **Parent references must resolve.** An edge with `parent: 'foo'` where `foo` doesn't exist will fail validation — unless `foo` is omitted via `removed: true`, in which case the edge is silently dropped.
- **Scenario names** are arbitrary strings. The default scenario is the empty string `''` (the unedited base data).

## Save-back (user-side)

The webapp has a "Save to file" button (visible only on Chromium browsers — Chrome, Edge, Brave, Arc). When the user clicks it, the webapp uses the File System Access API to write their inline-edited scenarios to `data/<name>.edits.json`. That file is then merged into the live data at runtime (sidecar JSON takes precedence over the base TS file's scenarios). You can read the JSON to see what edits the user has saved; if they ask you to "make these edits canonical", copy the scenarios from the JSON into the corresponding `data/<name>.ts` file's `scenarios:` block, then delete the entries from the JSON.

## Private maps

The user may keep confidential planning data in `data/private/` — a separately-cloned **private** git repo nested inside the gitignored path. The loader picks these up automatically when present; they appear in the webapp dropdown as `private__<name>` (double-underscore is the namespace separator). If you see `data/private/` files, treat them as confidential: don't paste their contents into commits or PRs that target the public repo. The directory itself is gitignored — `git add` from the public repo will refuse to track its contents unless `-f` is used.

See `docs/superpowers/notes/2026-05-12-private-maps-workflow.md` for the full workflow.

## Webapp-state sidecar

While `npm run serve` is running, the webapp publishes its current view to `/tmp/adjacency-state.json`. Shape:

```json
{
  "filename": "default",
  "scenarioName": "increased-certainty",
  "compareScenarioName": null,
  "selectedLayoutID": "node:base_pipeline",
  "hoveredLayoutID": null,
  "updatedAt": "2026-05-12T17:00:00Z"
}
```

If this file exists and is recent, the user has the webapp open. Read it before asking what they're looking at — you'll often be able to start a useful conversation without making them describe their state. If the file is stale (`updatedAt` more than a few minutes old) or absent, the user is either not in the webapp or hasn't loaded a file yet.

## Pointers

- Canonical schema: `src/types.ts`
- Libraries that define property types: `src/libraries.ts`
- Validator: `tools/validate-data.ts` (run via `npm run validate`)
- Generator: `tools/config.ts` (run via `npm run generate:config`)
- Watcher: `tools/watch-data.ts` (started by `npm run serve`)
- Inspect a scenario: `npm run inspect -- <file> [scenario]`
- Diff two scenarios: `npm run diff -- <file> <a> <b>`
- Rank scenarios by a property: `npm run rank -- <file> <property> [--ascending]`
- Current webapp view: `/tmp/adjacency-state.json` (when `npm run serve` is running)
