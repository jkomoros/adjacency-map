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
 *   - The "OR" branch in voice_full_duplex's prerequisite is encoded via a
 *     synthetic `voice_in_any` proxy node; see notes file.
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
	nodes: {
		// -------- Voice input --------
		voice_in_whisperx: {
			description: 'Speech-to-text via WhisperX hosted pipeline.',
			tags: ['voice', 'infra'],
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

		// Synthetic OR-gate node: see notes file. This node exists ONLY so that
		// voice_full_duplex can depend on "either whisperx or inhouse". It
		// claims both ASR nodes as parents; in scenarios where one ASR is cut,
		// the corresponding parent edge is dropped (silently, per schema) but
		// the OR-gate node itself survives as long as at least one ASR is
		// still in the graph.
		voice_in_any: {
			description: 'Synthetic OR-gate: voice-input is available iff at least one ASR (WhisperX or in-house) ships. Cost 0; exists to express disjunction the schema cannot encode natively.',
			tags: ['voice'],
			edges: [
				{ type: 'engineering', parent: 'voice_in_whisperx', cost: 0 },
				{ type: 'engineering', parent: 'voice_in_inhouse', cost: 0 }
			],
			values: {
				selfValue: 0,
				// Pin certainty to 1.0 so the OR-gate doesn't drag down the
				// effective certainty of its dependents; the certainty of the
				// real ASR node will propagate via the engineering chain.
				certainty: 1.0
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
			edges: [
				// Primary edge (carries the cost) hangs off TTS.
				{ type: 'engineering', parent: 'voice_out_tts', cost: 6 },
				// Disjunction expressed via synthetic OR-gate node.
				{ type: 'engineering', parent: 'voice_in_any', cost: 0 }
			],
			values: {
				selfValue: 9,
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
				selfValue: 7,
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
				voice_in_any: { removed: true },
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
			reasoning: 'Doubles down on the two highest-certainty modalities (voice + image) while parking the lower-certainty agent stack.',
			nodes: {
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
			reasoning: 'Bet the whole quarter on conversational voice. Cuts image, code, and agents.',
			nodes: {
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
				voice_in_any: { removed: true },
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

		// --- Workaround scenarios for cross-cutting semantics ---

		// Combinatorial: latency_cache value rises 4->9 IF voice_full_duplex ships.
		// We can't express this conditionally in the base graph, so it's
		// expressed as an explicit scenario the planner can compare against.
		'latency-cache-boosted': {
			description: 'Workaround: latency_cache selfValue rises 7->9 when voice_full_duplex is shipping (combinatorial uplift not expressible in base graph).',
			decision: 'Comparator only; not a real plan.',
			reasoning: 'Apply this when modeling a world where voice_full_duplex ships, to see the latency_cache uplift in expected value.',
			nodes: {
				latency_cache: {
					values: {
						selfValue: 9
					}
				}
			}
		},

		// Soft preference: image_understanding shipped first => voice_full_duplex +1 value.
		'duplex-with-image-uplift': {
			description: 'Workaround: voice_full_duplex selfValue rises 9->10 when image_understanding ships first (shared UX patterns).',
			decision: 'Comparator only.',
			reasoning: 'No native way to model soft preferences / sequencing bonuses; expressed as a separate scenario.',
			nodes: {
				voice_full_duplex: {
					values: {
						selfValue: 10
					}
				}
			}
		},

		// Time-decay: voice_full_duplex worth 9 in Q3, 3 in Q4.
		'duplex-q4-decay': {
			description: 'Workaround: voice_full_duplex selfValue drops 9->3 in Q4 (competitor rumored to ship). Pure time-decay; not expressible without scenarios.',
			decision: 'Use to motivate Q3 ship-or-cut decision.',
			reasoning: 'Without time as a first-class concept, time-decay collapses into "two scenarios with different values".',
			nodes: {
				voice_full_duplex: {
					values: {
						selfValue: 3
					}
				}
			}
		},

		// Uncertainty branch: agent_framework_v1 might ship at 60% value, 1.5x cost.
		'agent-framework-disappoints': {
			description: 'Workaround: agent_framework_v1 ships at 60% value (9->5.4) and 1.5x cost (8->12). Represents the "real branch" implied by its 0.4 certainty.',
			decision: 'Risk-side comparator for the agent bet.',
			reasoning: 'Schema certainty is a scalar; this scenario materializes the downside outcome explicitly.',
			nodes: {
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
		// extension of multimodal-core that just reduces voice_full_duplex's
		// engineering cost by 2.
		'multimodal-core-after-moats': {
			description: 'Workaround: multimodal-core, but assuming defensive-moats already shipped voice_in_inhouse (saves 2pw on voice integration).',
			extends: 'multimodal-core',
			decision: 'Path-dependent transition scenario.',
			reasoning: 'Encodes the "scenario carry-over" semantic by extending the target scenario and shaving the cost off the integration node.',
			nodes: {
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
