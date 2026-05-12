# Elegance critique: the five proposed semantic primitives

Critique of `2026-05-12-proposed-semantic-primitives.md`, weighed against the
roadmap stress-tests and the existing `ValueDefinition` / edge / scenario
algebra in `src/types.ts` and `src/libraries.ts`.

## Summary

The proposal is half-right. `nodePresent` is exactly the missing primitive —
but it is undersold and slightly misshapen, and three of the other four
"primitives" are not primitives at all: they are either special cases of
`nodePresent`, display concerns dressed up as schema, or parallel sub-languages
that would split the data model. The right cut is **two primitives plus one
honest data-shape change**, not five.

## Where the proposal is strong

- The clustering of 11 gaps into families is the load-bearing intellectual
  work. It correctly notices that combinatorial uplift / sequencing bonus /
  time decay are the same shape ("read another node's state from a value
  definition"). That observation is the seed of an elegant design.
- Calling out the brittleness items (`engineering` mean-vs-sum, stale
  `.GENERATED.js`, `selfValue` tag-constant validation) as bugs, not design,
  is correct and keeps the design conversation clean.
- The instinct to lean on the existing `ValueDefinition` algebra rather than
  invent new node-level fields is right. The proposal honors this for #1
  (`nodePresent`) and abandons it for #3 and #5.

## Where it is not elegant

### 1. `nodePresent` is the right primitive but is shaped wrong

The proposal types `nodePresent` as returning 0/1. That is a strict
specialization of a more general operation: **"read a property off another
node, given that node's id."** The existing algebra already has
`ValueDefinitionParentValue` (read parent), `ValueDefinitionRootValue` (read
root), and `ValueDefinitionResultValue` (read self) — these are all
node-targeted property reads. There is no primitive for "read named node N's
property P", because edges supply the indirection.

Once a value definition can *name* another node, you get:

```ts
// proposed
{ node: 'voice_full_duplex', property: 'present' }   // 0 or 1
{ node: 'voice_full_duplex', property: 'selfValue' } // 9 or 0 if absent
{ node: 'image_understanding', property: 'value' }   // current rolled-up value
```

`nodePresent` is the `property: 'present'` case. But the same primitive
handles:

- "latency_cache.value = 7 + 2 * (1 if duplex present)" — the proposal's
  example.
- "voice_full_duplex.value = base + 0.1 * image_understanding.value" — a
  *graded* uplift, not a binary one. The proposal's binary `nodePresent`
  cannot express this without bolting on more.
- "agent_framework_v1 cost = 1.5x if agent_framework_v1.branch == 'down'" —
  see the branch-outcome critique below.

The pseudonym in the proposal — `{ nodePresent: 'X' }` — wastes a slot in
the value-definition union. A `{ node: id, property: name }` shape is one
more character and dramatically more reach. Make `'present'` a synthetic
property that is 1 when the node is in the scenario and 0 otherwise, the same
way `incrementalCertainty` is a synthetic property today.

### 2. "Typed edges" is three primitives in a trench coat

`kind: 'or' | 'enables' | 'excludes'` looks like one knob. It is not. Each
value flips the graph engine into a different mode:

- `or` introduces a `group` field and a "satisfied if ≥1 group member
  present" rule. This is a **graph-validity** rule.
- `enables` carries `valueMultiplier` and "doesn't gate inclusion". This is
  a **value-calculation** rule and overlaps directly with `nodePresent`. An
  "enables" edge with a 1.1 multiplier *is* exactly
  `value = base * (1 + 0.1 * nodePresent('X'))`. Two primitives for one job.
- `excludes` is a **validator** rule. It does not affect calculation at all.

These three concepts do not share machinery; they share a syntactic slot.
Bundling them as one primitive is the same elegance mistake the proposal
calls out in Family E. Worse: `enables` is *already covered* by
`nodePresent`. Shipping both means there are two ways to express "duplex
gets +1 if image_understanding ships" — and they will drift.

The honest decomposition:

- **`or` belongs as a property of the edge group**, not a per-edge kind.
  A node-level `requires: { all: [...], any: [[...]] }` clause is more
  declarative and matches how a reader thinks: "needs X and Y and (A or B)".
  Edges themselves stay typed by `type`, not by AND/OR semantics.
- **`enables` should be dropped**. Once `nodePresent` exists, soft uplifts
  belong in `values.selfValue`, where they compose with `if`, `*`, and
  `compare`. An "enables" edge that doesn't gate inclusion is a comment,
  not data.
- **`excludes`** is a different beast entirely — a constraint, not an
  edge — and the proposal admits as much by saying "validator enforces."
  It belongs in a `constraints: [{exclusive: [a, b]}]` block (see #5).

### 3. Resource pools are a second value tree, not a new top-level system

The proposal introduces `resources`, `resourceConsumption`, a new UI strip,
and a new validator pass. That is a parallel sub-language for what is
structurally the same thing the engine already does perfectly: **sum a
numeric property across the active node set and compare to a root value.**

The existing model:
- Every node contributes to per-property aggregates that roll up to the root.
- The root holds totals via `MapDefinition.root`.
- `engineering` already does this — modulo the `mean`-not-`sum` brittleness
  bug that should be fixed independently.

A new property `engineerHeadcount` (set per node, combined via `sum`, root
default `12`) gives you exactly the resource-pool semantics — including
"warn if a scenario's headcount exceeds the budget" via a derived property
`engineerHeadcountOver = max(0, engineerHeadcount - 12)`. No new top-level
field. No parallel UI. The headline metrics strip already surfaces this.

The lesson is broader: the engine has one good idea (typed numeric
properties that aggregate with configurable combiners). New "resources"
should be expressed *as that idea*, not alongside it.

### 4. Range-valued cost is a display concern, not a schema primitive

The proposal puts `cost: {min, expected, max}` on edges. But the proposal
itself admits: `expectedValue` calculations use `.expected`; `inspect` /
`rank` show all three. So the only thing the schema gains from the new
shape is that the min/max numbers travel together with the expected value.

That is genuinely useful — but it does not need a new primitive. It needs
**two new optional value definitions on the node**, e.g.
`engineeringMin` and `engineeringMax`, which the UI can render as a band
around `engineering`. The base engine treats them like any other property;
when absent, the band collapses to a point. The "ranged" affordance becomes
a *display contract*, not a *schema variant*.

The proposal's shape also begs the question of where the range lives —
edge or node? — and forces every consumer (inspect, rank, metrics, the
calculation engine) to branch on "is this a scalar or an object?". That is
the smell of a primitive that subsumes a clean existing one.

### 5. Branch outcomes collapse into scenarios + a `probability` field

The proposal's branch-outcomes example:

```ts
agent_framework_v1: {
  branches: {
    success:      { probability: 0.4 },
    disappointing:{ probability: 0.6, valueMul: 0.6, costMul: 1.5 }
  }
}
```

What is the actual semantic content?

1. There are two named alternative realizations.
2. Each has a probability.
3. Each is described as a delta from the base.

The tool already has a construct that means "alternative realization with
deltas from the base": **scenarios**. A scenario named
`agent_framework_disappoints` with a `probability: 0.6` field and an
optional `branchOf: 'agent_framework_v1'` (or even just a tag convention)
captures the same intent — and composes with strategy scenarios. The
existing stress-test workaround #6 is *already* this design, just lacking
the `probability` field to do the expected-value math automatically.

Pushing this to a per-node `branches` field creates a third axis (scenario
× branch × node) that does not compose cleanly with the other two. Keeping
it as a scenario keeps the model two-dimensional.

### 6. "Items 1+2 close 7 of 11" overcounts by collapsing

The proposal claims `nodePresent` closes 4 gaps and typed edges close 3.
But if `nodePresent` is generalized as in #1, it also subsumes the `enables`
kind (1 of the 3 "typed edge" gaps) *and* drives "value | parent succeeded"
in the chartwise roadmap. The honest scorecard:

- Generalized `nodeRef` primitive (read property of named node) closes:
  combinatorial uplift, sequencing bonus, time decay, conditional value,
  soft enablement, probabilistic-AND dependencies. **6 gaps.**
- Disjunctive prerequisites (as a `requires: {any: [...]}` clause) closes:
  OR-prereqs, and is the dual of exclusion (which is `requires: {none: [...]}`
  on the conflicting sibling). **2 gaps with one construct.**
- A scenario-level `probability` field closes: branch outcomes, range-valued
  cost via "best/expected/worst" scenarios that compose. **2 gaps.**
- Resource pools become "a new property in the product library with `sum`
  combine and a root budget." **1 gap; zero new primitives.**

That is **11 gaps closed by 2 primitives + 1 scenario field + 1 library
property**, not 5 primitives.

## The tightened proposal

Three additions, in priority order.

### A. `nodeRef`: read a property off a named node

```ts
type ValueDefinitionNodeRef = {
  node: NodeID,
  property: PropertyName  // 'present' is a synthetic property; 1 if in scenario else 0
};
```

Validation: `node` must exist; `property` must be a real property *or*
the literal `'present'`. The calculation engine resolves `'present'` via
the scenario-effective node set; all other properties go through the same
result-table lookup that `result:` already uses, but indexed by node id
instead of self.

Worked example (latency_cache uplift, drawn from polyglot.ts):

```ts
latency_cache: {
  values: {
    selfValue: {
      operator: '+',
      a: 7,
      b: { operator: '*',
           a: { node: 'voice_full_duplex', property: 'present' },
           b: 2 }
    }
  }
}
```

Subsumes: combinatorial uplift, sequencing bonus, time decay, soft enabler,
conditional value, probabilistic-AND.

### B. Node-level `requires` clause

```ts
voice_full_duplex: {
  requires: {
    all: ['voice_out_tts'],
    any: [['voice_in_whisperx', 'voice_in_inhouse']],
    none: []
  }
}
```

Edges continue to carry cost and type as today; `requires` is the
disjunctive/exclusive *constraint* layer. The validator rejects scenarios
violating `any` (no group member present) or `none` (both conflicting
nodes present). The graph drawer can render `any` groups as a bracket.

Worked example: removes the `voice_in_any` synthetic node entirely.
Mutual exclusion ASR is expressed once at the node level, not enforced by
convention in every scenario.

Subsumes: disjunctive prerequisites, mutual exclusion. (And is symmetric:
"any" and "none" are the two ends of the same construct.)

### C. Scenario-level `probability`

```ts
scenarios: {
  'agent-framework-disappoints': {
    probability: 0.6,
    branchOf: 'agent_framework_v1',   // optional; groups branches
    nodes: { agent_framework_v1: { values: { selfValue: 5.4 } } }
  }
}
```

`rank` / `inspect` can compute expected values across branches that share a
`branchOf`. No new node-level construct. Range-valued cost becomes three
scenarios with `probability` 0.1 / 0.8 / 0.1 — useful when the user actually
cares about the distribution; absent when they don't.

Subsumes: branch outcomes, range-valued cost.

### What stays out

- Typed edges (`or`/`enables`/`excludes`): replaced by `requires`.
- Resource pools as a top-level system: replaced by a library property.
- `enables`-as-multiplier: dropped entirely; expressed in `selfValue` via A.

## What to do next

Prototype A (`nodeRef`) first, on a single property in `polyglot.ts`: rip
out the `latency-cache-boosted`, `duplex-with-image-uplift`, and
`duplex-q4-decay` workaround scenarios and replace them with three
`selfValue` expressions. If the engine handles the cycle-detection cleanly
and the resulting file *reads* clearly to a non-author, the design is
right and B and C can follow. If A introduces graph-evaluation ordering
pain, that is the design constraint to surface before committing to the
larger plan.
