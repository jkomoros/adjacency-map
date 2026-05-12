# Stockwise Robotics Roadmap (Test Scenario)

*Faux scenario invented as a stress-test for the adjacency-map planning tool. Domain: an autonomous mobile warehouse-picking robot. ~25 people across hardware, software, ML, ops, customer-pilot teams. ~6-quarter horizon.*

## Nodes

| id | description | cost (pw) | value | certainty | deps | tags |
|---|---|---|---|---|---|---|
| `chassis_v1` | Ship the v1 drive base with LIDAR + bumper sensors. | 40 (HW) | 8 | 0.8 | — | hardware, navigation |
| `gripper_v1_suction` | Single-suction-cup gripper for rigid boxed goods. | 25 (HW) | 7 | 0.7 | `chassis_v1` | hardware, manipulation |
| `gripper_v2_multimodal` | Suction + parallel-jaw hybrid end-effector for mixed SKUs. | 60 (HW) | 9 | 0.4 | `gripper_v1_suction` | hardware, manipulation |
| `nav_warehouse_slam` | SLAM + path planning in a known warehouse with people present. | 12 | 8 | 0.7 | `chassis_v1` | navigation, software |
| `perception_rigid_v1` | Detect + pose-estimate rigid boxed items on shelves. | 10 | 7 | 0.8 | `chassis_v1` | ml, perception |
| `perception_deformable` | Grasp-point prediction for bags, soft polybags, produce. | 8-30 | 9 | 0.3 | `perception_rigid_v1`, `gripper_v2_multimodal` | ml, perception, research |
| `perception_transparent` | Reliable detection of clear/reflective items (bottles, clamshells). | 8-25 | 7 | 0.25 | `perception_rigid_v1` | ml, perception, research |
| `fleet_mgmt_v1` | Multi-robot orchestrator: task assignment, traffic, charging. | 14 | 9 | 0.6 | `nav_warehouse_slam` | software, ops |
| `battery_swap_station` | Autonomous battery-swap dock for 24/7 operation. | 30 (HW) | 6 | 0.5 | `chassis_v1`, `fleet_mgmt_v1` | hardware, ops |
| `safety_ul3100_cert` | UL 3100 + OSHA functional-safety certification. | 10 | 10 | 0.5 | `chassis_v1`, `nav_warehouse_slam` | safety, regulatory |
| `wms_sap_ewm` | Integration with SAP EWM (enterprise customers). | 6 | 7 | 0.8 | `fleet_mgmt_v1` | customer, integration |
| `wms_manhattan` | Integration with Manhattan Active WM (3PLs). | 6 | 6 | 0.8 | `fleet_mgmt_v1` | customer, integration |
| `wms_customx_legacy` | Custom integration for lighthouse customer's homegrown WMS. | 9 | 5 | 0.7 | `fleet_mgmt_v1` | customer, integration |
| `fast_pick_120pph` | Tuning + planning stack to sustain 120 picks/hour/robot. | 12 | 8 | 0.5 | `perception_rigid_v1`, `gripper_v2_multimodal` | software, performance |
| `pilot_deployment` | First paid pilot at customer site, on-site ops team. | 8 | 10 | 0.6 | `safety_ul3100_cert`, any `wms_*` | customer, ops |

## Scenarios

1. **Lighthouse-at-all-costs** — ship exactly what AcmeCo needs to sign. *Rationale:* revenue + reference. *In:* `wms_customx_legacy`, `gripper_v1_suction`, `perception_rigid_v1`, `safety_ul3100_cert`, `pilot_deployment`. *Out:* `wms_sap_ewm`, `wms_manhattan`, `perception_deformable`. Certainty on `pilot_deployment` rises to 0.85 (we have direct PM access).

2. **Horizontal platform** — only build cross-customer capabilities. *In:* both standard `wms_*`, `fleet_mgmt_v1`, `fast_pick_120pph`. *Out:* `wms_customx_legacy`, `perception_transparent` (too vertical). Value of `fleet_mgmt_v1` rises to 10.

3. **ML-first moat** — bet on deformable + transparent perception. *In:* `gripper_v2_multimodal`, `perception_deformable`, `perception_transparent`. *Out:* `battery_swap_station`, `wms_manhattan`. Cost certainty drops; uncertainty on perception nodes drops to 0.5 *if* we hire two senior researchers.

4. **Safety-and-reliability first** — five-nines before features. *In:* `safety_ul3100_cert` (expanded), `battery_swap_station`, `fleet_mgmt_v1`. *Out:* `perception_deformable`, `fast_pick_120pph`. Value of `safety_ul3100_cert` rises to 10 (becomes the marketing story).

5. **Hardware refresh (v2)** — invest now in `gripper_v2_multimodal` + new wrist cam. *In:* `gripper_v2_multimodal`, `perception_deformable`. *Out:* `pilot_deployment` this year. Re-baselines downstream ML cost downward by ~30%.

6. **Grocery vertical push** — chase the grocery 3PL segment. Requires `perception_deformable` × `perception_transparent` × `fast_pick_120pph` *together*; none alone unlocks it.

## Where the current data model gets uncomfortable

- **HW/SW enablement vs. hard dependency.** `gripper_v2_multimodal` *enables* `perception_deformable` (different training data, new action space) but `perception_deformable` could ship in a degraded form on v1 hardware. A binary edge over-constrains; a "soft enabler" with a value multiplier is what I actually mean.
- **Capability tiers.** I want `perception_rigid_v1/v2/v3` where each tier raises value and lowers risk, but a customer pilot may only need v1. Edges between tiers aren't really blockers — they're upgrade paths.
- **Range-valued cost.** `perception_deformable` is 8-30 person-weeks. The distribution matters for portfolio planning; a point estimate hides the bet.
- **One-to-many safety blocker.** `safety_ul3100_cert` blocks every customer-facing node. Correct, but visually it dominates the graph and obscures real structure. I'd want to fold safety into a "gate band" rather than draw 8 edges.
- **Customer-specific nodes pollute the shared map.** `wms_customx_legacy` only matters under scenario 1. Including it in the global map skews totals; excluding it loses the dependency on `fleet_mgmt_v1`.
- **Combinatorial segment unlocks.** Grocery vertical requires `perception_deformable` AND `perception_transparent` AND `fast_pick_120pph` *simultaneously*; the value is in the conjunction, not any single node. Today I'd have to invent a synthetic "grocery_unlock" node with three parents, which is a hack.
- **Bottleneck propagation.** `fleet_mgmt_v1` gates every multi-robot capability (incl. `battery_swap_station`, all WMS integrations). Its risk should propagate; a single low-certainty node shouldn't have crisp downstream certainty.
- **Diminishing marginal value.** First autonomous picking capability is worth ~70% of the category's value; the second adds 20%, the third 10%. The flat per-node value field can't express this.
- **Hard deadlines.** `pilot_deployment` before Q3 peak season is worth 10; after, it's worth 3. There's no time-decay on value.
- **Inter-team handoff lag.** ML hand-off to ops adds 4 weeks regardless of effort. Cost-in-person-weeks doesn't capture serialization between teams; the schedule reality is dominated by handoff latency, not headcount.
