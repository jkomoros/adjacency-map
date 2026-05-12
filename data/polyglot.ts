import {
	RawMapDefinition
} from '../src/types.js';

/*
 * Polyglot multimodal AI assistant roadmap.
 *
 * Stress-test data file. See docs/superpowers/notes/2026-05-12-modeling-stress-test.md
 * for an explicit ledger of which roadmap semantics encoded cleanly, which had
 * to be worked around, and which couldn't be expressed at all.
 *
 * Conventions used below:
 *   - One node per capability. Per-node engineering cost (person-weeks) is
 *     applied to ONE primary edge; secondary "dependency" edges carry cost: 0
 *     so totals don't double-count. The first/sole edge is the primary.
 *   - selfValue holds the roadmap's "value" column directly.
 *   - certainty is overridden per-node to match the roadmap (rather than
 *     letting it cascade as a product of parent * incrementalCertainty), so
 *     that the published table matches the inspected values 1:1.
 *   - The "OR" branch in voice_full_duplex's prerequisite is encoded
 *     declaratively via the node-level `requires.any` clause. Mutual
 *     exclusion between voice_in_whisperx and voice_in_inhouse is declared
 *     once via `requires.none` on voice_in_whisperx (the constraint is
 *     symmetric, so it applies regardless of which side declared it).
 *     The previous workaround (a synthetic `voice_in_any` proxy node plus
 *     per-scenario `removed:true` to enforce ASR exclusion) is gone.
 *   - Cross-node conditional values (latency_cache uplift, duplex image
 *     uplift) are encoded directly in the base-graph selfValue expressions
 *     via the `nodeRef` ValueDefinition primitive.
 *     See docs/superpowers/notes/2026-05-12-noderef-prototype-reflection.md.
 *   - Time-decay (duplex Q3 window) is encoded via a map-level event
 *     (`q3_window_open`) referenced via `{event: ...}`. The scenario
 *     `duplex-q4-missed` flips it to absent. See AGENTS.md "Events".
 *   - Probabilistic downside modeling (agent_framework_v1 might ship at
 *     60% value with 60% probability) uses the scenario-level
 *     `probability` + `branchOf` fields on `agent-framework-disappoints`.
 *     See AGENTS.md "Probabilistic scenario branches".
 */

