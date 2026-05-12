# Polyglot Roadmap — Q1 to Q4

*Faux scenario invented as a stress-test for the adjacency-map planning tool. Domain: a multimodal AI assistant that started as text-only chat and is expanding into voice, image, code, and agentic actions. ~12 engineers, 4-quarter horizon.*

## Nodes

| id | description | cost | value | certainty | deps | tags |
|---|---|---|---|---|---|---|
| `voice_in_whisperx` | Speech-to-text via WhisperX hosted pipeline | 4 | 6 | 0.8 | — | voice, infra |
| `voice_in_inhouse` | In-house ASR model trained on our chat corpus | 9 | 8 | 0.4 | `eval_harness` | voice, research |
| `voice_out_tts` | Streaming TTS with 3 voices; sub-400ms first-token | 5 | 7 | 0.7 | — | voice |
| `voice_full_duplex` | Barge-in, interruption handling, true conversational UX | 6 | 9 | 0.5 | `voice_out_tts`, (`voice_in_whisperx` OR `voice_in_inhouse`) | voice |
| `image_understanding` | Vision input: charts, screenshots, photos | 5 | 7 | 0.7 | — | image |
| `image_generation` | Native image gen via partner API (Black Forest) | 3 | 5 | 0.6 | `partner_bfl_deal` | image, partner |
| `partner_bfl_deal` | Signed licensing + rate-card with Black Forest Labs | 2 | — | 0.5 | — | legal, partner |
| `code_interpreter` | Sandboxed Python execution with file I/O | 6 | 8 | 0.7 | `sandbox_infra` | code, agents |
| `sandbox_infra` | gVisor-based isolated execution environment | 7 | 4 | 0.6 | — | infra |
| `agent_framework_v1` | Tool-use loop, planner, retry, observation memory | 8 | 9 | 0.4 | — | agents, research |
| `agent_browser` | Headless browser tool for the agent | 5 | 7 | 0.5 | `agent_framework_v1` | agents |
| `eval_harness` | Regression evals, A/B routing, prod traces | 5 | 6 | 0.8 | — | infra |
| `latency_cache` | Prompt cache + KV reuse; cuts p50 by 35% | 4 | 7 | 0.7 | — | infra |
| `data_licensing` | License multilingual voice/text corpus for training | 3 | — | 0.4 | — | legal, research |

Value `?` on `partner_bfl_deal` and `data_licensing` because their value only manifests via downstream nodes.

## Scenarios

**S1 — Agentic First.** Bet: long-horizon agents are the moat. Cut voice entirely; lean into code + browser + framework. In: `agent_framework_v1`, `agent_browser`, `code_interpreter`, `sandbox_infra`, `eval_harness`, `latency_cache`. Out: all voice, `image_generation`. `agent_framework_v1` cost climbs to 11 (we'd invest deeper).

**S2 — Multimodal Core.** Voice + image as the consumer wedge; defer agents to Q4. In: `voice_in_whisperx`, `voice_out_tts`, `voice_full_duplex`, `image_understanding`, `image_generation`, `partner_bfl_deal`, `eval_harness`. Out: `agent_browser`, `voice_in_inhouse`.

**S3 — Defensive Moats.** Ship boring infra: evals, cache, sandbox, in-house ASR. Bet: incumbents catch up on features, we win on cost/latency. In: `eval_harness`, `latency_cache`, `sandbox_infra`, `voice_in_inhouse`, `data_licensing`. `voice_in_inhouse` cost rises to 12 — it's the centerpiece.

**S4 — Partner-Led.** Build only what plugs into Black Forest + a hyperscaler. In: `partner_bfl_deal`, `image_generation`, `image_understanding`, `voice_in_whisperx`, `voice_out_tts`, `eval_harness`. Out: anything in-house. Low risk, low ceiling.

**S5 — Voice-Only Wedge.** Voice is the only modality that text incumbents can't ship overnight. In: `voice_in_whisperx`, `voice_out_tts`, `voice_full_duplex`, `latency_cache`, `eval_harness`. Out: image, agents, code.

**S6 — Balanced Hedge.** One bet per category, ship none deeply. In: `voice_in_whisperx`, `voice_out_tts`, `image_understanding`, `code_interpreter`, `sandbox_infra`, `eval_harness`. Risk: nothing differentiated.

**S7 — Research Moonshot.** Burn a quarter on `voice_in_inhouse` + `data_licensing` + `agent_framework_v1`. Either we leap ahead or fall a quarter behind.

## Where the data model gets uncomfortable

- **Order-independent combinations.** `image_understanding` + `voice_full_duplex` jointly unlock "show me a chart and ask out loud" — value is from the pair, not either alone, and order doesn't matter. No parent edge expresses this.
- **OR-dependencies / implementation forks.** `voice_full_duplex` needs *some* ASR — `voice_in_whisperx` OR `voice_in_inhouse`. These are mutually substitutable, with very different cost/certainty/strategic implications. The graph wants disjunctive edges.
- **Mutual exclusion.** Picking `voice_in_inhouse` forecloses ever wiring `voice_in_whisperx` as primary in the same quarter (team can't maintain both). Not a dependency — a *conflict edge*.
- **Probabilistic outcomes.** `agent_framework_v1` has 0.4 certainty — there's a real branch where we ship a "v1.5 limp" version at 60% of value and 1.5x cost. One node, two possible realized states.
- **Resource constraints.** 12 engineers. `voice_in_inhouse` (4 eng) + `agent_framework_v1` (5 eng) + `code_interpreter` (3 eng) sums to 12 — fine in isolation, impossible if any slips. The model has cost-per-node but no shared capacity pool per quarter.
- **Soft / preferential dependencies.** `voice_full_duplex` is *better* if `image_understanding` shipped first (shared UX patterns, +1 value); not required. A weighted hint edge, not a hard dep.
- **Compound milestones.** `agent_framework_v1` is really 4 sub-decisions (planner arch, memory shape, retry policy, tool schema) that we'd want to expose individually for scenario analysis but lump together for cost estimation.
- **Combinatorial value functions.** `latency_cache` is worth 4 alone, but 9 if `voice_full_duplex` ships (latency is what makes duplex work). Value is non-additive.
- **Time-bounded value.** `voice_full_duplex` is worth 9 if shipped by Q3 and 3 if it slips to Q4 — a competitor is rumored. Value decays with time, which a static node can't represent.
- **Enabler nodes with no intrinsic value.** `partner_bfl_deal` and `data_licensing` have value = 0 standalone; their entire value flows through children. Today they look like deadweight in any rollup.
- **Carry-over across scenarios.** S3 builds `voice_in_inhouse`; if we later pivot to S2, that work *partially* applies (-2 weeks on `voice_in_whisperx` integration). Scenarios aren't independent — they share a tech-debt/asset substrate.
- **Non-engineering blockers.** `data_licensing` and `partner_bfl_deal` are calendar-bound (legal cycles), not engineering-bound. Same cost units don't apply.
