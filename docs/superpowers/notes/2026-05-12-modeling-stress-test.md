# Modeling stress-test: Polyglot roadmap

Encoded the "Polyglot" multimodal-AI roadmap (14 capability nodes, 7 strategic scenarios) into `data/polyglot.ts`. This file is an honest ledger of what encoded cleanly, what required workarounds, and what could not be expressed at all. Verified with `npm run validate` and `npm run inspect`.

## What worked

These mapped to the schema without contortions:

- **Basic node definitions.** One `RawNodeDefinition` per capability; description + tags + a values block.
- **Per-node value/certainty.** `values.selfValue` and `values.certainty` overrides are picked up directly. The library's calculated cascade is overridden cleanly without fighting the engine.
- **Single-parent dependency edges.** `{ type: 'engineering', parent: 'foo', cost: N }` is exactly what the roadmap arrows look like.
- **Self-rooted "intrinsic" cost.** An edge with no `parent` is implicitly rooted at ROOT — perfect for "this node costs N person-weeks of engineering on its own".
- **Tags as orthogonal classifiers.** Voice / image / agents / infra / research / partner / legal all attached cleanly. (Caveat below in the brittleness section about the `value` tag-constant requirement.)
- **Scenarios as overlays.** `removed: true` to drop nodes, `values: {...}` to override numerics, `edges.modify` to bump a cost — all worked. The base graph is untouched and toggling scenarios is reversible.
- **`extends` chaining.** Used by `multimodal-core-after-moats` to extend `multimodal-core` cleanly.
- **`decision` and `reasoning` per scenario.** Populated for all 7 strategic scenarios + the workaround scenarios. Felt natural.
- **`headlineMetrics`.** `display.headlineMetrics: ['engineering', 'value', 'expectedValue', 'certainty']` surfaces the four numbers a planner actually wants.

## What I worked around

### 1. OR-of-parents (`voice_full_duplex` needs `voice_out_tts` AND (`voice_in_whisperx` OR `voice_in_inhouse`))

**Original requirement.** A node should be eligible to ship when at least one of two alternative parents is present.

**What I did.** Inserted a synthetic OR-gate node `voice_in_any` whose only job is to claim both ASR nodes as parents. Cost 0, certainty pinned to 1.0 so it doesn't drag down children. `voice_full_duplex` then depends on `voice_in_any` + `voice_out_tts`.

```ts
voice_in_any: {
    description: 'Synthetic OR-gate: voice-input is available iff at least one ASR ships.',
    tags: ['voice'],
    edges: [
        { type: 'engineering', parent: 'voice_in_whisperx', cost: 0 },
        { type: 'engineering', parent: 'voice_in_inhouse', cost: 0 }
    ],
    values: { selfValue: 0, certainty: 1.0 }
},
voice_full_duplex: {
    edges: [
        { type: 'engineering', parent: 'voice_out_tts', cost: 6 },
        { type: 'engineering', parent: 'voice_in_any',  cost: 0 }
    ],
    values: { selfValue: 9, certainty: 0.5 }
}
```

**Downside.** The OR-gate node:
- Appears as a real node in the rendered graph, adding visual noise.
- Aggregates into root totals (`voice_in_any.value = 8.5` in base — pure artifact).
- Behaves like an AND-gate at calculation time: it still computes `parentValue` as the mean of both real ASR nodes. The "OR" semantics only emerge under `removed:true` propagation (silent edge-drop keeps the gate alive as long as one ASR survives).
- A scenario that removes BOTH ASRs leaves the gate orphaned but still in the graph; I have to remember to also `remove: true` the gate (which `agentic-first` and `research-moonshot` both do).

### 2. Mutual exclusion (team can't maintain both ASRs in one scenario)

**Original requirement.** voice_in_whisperx and voice_in_inhouse are mutually exclusive — at most one ships per scenario.

**What I did.** Enforced by convention in each scenario: every scenario that keeps one ASR explicitly `removed: true`s the other. No schema-level constraint.