const data : RawMapDefinition = {
	description: 'Polyglot: multimodal AI assistant roadmap (voice + vision + agents). 14 capabilities, 7 strategy scenarios.',
	import: 'product',
	display: {
		headlineMetrics: ['engineering', 'value', 'expectedValue', 'certainty']
	},
	// NB: the product library's selfValue references tagConstant 'value';
	// when ANY tag is defined every tag must define the same constant set, so
	// every tag below carries a 'value: 0' constant. Per-node selfValue is set
	// explicitly via values.selfValue rather than via tag constants.
	tags: {
		voice: {
			displayName: 'Voice',
			color: '#4f80ff',
			description: 'Voice modality capabilities (input, output, full-duplex).',
			constants: { value: 0 }
		},
		image: {
			displayName: 'Image',
			color: '#ff8844',
			description: 'Vision input and image generation.',
			constants: { value: 0 }
		},
		code: {
			displayName: 'Code',
			color: '#22aa22',
			description: 'Code execution and tool use.',
			constants: { value: 0 }
		},
		agents: {
			displayName: 'Agents',
			color: '#9933cc',
			description: 'Agentic capabilities: planning, tool loops, browsers.',
			constants: { value: 0 }
		},
		infra: {
			displayName: 'Infra',
			color: '#777777',
			description: 'Platform-level infra (sandboxing, caching, evals).',
			constants: { value: 0 }
		},
		research: {
			displayName: 'Research',
			color: '#cc4488',
			description: 'Speculative research bets, lower certainty.',
			constants: { value: 0 }
		},
		partner: {
			displayName: 'Partner',
			color: '#aa7700',
			description: 'Capabilities that rely on third-party partner deals.',
			constants: { value: 0 }
		},
		legal: {
			displayName: 'Legal',
			color: '#444488',
			description: 'Legal / licensing workstreams; value flows to children, not self.',
			constants: { value: 0 }
		}
	},
	events: {
		// Map-level event for time-decay. Default-present: the Q3 window is
		// still open in the base graph and in every strategy scenario except
		// `duplex-q4-missed`, which flips it to `present: false`. Referenced
		// from voice_full_duplex.selfValue via `{event: 'q3_window_open'}`.
		// We use the "window-open" framing (default-present) rather than
		// "deadline-missed" (default-absent) so that an unmodified scenario
		// reflects the current "still on track" state and the override
		// explicitly says "the window closed".
		q3_window_open: {
			description: 'Q3 ship window for voice_full_duplex is still open. Flip to present:false in a scenario to model the post-Q3 world (drops voice_full_duplex.selfValue 9 -> 3, or 10 -> 4 if image_understanding is also present).',
			defaultPresent: true
		}
	},
	nodes: {
		// -------- Voice input --------
		voice_in_whisperx: {
			description: 'Speech-to-text via WhisperX hosted pipeline.',
			tags: ['voice', 'infra'],
			// Mutual exclusion with the in-house ASR: the two are
			// alternatives, never shipped together. Declared once here;
			// applies symmetrically. In the base graph this is a soft
			// warning (the base is a pre-decision view); in any named
			// scenario including both is a hard error.
			requires: {
				none: ['voice_in_inhouse']
			},
			edges: [
				{ type: 'engineering', cost: 4 }
			],
			values: {
				selfValue: 6,
				certainty: 0.8
			}
		},
		voice_in_inhouse: {
			description: 'In-house ASR model trained on chat corpus.',
			tags: ['voice', 'research'],
			edges: [
				// Self-rooted engineering edge: keeps the per-node cost present
				// regardless of whether the eval_harness dep is removed in a
				// scenario. Without this, a scenario that cuts eval_harness
				// would silently zero out the cost of voice_in_inhouse — a
				// real schema gotcha. See notes file ("Where the model felt
				// brittle").
				{ type: 'engineering', cost: 9 },
				// Dependency edge to eval_harness, no additional cost.
				{ type: 'engineering', parent: 'eval_harness', cost: 0 }
			],
			values: {
				selfValue: 8,
				certainty: 0.4
			}
		},

		// -------- Voice output / duplex --------
		voice_out_tts: {
			description: 'Streaming TTS with 3 voices; sub-400ms first-token.',
			tags: ['voice'],
			edges: [
				{ type: 'engineering', cost: 5 }
			],
			values: {
				selfValue: 7,
				certainty: 0.7
			}
		},
		voice_full_duplex: {
			description: 'Barge-in, interruption handling, true conversational. Needs voice_out_tts AND (voice_in_whisperx OR voice_in_inhouse).',
			tags: ['voice'],
			// Declarative prerequisite. The TTS dependency is also expressed
			// as a cost-bearing edge below; declaring it in `requires.all`
			// would be redundant. The OR-of-ASRs has no cost-bearing edge,
			// so it lives only here. See AGENTS.md "Constraints (`requires`)".
			requires: {
				any: [['voice_in_whisperx', 'voice_in_inhouse']]
			},
			edges: [
				// Primary edge (carries the cost) hangs off TTS.
				{ type: 'engineering', parent: 'voice_out_tts', cost: 6 }
			],
			values: {
				// Previously the base was a flat `selfValue: 9` with two
				// workaround scenarios (duplex-with-image-uplift,
				// duplex-q4-decay). With nodeRef the expression is:
				//
				//   base 3
				//   + 6 if event q3_window_open is present      (decay if missed)
				//   + 1 if image_understanding is in the scenario (uplift)
				//
				// q3_window_open is a map-level *event* (see the `events`
				// block above), not a node — events are the right anchor for
				// "did this happen yet?" semantics, which have no natural
				// place in the node graph. The scenario `duplex-q4-missed`
				// flips it to `present: false`, dropping duplex.selfValue
				// from 9 to 3 (or 10 to 4 if image_understanding survives).
				selfValue: {
					operator: '+',
					a: {
						operator: '+',
						a: 3,
						b: {
							operator: '*',
							a: { event: 'q3_window_open' },
							b: 6
						}
					},
					b: { node: 'image_understanding', property: 'present' }
				},
				certainty: 0.5
			}
		},

		// -------- Image --------
		image_understanding: {
			description: 'Vision input: charts, screenshots, photos.',
			tags: ['image'],
			edges: [
				{ type: 'engineering', cost: 5 }
			],
			values: {
				selfValue: 7,
				certainty: 0.7
			}
		},
		partner_bfl_deal: {
			description: 'Signed licensing with Black Forest Labs. Value is 0 because value flows entirely through image_generation; this exists to gate it.',
			tags: ['partner', 'legal'],
			edges: [
				{ type: 'partnerships', cost: 2 }
			],
			values: {
				selfValue: 0,
				certainty: 0.5
			}
		},
		image_generation: {
			description: 'Native image gen via partner API (Black Forest Labs).',
			tags: ['image', 'partner'],
			edges: [
				{ type: 'engineering', parent: 'partner_bfl_deal', cost: 3 }
			],
			values: {
				selfValue: 5,
				certainty: 0.6
			}
		},

		// -------- Code / agents --------
		sandbox_infra: {
			description: 'gVisor isolated execution environment.',
			tags: ['infra'],
			edges: [
				{ type: 'engineering', cost: 7 }
			],
			values: {
				selfValue: 4,
				certainty: 0.6
			}
		},
		code_interpreter: {
			description: 'Sandboxed Python execution with file I/O.',
			tags: ['code', 'agents'],
			edges: [
				{ type: 'engineering', parent: 'sandbox_infra', cost: 6 }
			],
			values: {
				selfValue: 8,
				certainty: 0.7
			}
		},
		agent_framework_v1: {
			description: 'Tool-use loop, planner, retry, observation memory.',
			tags: ['agents', 'research'],
			edges: [
				{ type: 'engineering', cost: 8 }
			],
			values: {
				selfValue: 9,
				certainty: 0.4
			}
		},
		agent_browser: {
			description: 'Headless browser tool for the agent.',
			tags: ['agents'],
			edges: [
				{ type: 'engineering', parent: 'agent_framework_v1', cost: 5 }
			],
			values: {
				selfValue: 7,
				certainty: 0.5
			}
		},

		// -------- Cross-cutting infra --------
		eval_harness: {
			description: 'Regression evals, A/B routing, prod traces.',
			tags: ['infra'],
			edges: [
				{ type: 'engineering', cost: 5 }
			],
			values: {
				selfValue: 6,
				certainty: 0.8
			}
		},
		latency_cache: {
			description: 'Prompt cache + KV reuse; cuts p50 by 35%.',
			tags: ['infra'],
			edges: [
				{ type: 'engineering', cost: 4 }
			],
			values: {
				// PROTOTYPE: previously a flat `selfValue: 7` with a workaround
				// scenario `latency-cache-boosted` that overrode it to 9 when
				// voice_full_duplex was in the scenario. With nodeRef the
				// conditional lives in the base graph: 7 + 2 * present(duplex).
				selfValue: {
					operator: '+',
					a: 7,
					b: {
						operator: '*',
						a: { node: 'voice_full_duplex', property: 'present' },
						b: 2
					}
				},
				certainty: 0.7
			}
		},
		data_licensing: {
			description: 'License multilingual voice/text corpus. Value 0 alone; flows through children.',
			tags: ['legal', 'research'],
			edges: [
				{ type: 'partnerships', cost: 3 }
			],
			values: {
				selfValue: 0,
				certainty: 0.4
			}
		}
	},

	scenarios: {
		// 1. agentic-first: cut all voice; agent_framework_v1 cost rises to 11.
		'agentic-first': {
			description: 'Bet on long-horizon agents; cut all voice work.',
			decision: 'Considered as the high-conviction agent bet.',
			reasoning: 'Removes voice modality entirely to free engineering to push agents harder. agent_framework_v1 cost rises 8->11 reflecting the increased scope without the voice team backstop.',
			nodes: {
				voice_in_whisperx: { removed: true },
				voice_in_inhouse: { removed: true },
				voice_out_tts: { removed: true },
				voice_full_duplex: { removed: true },
				agent_framework_v1: {
					edges: {
						modify: {
							'engineering+': {
								type: 'engineering',
								cost: 11
							}
						}
					}
				}
			}
		},

		// 2. multimodal-core: voice + image; defer agents.
		'multimodal-core': {
			description: 'Voice + image; defer all agentic work.',
			decision: 'Front-runner for next-quarter roadmap.',
			reasoning: 'Doubles down on the two highest-certainty modalities (voice + image) while parking the lower-certainty agent stack. Picks WhisperX as the ASR (mutually exclusive with in-house).',
			nodes: {
				// Pick WhisperX as the default ASR (higher certainty, lower
				// cost). The mutual-exclusion constraint on
				// voice_in_whisperx.requires.none means scenarios MUST pick
				// exactly one ASR.
				voice_in_inhouse: { removed: true },
				agent_framework_v1: { removed: true },
				agent_browser: { removed: true },
				code_interpreter: { removed: true },
				sandbox_infra: { removed: true }
			}
		},

		// 3. defensive-moats: boring infra; voice_in_inhouse rises to cost 12.
		'defensive-moats': {
			description: 'Boring infra investments; in-house voice ASR becomes the centerpiece.',
			decision: 'Hedge if competitors win on flashier modalities.',
			reasoning: 'Cut WhisperX and double down on in-house ASR (mutual exclusion). Cost rises 9->12 reflecting full team allocation. Cuts agents and image gen to fund infra build-out.',
			nodes: {
				// Mutual exclusion enforced: in this scenario, WhisperX is cut.
				voice_in_whisperx: { removed: true },
				// In-house ASR becomes the centerpiece -> cost up.
				// Modifies the self-rooted engineering edge (the one without
				// a parent); its match ID is "engineering+".
				voice_in_inhouse: {
					edges: {
						modify: {
							'engineering+': {
								type: 'engineering',
								cost: 12
							}
						}
					}
				},
				image_generation: { removed: true },
				partner_bfl_deal: { removed: true },
				agent_browser: { removed: true },
				agent_framework_v1: { removed: true },
				code_interpreter: { removed: true },
				sandbox_infra: { removed: true }
			}
		},

		// 4. partner-led: only build what plugs into partners; remove anything in-house.
		'partner-led': {
			description: 'Only build what plugs into partners; cut everything in-house.',
			decision: 'Capital-light: outsource modality builds.',
			reasoning: 'Keep partner_bfl_deal-driven image gen, drop in-house voice ASR and agent framework. WhisperX (hosted) survives as it is itself partner-hosted.',
			nodes: {
				voice_in_inhouse: { removed: true },
				voice_full_duplex: { removed: true },
				agent_framework_v1: { removed: true },
				agent_browser: { removed: true },
				code_interpreter: { removed: true },
				sandbox_infra: { removed: true },
				data_licensing: { removed: true }
			}
		},

		// 5. voice-only-wedge: voice is the only modality.
		'voice-only-wedge': {
			description: 'Voice is the only modality. Everything else is cut.',
			decision: 'Niche-but-defensible wedge play.',
			reasoning: 'Bet the whole quarter on conversational voice. Cuts image, code, and agents. Keeps WhisperX as the ASR (mutually exclusive with the in-house ASR via voice_in_whisperx.requires.none).',
			nodes: {
				// Pick the cheaper, higher-certainty ASR; in-house is excluded
				// by mutual exclusion (declared on voice_in_whisperx).
				voice_in_inhouse: { removed: true },
				image_understanding: { removed: true },
				image_generation: { removed: true },
				partner_bfl_deal: { removed: true },
				code_interpreter: { removed: true },
				sandbox_infra: { removed: true },
				agent_framework_v1: { removed: true },
				agent_browser: { removed: true }
			}
		},

		// 6. balanced-hedge: one bet per category, nothing deep.
		'balanced-hedge': {
			description: 'One bet per category, none deep. Risk: nothing differentiated.',
			decision: 'Safe but unexciting; flagged as "least likely to win, least likely to fail".',
			reasoning: 'Keeps the cheapest-and-most-certain node from each category and prunes the rest.',
			nodes: {
				// Keep voice_in_whisperx (cheap, high certainty); drop the rest of voice.
				voice_in_inhouse: { removed: true },
				voice_out_tts: { removed: true },
				voice_full_duplex: { removed: true },
				// Keep image_understanding; drop generation and the partner stack.
				image_generation: { removed: true },
				partner_bfl_deal: { removed: true },
				// Keep code_interpreter (via sandbox_infra) on the code side.
				agent_framework_v1: { removed: true },
				agent_browser: { removed: true },
				data_licensing: { removed: true }
			}
		},

		// 7. research-moonshot: voice_in_inhouse + data_licensing + agent_framework_v1.
		'research-moonshot': {
			description: 'Speculative research portfolio: in-house ASR + licensed corpus + agent framework.',
			decision: 'High-variance bet; rejected for next quarter, revisit Q3.',
			reasoning: 'Funds the three lowest-certainty highest-ceiling bets and cuts everything else, including WhisperX (mutual exclusion with in-house ASR).',
			nodes: {
				voice_in_whisperx: { removed: true },
				voice_out_tts: { removed: true },
				voice_full_duplex: { removed: true },
				image_understanding: { removed: true },
				image_generation: { removed: true },
				partner_bfl_deal: { removed: true },
				sandbox_infra: { removed: true },
				code_interpreter: { removed: true },
				agent_browser: { removed: true },
				latency_cache: { removed: true },
				eval_harness: { removed: true }
			}
		},

		// --- Cross-cutting scenarios ---
		//
		// Three workaround scenarios were here previously
		// (`latency-cache-boosted`, `duplex-with-image-uplift`,
		// `duplex-q4-decay`). All three are now expressed directly in the
		// base-graph value definitions via the nodeRef value-definition
		// primitive (see voice_full_duplex.values.selfValue and
		// latency_cache.values.selfValue above), so they no longer need to
		// exist as separate scenarios. The two semantics that survived as
		// scenarios:
		//
		//   - `duplex-q4-missed` below: flips the map-level event
		//     `q3_window_open` to `present: false`, which drops
		//     voice_full_duplex's value 9 -> 3 (or 10 -> 4 when
		//     image_understanding is also present). This demonstrates the
		//     first-class events mechanism.
		//   - The image-uplift case has no dedicated scenario at all: it
		//     emerges automatically whenever a strategy scenario includes
		//     both voice_full_duplex and image_understanding (e.g.
		//     multimodal-core).
		//   - The latency_cache uplift likewise emerges automatically
		//     whenever a strategy scenario keeps voice_full_duplex.

		// Time-decay demonstration: voice_full_duplex value drops once the
		// Q3 ship window closes. The drop is automatic via the event check;
		// the scenario's only job is to flip the event to absent.
		'duplex-q4-missed': {
			description: 'Q3 ship window closed before voice_full_duplex shipped. Demonstrates event-driven time-decay via the q3_window_open event.',
			decision: 'Use to motivate Q3 ship-or-cut decision.',
			reasoning: 'When q3_window_open is flipped to present:false, voice_full_duplex.selfValue auto-drops from 9 to 3 (or 10 to 4 if image_understanding is also present), because the {event: q3_window_open} check in its selfValue expression evaluates to 0.',
			events: {
				q3_window_open: { present: false }
			},
			nodes: {
				// Pick WhisperX as the default ASR (cheap, higher certainty).
				// The mutual-exclusion constraint on voice_in_whisperx.requires.none
				// means every named scenario must pick exactly one ASR.
				voice_in_inhouse: { removed: true }
			}
		},

		// Probabilistic branch off the base: agent_framework_v1 ships at 60%
		// value (9 -> 5.4) and 1.5x cost (8 -> 12) with 60% probability. The
		// remaining 40% is the implicit "base realized" weight, computed by
		// the engine when ranking/inspecting branch-group expected values.
		// See AGENTS.md "Probabilistic scenario branches".
		'agent-framework-disappoints': {
			description: 'agent_framework_v1 ships at 60% value (9->5.4) and 1.5x cost (8->12). 60% probability branch off the base.',
			decision: 'Risk-side comparator for the agent bet.',
			reasoning: 'Schema certainty is a scalar; the probability+branchOf primitive materializes the downside outcome explicitly, so inspect/rank can compute probability-weighted expected values across the branch group.',
			probability: 0.6,
			branchOf: '',
			nodes: {
				// Pick WhisperX as the default ASR. Required to satisfy the
				// mutual-exclusion constraint declared on voice_in_whisperx.
				voice_in_inhouse: { removed: true },
				agent_framework_v1: {
					values: {
						selfValue: 5.4
					},
					edges: {
						modify: {
							'engineering+': {
								type: 'engineering',
								cost: 12
							}
						}
					}
				}
			}
		},

		// Carry-over: if defensive-moats built voice_in_inhouse, switching to
		// multimodal-core saves 2 weeks on voice integration. Encoded as an
		// extension of multimodal-core that flips the ASR choice (in-house
		// already built) and shaves 2pw off voice_full_duplex's TTS edge.
		'multimodal-core-after-moats': {
			description: 'Workaround: multimodal-core, but assuming defensive-moats already shipped voice_in_inhouse (saves 2pw on voice integration).',
			extends: 'multimodal-core',
			decision: 'Path-dependent transition scenario.',
			reasoning: 'Encodes the "scenario carry-over" semantic by extending multimodal-core, swapping the ASR choice (in-house already paid for), and shaving cost off the integration node.',
			nodes: {
				// In-house was already built by defensive-moats; flip the ASR
				// choice. (Mutual exclusion still satisfied — exactly one ASR
				// is present.)
				voice_in_whisperx: { removed: true },
				voice_in_inhouse: { removed: false },
				voice_full_duplex: {
					edges: {
						modify: {
							'engineering+voice_out_tts': {
								type: 'engineering',
								parent: 'voice_out_tts',
								cost: 4
							}
						}
					}
				}
			}
		}
	}
};

export default data;
