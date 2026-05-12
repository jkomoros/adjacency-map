# Chartwise Roadmap — Test Scenario for Adjacency-Map

*Faux scenario invented as a stress-test for the adjacency-map planning tool. Domain: a clinical decision support platform integrating with EHRs (Epic, Cerner, Athenahealth), providing risk scoring and recommendations for clinicians. ~30 people across clinical-research, ML, EHR-integration, compliance, customer-success teams. ~6-quarter horizon.*

## Nodes (capability milestones)

| id | description | eng_cost (pw) | value | certainty | deps | tags |
|---|---|---|---|---|---|---|
| `hipaa_baa_framework` | Standardized HIPAA BAA + DPIA templates plus signing workflow with customers. | 3 | 4 | 0.9 | — | compliance |
| `soc2_type2` | Achieve SOC 2 Type II attestation (continuous controls, 6-mo observation). | 8 | 6 | 0.7 | `hipaa_baa_framework` | compliance, infra |
| `ml_platform_v1` | Shared training, feature-store, model-registry, and shadow-deploy pipeline for all risk models. | 12 | 5 | 0.6 | — | ml, infra |
| `sepsis_model_retro` | Sepsis early-warning model validated on retrospective MIMIC + 2 customer datasets. | 6 | 5 | 0.5 | `ml_platform_v1` | ml, clinical |
| `readmit_model_retro` | 30-day readmission risk model, retrospective validation only. | 5 | 4 | 0.5 | `ml_platform_v1` | ml, clinical |
| `hf_model_retro` | Heart-failure decompensation model, retrospective validation. | 6 | 5 | 0.4 | `ml_platform_v1` | ml, clinical |
| `epic_integration` | Bidirectional Epic integration via FHIR + Hyperspace SMART-on-FHIR launch. | 14 | 9 | 0.5 | `hipaa_baa_framework` | ehr-integration |
| `cerner_integration` | Cerner/Oracle Health integration via FHIR R4 + CCL where needed. | 9 | 6 | 0.6 | `hipaa_baa_framework` | ehr-integration |
| `athena_integration` | Athenahealth marketplace app + FHIR integration. | 5 | 4 | 0.7 | `hipaa_baa_framework` | ehr-integration |
| `irb_master_protocol` | Master IRB protocol covering prospective studies across modeled conditions. | 4 | 3 | 0.7 | — | clinical, compliance |
| `sepsis_rct` | Multi-site RCT for sepsis model; primary endpoint = time-to-antibiotic. | 10 | 9 | 0.3 | `sepsis_model_retro`, `irb_master_protocol`, `epic_integration` | clinical |
| `fda_pre_sub` | FDA Q-sub meeting and pre-submission package for Class II SaMD path. | 3 | 4 | 0.6 | — | compliance |
| `fda_510k_sepsis` | 510(k) clearance for sepsis model as Class II SaMD. | 14 | 8 | 0.3 | `fda_pre_sub`, `sepsis_model_retro` | compliance, clinical |
| `cds_exemption_posture` | Legal + product packaging to qualify as non-device CDS under 21st-Century-Cures. | 3 | 5 | 0.6 | — | compliance |
| `pilot_customer_y` | Live deployment at Customer Y (Epic site, sepsis, demands prospective evidence). | 6 | 8 | 0.4 | `epic_integration`, `sepsis_model_retro` | customer |

## Scenarios (strategic bets)

1. **Single-Score, Multi-EHR** — Sepsis everywhere. Ship `sepsis_model_retro` on all three EHRs; defer HF/readmit; skip FDA via `cds_exemption_posture`. Drops `hf_model_retro`, `readmit_model_retro`, `fda_510k_sepsis`, `sepsis_rct`. Rationale: maximize reachable beds, minimize regulatory drag.
2. **Epic-Deep, Multi-Score** — Pick Epic, ship 3 models there. Includes all `*_model_retro`, `epic_integration`, `pilot_customer_y`; drops Cerner/Athena. Rationale: integration cost dominates; amortize one integration over many models.
3. **Regulatory Moat** — Pursue `fda_pre_sub` + `fda_510k_sepsis`. Adds 14 pw and pushes sepsis launch ~2 quarters, but raises sepsis `value` from 5 → 9 and `certainty` from 0.5 → 0.75 (clearance signals trustworthiness).
4. **Research-Led** — Run `sepsis_rct`. Raises sepsis-related node values by ~30% if positive; certainty becomes bimodal (very high or very low).
5. **Land-and-Expand** — `athena_integration` + `readmit_model_retro` only; cheap, fast, low ACV. Defer everything heavy. Drops Epic, FDA, RCT.
6. **Compliance-First Platform** — `soc2_type2` + `hipaa_baa_framework` + `cds_exemption_posture` before any clinical work. Makes nothing shippable in Q1-Q2 but unblocks enterprise sales later.

## Where the current data model gets uncomfortable

- **Conditional value.** `sepsis_model_retro` has value 5 standalone, but ~9 *conditional on* `sepsis_rct` succeeding. The model needs to express "value | parent succeeded" vs. "value | parent absent," not a single scalar.
- **Shared infrastructure / cost amortization.** `ml_platform_v1` (12 pw) is a true dependency of `sepsis_model_retro`, `readmit_model_retro`, and `hf_model_retro`. In a naive DAG its cost is counted once, but if we *drop* two of the three models, its effective per-model cost should rise — there's no way today to say "this cost is justified only above N downstream consumers."
- **Mutually-exclusive unblockers (regulatory fan-out).** `pilot_customer_y` is unblocked by *either* `fda_510k_sepsis` *or* `cds_exemption_posture` — an OR-edge, not AND. Same for the other two future pilot customers. The graph needs typed edges (AND/OR/XOR).
- **Customer-as-scenario vs. customer-as-constraint.** Customer Y requires Epic + sepsis + prospective evidence. Is "Customer Y" a node, a scenario, or a *constraint set* layered on top? Encoding them as nodes inflates the graph linearly with sales pipeline.
- **Sequential learning / cost decay.** After `epic_integration` ships, `cerner_integration` cost should drop ~30% (shared FHIR plumbing, learned ops). Today `cerner_integration` has a fixed 9 pw regardless of order. We need cost-as-function-of-predecessors.
- **Compound milestones.** `fda_510k_sepsis` is really {pre-sub response, predicate analysis, V&V protocol, clinical eval report, labeling, submission, FDA Q&A}. Treating it atomically hides 6-month sequencing risk; expanding it pollutes the high-level view.
- **Speed/certainty trade-off.** `sepsis_model_retro` is cheap+weak (certainty 0.5); `sepsis_rct` is expensive+strong. They're not alternatives — RCT *consumes* the retro model — but they represent the same decision axis (how much evidence to buy).
- **Resource constraints (team capacity).** Clinical-research team = 4 FTE, max 2 concurrent studies. A scenario that schedules `sepsis_rct` + an HF prospective study + IRB work in the same quarter is *graph-valid but resource-infeasible*. No per-team capacity envelope exists today.
- **Optionality value.** `fda_pre_sub` (3 pw) has low direct value but preserves the option to pursue 510(k) later. In scenarios that don't end up doing the 510(k), the pre-sub still had nonzero expected value at decision time. The model treats unused nodes as wasted cost.
- **Probabilistic AND-dependencies.** `pilot_customer_y` "depends on" Epic integration *and* sepsis model — but pilot success probability is roughly P(integration works in their env) × P(clinical signal holds in their population) ≈ 0.7 × 0.6 = 0.42, not a Boolean. The graph says "ready"; reality says "42% likely to convert."