```ts
'defensive-moats': {
    nodes: {
        voice_in_whisperx: { removed: true },
        voice_in_inhouse: { /* cost rises to 12 */ }
    }
},
'research-moonshot': {
    nodes: {
        voice_in_whisperx: { removed: true },
        // voice_in_inhouse survives
    }
}
```

**Downside.** Nothing prevents a future scenario author from accidentally keeping both. A linter for "exclusion groups" would catch this; the schema today does not. The constraint is invisible to the validator.

### 3. Combinatorial value uplift (`latency_cache` value rises 7->9 if `voice_full_duplex` ships)

**Original requirement.** `latency_cache.value` depends on whether `voice_full_duplex` is in the same scenario.

**What I did.** Materialized the boost as a *separate scenario* (`latency-cache-boosted`) that simply sets `latency_cache.selfValue = 9`.

```ts
'latency-cache-boosted': {
    description: 'Workaround: latency_cache selfValue rises 7->9 when voice_full_duplex ships.',
    nodes: { latency_cache: { values: { selfValue: 9 } } }
}
```

**Downside.** The conditional is now a *manual comparator*, not an automatic recalculation. If the planner forks `multimodal-core` (which keeps full duplex), they have to remember to also fork `latency-cache-boosted` and merge them. The "if X then Y" semantics live in the planner's head, not in the data.

### 4. Soft preference bonus (`voice_full_duplex` +1 value if `image_understanding` shipped first)

**Original requirement.** Sequencing-aware uplift: voice_full_duplex is worth more *after* image_understanding has shipped.

**What I did.** Same pattern as above — extra scenario `duplex-with-image-uplift` that sets `voice_full_duplex.selfValue = 10`.

**Downside.** Loses the *if-then* shape entirely. The schema has no temporal or sequencing concept; "shipped first" collapses to "we manually picked a scenario where it's true".

### 5. Time-decay (`voice_full_duplex` worth 9 in Q3, 3 in Q4)

**Original requirement.** Value of a node decays over calendar time as competitors close.

**What I did.** Extra scenario `duplex-q4-decay` with `voice_full_duplex.selfValue = 3`.

**Downside.** Time is not a first-class axis. To model a quarterly roadmap with multiple decay clocks, I'd need one scenario per quarter per decaying node, exploding combinatorially.

### 6. Uncertainty as a branch outcome (`agent_framework_v1` ships at 60% value, 1.5x cost)

**Original requirement.** Certainty 0.4 means there's a real 60%-value-and-50%-cost-overrun outcome to plan around — not just a multiplier on expected value.

**What I did.** Extra scenario `agent-framework-disappoints` that materializes the downside:

```ts
'agent-framework-disappoints': {
    nodes: {
        agent_framework_v1: {
            values: { selfValue: 5.4 },          // 9 * 0.6
            edges: {
                modify: {
                    'engineering+': { type: 'engineering', cost: 12 }   // 8 * 1.5
                }
            }
        }
    }
}
```

**Downside.** Certainty is encoded twice now — once as the scalar `certainty: 0.4` (feeds expectedValue), and once as the explicit downside scenario. Risk of drift. There's no schema construct for "this node has a branch distribution".

### 7. Scenario carry-over ("if defensive-moats shipped voice_in_inhouse, switching to multimodal-core saves 2 weeks")

**Original requirement.** Path-dependent cost reduction when transitioning between strategies.

**What I did.** A scenario `multimodal-core-after-moats` that `extends: 'multimodal-core'` and shaves 2pw off the voice_full_duplex integration edge.

```ts
'multimodal-core-after-moats': {
    extends: 'multimodal-core',
    nodes: {
        voice_full_duplex: {
            edges: {
                modify: {
                    'engineering+voice_out_tts': {
                        type: 'engineering',
                        parent: 'voice_out_tts',
                        cost: 4   // was 6
                    }
                }
            }
        }
    }
}
```

