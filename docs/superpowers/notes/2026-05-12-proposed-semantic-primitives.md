# Proposed new semantic primitives for adjacency-map

Synthesis of the modeling stress-test (`2026-05-12-modeling-stress-test.md`) plus the three faux roadmaps from the design-agent pass. Goal: identify the **smallest set of new primitives** that closes the most expressivity gaps.

## The gaps, clustered

Eleven distinct workaround patterns surfaced. They fall into four families:

### Family A — Edge shapes (3 gaps)

| Gap | Where it appeared | Today's workaround |
|---|---|---|
| **Disjunctive prerequisites** | "voice_full_duplex needs TTS AND (WhisperX OR InHouse)", "pilot_customer_y needs FDA 510(k) OR CDS exemption" | Synthetic OR-gate node with zero cost |
| **Soft / enabler edges** | "voice_full_duplex is *better* if image_understanding shipped", "gripper_v2 enables but doesn't require deformable perception" | Separate uplift scenario |
| **Mutual exclusion / conflict** | "voice_in_whisperx and voice_in_inhouse can't both ship" | Per-scenario convention; validator unaware |

### Family B — Cross-node conditional values (4 gaps that collapse to one primitive)

| Gap | Where it appeared |
|---|---|
| **Combinatorial value uplift** | "latency_cache value 7→9 if voice_full_duplex ships" |
| **Sequencing-aware bonus** | "voice_full_duplex +1 if image_understanding shipped first" |
| **Time-decay value** | "voice_full_duplex 9 in Q3, 3 in Q4" |
| **Probabilistic-branch outcomes** | "agent_framework_v1 has 40% chance of shipping at 60% value, 1.5x cost" |

All four currently degrade to "fork a separate scenario." All four could be expressed in the base graph with one primitive: **`{nodePresent: 'foo'}` in `ValueDefinition`** that returns 1 if node `foo` is in the rendered scenario, else 0. Combined with the existing arithmetic + `if` primitives, it captures conditional value, sequencing-aware uplift, and time decay (via a "shipped_in_quarter_3" tag-or-node convention). Probabilistic branching is adjacent but probably wants its own primitive.

### Family C — Global constraints (2 gaps)

| Gap | Where it appeared |
|---|---|
| **Resource pools** | "12 engineers total; can't run voice_in_inhouse + agent_framework_v1 + code_interpreter concurrently" |
| **Inter-team handoffs** | "ML→ops handoff adds 4 weeks regardless of effort" |

Both are *budget-like*: a finite pool gets consumed, scenarios get flagged as over-capacity. Today there's no way to express it. The cost field aggregates upward but there's no place to put "<= 12" at the root.

### Family D — Structural shape (2 gaps)

| Gap | Where it appeared |
|---|---|
| **Compound milestones** | "FDA 510(k) is 7 sub-milestones with sequential deps", "agent_framework_v1 is 4 sub-decisions" |
| **Multi-parent extends** | "transition state: after defensive-moats AND multimodal-core" |

Less common. Compound milestones are mostly a *display* concern (the data can already express the sub-graph; we just want to visually collapse it). Multi-parent extends is a real shape change.

### Family E — Tooling brittleness (NOT new semantics, but should be fixed)

| Issue | Fix |
|---|---|
| Stale `src/data.GENERATED.js` shadows the regenerated `.ts` | `generate:config` should delete stale `.js`/`.d.ts`/`.map` siblings |
| `selfValue` validator chokes on missing `tagConstant: 'value'` even when overridden everywhere | Lazy-check tag constants only for nodes that don't override `selfValue` |
| Silent edge-drop zeroes intrinsic cost | Introduce `intrinsicCost` or make self-rooted edges survive parent removal |
| `engineering` library property combines via `mean`, not `sum` | New `engineeringTotal` library property using `sum` |
| `modify` edge-match collides for multiple self-rooted edges | Optionally include an `edgeID` field for disambiguation |

These are bugs, not missing semantics. List them separately so they don't get conflated with the design work.

## Proposed new primitives

Five primitives close ~90% of the gaps. Listed in priority order.

### 1. `nodePresent` value-definition primitive

**Shape:**

```ts
{ nodePresent: 'voice_full_duplex' }  // 1 if node is in current scenario, else 0
```

Returns a number (1 or 0) usable in any arithmetic context. Combined with the existing `if`, `*`, `+`, `compare` operators, captures:

```ts
// latency_cache value rises from 7 to 9 if voice_full_duplex ships
selfValue: {
  operator: '+',
  a: 7,
  b: { operator: '*', a: { nodePresent: 'voice_full_duplex' }, b: 2 }
}
```

```ts
// Time-decay: value drops if a "deadline_q3_missed" node is in the scenario
selfValue: {
  if: { nodePresent: 'deadline_q3_missed' },
  then: 3,
  else: 9
}
```

**Subsumes:** combinatorial value uplift, sequencing bonus, time-decay (via a deadline-node convention).

**Effort:** small. New variant in the `ValueDefinition` union; calculation engine checks the scenario's effective node set.

### 2. Typed edges: `kind: 'or' | 'enables' | 'excludes'`

