# `nodeRef` prototype: reflection

Empirical validation of primitive A from the elegance critique
(`2026-05-12-primitives-elegance-critique.md`). Built on the
`planning-workflow-improvements` branch, commit `b7aeac7`.

## Did it work?

**Yes — and the workarounds collapsed cleanly.**

| Workaround scenario          | Before                             | After                                                            |
| ---------------------------- | ---------------------------------- | ---------------------------------------------------------------- |
| `latency-cache-boosted`      | Scenario override: selfValue = 9   | Base graph: `7 + 2 * present(voice_full_duplex)`                 |
| `duplex-with-image-uplift`   | Scenario override: selfValue = 10  | Implicit term in base graph: `+ present(image_understanding)`    |
| `duplex-q4-decay`            | Scenario override: selfValue = 3   | Base graph: `3 + 6 * present(q3_window_open)` + decay scenario   |

The big one is `duplex-with-image-uplift`. It is now **literally invisible
as a scenario**: the +1 emerges automatically whenever any strategy
scenario happens to keep both `voice_full_duplex` and `image_understanding`
(e.g. `multimodal-core`, `voice-only-wedge`). The planner does not have to
remember to compose anything. The encoding has shifted from "the planner
mentally cross-references two scenarios" to "the engine does it
automatically". That is a real reduction in cognitive load.

Concrete confirmation from `npm run diff -- polyglot agentic-first
multimodal-core`:

    ~ latency_cache.selfValue: 7.00 -> 9.00 (+2.00)

The 7→9 lift now happens just because `multimodal-core` keeps
`voice_full_duplex`; no `latency-cache-boosted` overlay required.

`duplex-q4-missed` from `npm run inspect`:

    ~ voice_full_duplex.selfValue: 10.00 -> 4.00 (-6.00)

Time-decay works via the deadline-node convention; the scenario only flips
the sentinel.

## Does the file read better?

**Yes, but with a caveat.** The expressions for `latency_cache.selfValue`
and `voice_full_duplex.selfValue` are now small ASTs rather than scalars.
That is more visually heavy in the data file. But:

1. The intent is now *in the data*. Before, a reader had to scroll to the
   scenarios block and infer that "`latency-cache-boosted` exists because
   latency depends on duplex". Now they read `7 + 2 *
   present(voice_full_duplex)` and the dependency is right there.
2. The scenarios list shrank from 11 entries to 9 (the three workarounds
   collapsed, with `duplex-q4-missed` added back as a one-line sentinel
   toggle). Most of those were noise.
3. The ASTs are uglier than they need to be in JS object syntax. If we
   ever add a `compute:` field that takes a string expression
   (`"7 + 2 * present('voice_full_duplex')"`), the noise drops dramatically.
   That is a future optimization; the underlying primitive is right.

The win, qualitatively: when reading `voice_full_duplex` cold, the
sentence "value is 3 baseline, plus 6 if the Q3 window is still open, plus
1 if image is shipping" is more readable than "value is 9 by default, but
go check the three override scenarios". The conditional structure of the
roadmap is *in* the node now.

## What did I have to build?

Roughly 90 lines of new code:

| File                       | Lines added | What                                              |
| -------------------------- | ----------- | ------------------------------------------------- |
| `src/types.ts`             | ~30         | `ValueDefinitionNodeRef` type, `NodeRefResolver`, args plumbing |
| `src/value-definition.ts`  | ~50         | Type guard, validation branch, calculation branch, listNestedDefinitions branch |
| `src/adjacency-map.ts`     | ~30         | `isNodePresent` / `nodeValuesIfPresent` impl, in-flight set, resolver threading into 3 calculation sites in `_computeValues` |

The primitive itself was small. The plumbing dominated. Two concrete
findings:

**Threading the resolver was painful.** The calculation args
(`ValueDefinitionCalculationArgs`) had to grow a new optional field. Every
caller of `calculateValue` should set `resolver`, but I only touched the
three sites in `_computeValues` that matter for node-property calculation.
There are at least eight other `calculateValue` call sites (display, root,
property combiner, etc.) that won't have a resolver attached, so nodeRef
in those contexts would throw with a clear error. Validation rejects
nodeRef in `nodeOverride` and other contexts via `ALLOWED_VARIABLES_FOR_CONTEXT`,
which I updated to make node-overrides allow nodeRef. Display and group
contexts still disallow it; reasonable for now.

**The biggest surprise was the stale `.GENERATED.js` issue surfacing
again.** As soon as I tried `npm run validate`, every scenario failed with
`Exhaustiveness check failed: [object Object]`. The error came from
*compiled* stale `.js` files in `src/` that pre-dated my type changes;
they shadow the `.ts` files under the ts-node ESM loader. The
modeling-stress-test notes called this out as a known footgun in item #3
of "where the model felt brittle". A clean (`npm run build:clean:typescript`)
fixed it instantly. The bug isn't with nodeRef — but it cost me ~5 minutes
of confused debugging and is worth re-flagging: any change that touches
the `ValueDefinition` union will tickle this until the compiled artifacts
are also regenerated or deleted.

## Cycle-detection findings

**Built it dynamically; documented as a runtime check, not a static
analysis.** Static cycle detection across `nodeRef` would require building
a node→node value-dependency graph and topological-sorting it, parallel
to the property-dependency graph the engine already maintains. That is
real engineering for the prototype's scope. Instead, `AdjacencyMap` keeps
a `_nodeValuesInFlight: Set<NodeID>` that a node adds itself to before
computing values and removes after (via try/finally). `nodeValuesIfPresent`
checks the set and throws on hit.

This catches direct (A↔A) and transitive (A→B→A) cycles at evaluation
time, in the first scenario that triggers the cycle. It does NOT catch
unreachable cycles (e.g. A references C only in a scenario where C is
removed). That's the price of dynamic detection; for the prototype it is
acceptable.

**I did not hit a real cycle in polyglot.** All three replacements are
strictly one-way: `latency_cache → voice_full_duplex`,
`voice_full_duplex → image_understanding`, `voice_full_duplex →
q3_window_open`. No back-edges. So the cycle path is theoretical here.

## Evaluation ordering

**Worked correctly without changes to property ordering.** The existing
engine sorts properties topologically and computes them in that order
within a single node. `nodeRef` adds *inter-node* dependency edges, which
are not in that sort. But it turns out that doesn't matter: each
referenced node's `.values` is computed lazily on first access, and the
in-flight set catches the only failure mode (cycles).

What this means in practice: when computing `latency_cache.selfValue`, the
engine evaluates `present(voice_full_duplex)`, which calls
`isNodePresent('voice_full_duplex')` — just a set lookup, no recursion.
For a real value lookup (e.g. `property: 'value'`), the engine would
recursively compute the target node's full values. That recursion could
in principle re-enter `latency_cache.values`, but only if there's a real
cycle, which the in-flight set catches.

**One subtle thing**: order-of-iteration over `nodes` is now load-bearing
in a way it wasn't before. If you call `map.result` (which iterates every
node's `.values`), the iteration order affects which node triggers the
recursive computation first. The values are cached so the answer is the
same — but the call stack on a fresh map can be deeper than it used to
be. No bug, but worth noting if anyone hits a "max call stack exceeded"
on a deeply chained graph in the future.

## What would B and C need beyond this?

**B (node-level `requires` clause).** Independent of nodeRef. It's a
constraint on the *graph topology*, not on value calculation. Adds:
- A new field on `NodeDefinition`: `requires?: { all?: NodeID[], any?:
  NodeID[][], none?: NodeID[] }`.
- A validator pass that checks the current scenario's effective node set
  against each node's `requires`. Throws or warns on violation.
- Optionally, graph-render hints (e.g. dotted brackets for `any` groups).

No interaction with nodeRef beyond shared use of NodeID. They are
orthogonal — B handles *can this scenario ship*, A handles *what value
does it produce*.

**C (scenario-level `probability` field).** Also independent of nodeRef.
Adds:
- A new field on `Scenario`: `probability?: number` and optional `branchOf?:
  ScenarioName`.
- Updates to `rank` / `inspect` that compute expected values across
  scenarios sharing a `branchOf` using their probabilities.

C composes interestingly with the nodeRef prototype: the
`agent-framework-disappoints` workaround scenario in polyglot.ts is still
there (I didn't try to subsume it). With C, it would carry
`probability: 0.6, branchOf: 'agent_framework_v1'` and the engine would
automatically compute `agent_framework_v1.expectedValue` as a probabilistic
weighted average across its branches. A separate, smaller win than A.

**One subtlety**: B and C don't surface the same design constraint A
did, which is the threading of new data through the calculation context.
Both B and C live outside `calculateValue`. So neither will demand the
plumbing work A required.

## Final verdict

**The tightened design holds.** `nodeRef` as `{ node, property }` with
`'present'` as a synthetic property is the right shape. It:

1. Composes algebraically with every existing primitive (`+`, `*`, `if`,
   `compare`, `combine`, `let`, etc.) without any special-casing.
2. Subsumes three roadmap workarounds with no apparent loss of
   expressiveness.
3. Reads cleanly when read cold: the value rule lives at the node where
   the value rule applies.

**Surfaced constraints worth noting:**

1. **Sentinel-node convention is necessary, not optional.** Time-decay
   (and any event-shaped semantic — "the demo happened", "the regulation
   passed", "Q3 closed") has no anchor without one. I encoded
   `q3_window_open` as a node, which works, but it appears in the rendered
   graph as a real-looking capability. In a production design these belong
   in a separate `events: { id: { defaultPresent: bool } }` map-level field
   that nodeRef can read from (`{ event: 'q3_open', property: 'present' }`
   or just expand nodeRef's domain). For the prototype, the node-encoding
   is fine.

2. **No static cycle detection.** Acceptable for this prototype; would be
   worth adding before generalizing. The integration would parallel the
   existing topological sort over `propertyDefinition.dependencies`, but
   over node-IDs rather than property-names. Tractable.

3. **Resolver threading is invasive.** Adding a new arg to
   `ValueDefinitionCalculationArgs` means *every* call site needs to opt
   in. I touched three; there are ~10 more that don't need it but would
   throw clearly if a nodeRef accidentally appeared in their context.
   Validation prevents that by default (most contexts have
   `nodeRef: false` in `AllowedValueDefinitionVariableTypes`). Still, a
   future generalization should consider whether resolver should live on
   the `MapDefinition` object so it's available everywhere by default.

4. **The `.GENERATED.js` shadowing bug bit again.** Not a nodeRef
   problem, but anyone iterating on `ValueDefinition` will hit it. Fix the
   build pipeline (`npm run validate` should run `build:clean:generated`
   first) before any further work on this primitive family.

**The critique was right.** Generalizing `nodePresent` to `nodeRef` with
named-node-and-property semantics is a clean primitive that subsumes
multiple roadmap gaps with a single ten-line construct. Proceed with B
(`requires`) and C (`probability`) next; they are orthogonal additions
that don't depend on nodeRef and don't constrain its design.