**Downside.** Path-dependency is N×N — one transition scenario per (from, to) pair. Doesn't scale beyond a handful of strategies. The schema has no notion of "previous state" beyond single-step `extends`.

### 8. Self-rooted cost as a defensive pattern

**Original requirement.** voice_in_inhouse costs 9pw regardless of whether eval_harness ships.

**What I did.** Two engineering edges on voice_in_inhouse: a self-rooted one carrying the cost, plus a zero-cost dep edge to eval_harness.

```ts
voice_in_inhouse: {
    edges: [
        { type: 'engineering', cost: 9 },                          // intrinsic
        { type: 'engineering', parent: 'eval_harness', cost: 0 }   // dep
    ],
    // ...
}
```

**Downside.** This is a workaround for a real footgun (see brightness item below). It also means the modify-edge match ID is `'engineering+'` (anonymous parent), which is ugly and easy to typo. Multi-edge engineering also forces a mean-based aggregation that smears costs (see brittleness item below).

## What I couldn't express at all

These have no workaround that preserves the original semantics:

### Resource pool / budget constraint

**What I wanted.** "We have 12 engineers; voice_in_inhouse (4) + agent_framework_v1 (5) + code_interpreter (3) = exactly 12."

**Why not possible.** The schema has no notion of a global budget or capacity. Engineering cost is a *per-node* property that aggregates upward into root totals — but there is no place to put "max 12 engineers across the active subgraph". I could compute `engineering` post-hoc and the planner could eyeball it, but the model can't tell me "this scenario exceeds budget" or "these three nodes saturate the team".

Note also that the roadmap distinguishes two senses of "engineering": person-weeks (the `cost` column) and engineer-headcount (the resource pool). The schema only models one — and aggregates them via `mean` not `sum` at that, which would be wrong for either interpretation taken as a budget check.

### True conditional values

**What I wanted.** "value of latency_cache is 7 normally, 9 if voice_full_duplex is in the scenario, all expressed once in the base graph."

**Why not possible.** `values.selfValue` accepts a `ValueDefinition`, which supports arithmetic and even `if`/`compare`. But there's no `ValueDefinition` primitive for "is this other node in the rendered graph?". `hasTag` checks tags on the result node, not on the global set. `ValueDefinitionResultValue` reads other property values on *this* node. Nothing reads "is node X present in this scenario".

If such a primitive existed, the conditional could collapse from a workaround scenario into one expression in the base graph. Without it, every cross-node conditional becomes a manual scenario fork.

### Disjunctive prerequisites natively

**What I wanted.** `voice_full_duplex.requires = TTS AND (WhisperX OR InHouse)`, expressed as one constraint.

**Why not possible.** Edges are conjunctive by nature: multiple edges all contribute. The workaround OR-gate (above) approximates the runtime behavior under `removed:true` but does not express *intent*. If you read the data file cold, `voice_in_any` looks like a real capability, not a constraint.

### Exclusion groups

**What I wanted.** A declaration like `exclusionGroups: [['voice_in_whisperx', 'voice_in_inhouse']]` that the validator enforces.

**Why not possible.** No such construct exists. Mutual exclusion is purely a per-scenario convention.

### Sequencing / time

**What I wanted.** "voice_full_duplex worth 9 if shipped Q3, 3 if shipped Q4."

**Why not possible.** No time axis. Workaround is one scenario per quarter, which doesn't scale and doesn't compose with strategy scenarios.

### Probabilistic outcomes

**What I wanted.** "agent_framework_v1 has 40% certainty, meaning a 60% chance of the disappointing branch and a 40% chance of full value."

**Why not possible.** `certainty` is a scalar that multiplies into `expectedValue`. There's no construct for branching outcomes within a scenario — the downside branch has to be modeled as its own scenario.

## Where the model felt brittle

Sharp edges I hit while encoding:

### 1. `selfValue` requires every tag to define a `value` constant — even when overridden