Default edge `kind: 'requires'` (the current implicit behavior). Three new kinds:

```ts
edges: [
  // Existing: AND-style requirement
  { type: 'engineering', kind: 'requires', parent: 'voice_out_tts' },

  // NEW: OR-style — one or more siblings with same group satisfies
  { type: 'engineering', kind: 'or', parent: 'voice_in_whisperx', group: 'asr' },
  { type: 'engineering', kind: 'or', parent: 'voice_in_inhouse',  group: 'asr' },

  // NEW: ENABLES — informational, applies a multiplier when present
  { type: 'engineering', kind: 'enables', parent: 'image_understanding', valueMultiplier: 1.1 },

  // NEW: EXCLUDES — declarative mutual exclusion; validator enforces
  { type: 'engineering', kind: 'excludes', parent: 'voice_in_inhouse' }  // declared once on either node
]
```

**Subsumes:** disjunctive prerequisites, soft enabler, mutual exclusion.

**Effort:** medium. Need a graph-construction pass that:
1. Groups `or`-edges by `group` field; node is valid if ≥1 group member is present.
2. `enables` doesn't gate inclusion; applies a documented multiplier (or is ignored if the planner just wants to display it).
3. `excludes` causes validation to fail if both endpoints are in the same scenario.

Visual: OR-edges as dashed lines, ENABLES as dotted, EXCLUDES as red. Compare-mode and selection-highlight already have a class system that this slots into.

### 3. Resource pools

```ts
// Top-level on RawMapDefinition
resources: {
  engineers: 12,
  clinical_research_team: 4
},

// Per-node, declared alongside cost
nodes: {
  voice_in_inhouse: {
    resourceConsumption: { engineers: 4 },
    // ...
  },
  agent_framework_v1: {
    resourceConsumption: { engineers: 5 },
    // ...
  }
}
```

The map computes per-scenario consumption per resource. Surfaces as:
- A "resource utilization" row in the headline metrics strip.
- A scenario-level warning when any pool is over-saturated.
- The validator + smoke-test can assert "no scenario over-allocates".

**Subsumes:** resource pools (Family C). Inter-team handoffs are a related but different problem — defer.

**Effort:** medium. New top-level field, new selector + UI strip, validator check.

### 4. Range-valued / probabilistic cost

```ts
// On an edge or node value
{ type: 'engineering', parent: 'foo', cost: { min: 8, expected: 18, max: 30 } }
```

When a scalar is provided, it's the expected value (backward compatible). When a range object is provided, `inspect` / `rank` / metrics show all three; `expectedValue` calculations use `expected`; a new headline "cost p90" is available.

**Subsumes:** range-valued cost, partial probabilistic-outcome modeling.

**Effort:** small to medium. `RawEdgeInput` and `RawNodeValues` accept the new shape; calculation engine reads `.expected` when present.

### 5. Branch outcomes on a node

```ts
nodes: {
  agent_framework_v1: {
    branches: {
      success:      { probability: 0.4 },                          // default values
      disappointing:{ probability: 0.6, valueMul: 0.6, costMul: 1.5 }
    }
  }
}
```

Inspect/rank/metrics can present "expected value across branches" and "value at p90 downside". The UI gets a small badge on the node indicating "branch distribution: 40% / 60%". Compare mode can show "if optimistic / if pessimistic" side-by-side.

**Subsumes:** probabilistic-branch outcomes (Family B's 4th item).

**Effort:** medium. New per-node field; computation pass produces multiple result sets keyed by branch combination (capped or sampled if combinatorial).

## Priority order if we shipped a tranche

| # | Primitive | Effort | Closes |
|---|---|---|---|
| 1 | `nodePresent` | small | 4 of the 11 gaps |
| 2 | Typed edges (or/enables/excludes) | medium | 3 of the 11 gaps |
| 3 | Resource pools | medium | 1 of the 11 gaps (but critical for portfolio planning) |
| 4 | Range-valued cost | small | 1 gap + partially closes a 2nd |
| 5 | Branch outcomes | medium | 1 of the 11 gaps |

Items 1 + 2 alone close 7 of the 11 patterns and are the highest leverage.

## What we deliberately don't fix

- **Compound milestones with collapse-on-display** — the data already expresses the sub-graph; only the UI is missing. Defer until we have a real map where this hurts.
- **Multi-parent `extends`** — rare; the workaround is a flat "transition" scenario.
- **Inter-team handoff latency** — needs a time model we don't have yet. The scheduling problem is broader than this tool's purpose.
- **Path-dependent cost savings across scenarios** — N×N combinatorial; structurally outside the "static map per scenario" model.
- **Customer-specific node scopes** — overlapping with scenarios. The current "scenarios as overlays" model already handles this; we just need clearer agent guidance on which is which.

## Action proposal

If we want to keep building, the cleanest next tranche is **`nodePresent` + typed edges**. Those two together close most of what stressed the modeling agent and are independently useful. Resource pools as a fast-follow. Branch outcomes and range-valued cost are nice but lower priority — they help inspection more than they fix expressivity.

The brittleness fixes (Family E) should land regardless; they're bugs, not design questions.