The product library's `selfValue` is calculated as `combine: 'sum', value: {tagConstant: 'value', which: 'self'}`. The validator walks the value definition and rejects the data if any defined tag is missing the `value` constant — **even if every node overrides `selfValue` explicitly**. I got `Error: selfValue does not have a legal value definition: Error: Invalid tagConstant: value`.

Fix: add `constants: { value: 0 }` to every tag. Not obvious. Easy to forget.

### 2. Silent edge-drop when parent is removed zeroes out node-intrinsic cost

If `voice_in_inhouse`'s only engineering edge is `{parent: 'eval_harness', cost: 9}`, and a scenario removes `eval_harness`, the edge is silently dropped and `voice_in_inhouse.engineering` falls to 0. The node still costs 9 person-weeks intrinsically; the data no longer reflects that.

Fix: split into a self-rooted edge that carries the cost plus zero-cost dep edges. Brittle: requires every node author to defensively self-root, OR every scenario author to never break the cost chain.

### 3. Stale `.GENERATED.js` blocks new data files from loading

The TS file `src/data.GENERATED.ts` is regenerated correctly, but a stale compiled `src/data.GENERATED.js` shadows it under the ts-node ESM loader. `npm run inspect` reported "Unknown file: polyglot" despite the .ts file listing polyglot, until I deleted `src/data.GENERATED.js` by hand. The `inspect` and `validate` scripts both call `generate:config` first, but `generate:config` only writes the .ts — it does not delete the stale .js. A `build:clean:generated` script exists but isn't run as part of `validate` / `inspect`.

### 4. `engineering` combines edges by `mean`, not `sum`

If I want a node's cost to be "the sum of all engineering work feeding it", I cannot use the library's `engineering` property. With two edges (one self-rooted cost 9, one zero-cost dep), the node's `engineering` becomes `mean(9, 5) = 7`, not `9`. This actively distorts the "total person-weeks" reading of root engineering. I left it as-is because all scenarios are compared on the same basis, but for any planner reading absolute numbers, this is a footgun.

### 5. `modify` edge match-IDs are positional-by-parent, but anonymous parents collide

The match ID for an edge with no parent is `'engineering+'` (empty after the `+`). If a node has two engineering edges and one is self-rooted, modifying "the self-rooted one" works fine. But two self-rooted engineering edges would share the ID `'engineering+'` — they'd be indistinguishable to `modify`. The schema implicitly assumes (type, parent) is a unique key on the edge set.

### 6. `removed: true` cascade is not transitive in the expected way

I expected: remove a parent, and children that lose all their parents drop too. Actual: orphan children remain in the graph, just disconnected. For the OR-gate workaround this is required behavior — but it also means a scenario that removes a parent silently leaves zombie children unless the author remembers to remove them too.

### 7. `extends` accepts only a single scenario name

For path-dependency, I'd want to extend from a *set* of preconditions ("after defensive-moats AND multimodal-core merged"). Only single inheritance is supported, so multi-condition transitions require flattening.

### 8. No way to express "this node has zero intrinsic value, value flows entirely through its children"

`partner_bfl_deal` and `data_licensing` have value 0 alone. I set `selfValue: 0`, but `parentValue` aggregation still pulls in nonzero downstream contributions to the root totals through the standard chain. It happens to work out because the contribution flows the right direction (root sums up children, not vice versa) — but if I wanted "value=0 also means it doesn't add to root aggregate", I'd have to remove the node from the value aggregation, which there's no knob for.

---

**Bottom line.** The schema is excellent for "tree of dependencies with per-node scalar attributes that aggregate via configurable combiners". It works around DAG-shaped overlays via scenarios + `removed`/`modify`. It struggles with: disjunction in prerequisites, global constraints (budgets/exclusion groups), cross-node conditional values, and any form of time or branching probability. Every roadmap semantic that's "if X then Y over there" has to be flattened into a separate scenario, which trades expressiveness for combinatorial scenario count.
