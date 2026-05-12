import { spawnSync } from 'child_process';

const main = async () => {
	const args = process.argv.slice(2);
	const fileArg = args[0];
	const aArg = args[1];
	const bArg = args[2];

	const gen = spawnSync('npm', ['run', 'generate:config'], { stdio: 'pipe' });
	if (gen.status !== 0) {
		console.error('generate:config failed');
		process.stderr.write(gen.stderr?.toString() || '');
		process.exit(1);
	}

	const generated = await import('../src/data.GENERATED.js');
	const { AdjacencyMap } = await import('../src/adjacency-map.js');
	const DATA = generated.DATA as Record<string, any>;
	const SIDECAR_EDITS = (generated.SIDECAR_EDITS || {}) as Record<string, any>;

	if (!fileArg || aArg === undefined || bArg === undefined) {
		console.log('Usage: npm run diff -- <file> <scenarioA> <scenarioB>');
		console.log('Use "" (empty string) for the base scenario.');
		console.log('Files:', Object.keys(DATA).join(', '));
		process.exit(0);
	}
	if (!(fileArg in DATA)) {
		console.error(`Unknown file: ${fileArg}. Available: ${Object.keys(DATA).join(', ')}`);
		process.exit(1);
	}

	const baseRaw = DATA[fileArg];
	const sidecar = SIDECAR_EDITS[fileArg] || {};
	const merged = {
		...baseRaw,
		scenarios: { ...(baseRaw.scenarios || {}), ...sidecar }
	};

	// Expand array-valued scenarios into name_0, name_1, ...
	const allScenarios : string[] = [''];
	for (const [name, def] of Object.entries(merged.scenarios || {})) {
		if (Array.isArray(def)) {
			for (let i = 0; i < def.length; i++) allScenarios.push(`${name}_${i}`);
		} else {
			allScenarios.push(name);
		}
	}
	for (const s of [aArg, bArg]) {
		if (!allScenarios.includes(s)) {
			console.error(`Unknown scenario '${s}' in ${fileArg}. Available: ${allScenarios.map(x => x || '(base)').join(', ')}`);
			process.exit(1);
		}
	}

	const mapA = new AdjacencyMap(merged, aArg);
	const mapB = new AdjacencyMap(merged, bArg);
	const out : string[] = [];

	out.push(`File: ${fileArg}`);
	out.push(`A: ${aArg || '(base)'}  ${mapA.scenario && mapA.scenario.description ? '— ' + mapA.scenario.description : ''}`);
	out.push(`B: ${bArg || '(base)'}  ${mapB.scenario && mapB.scenario.description ? '— ' + mapB.scenario.description : ''}`);

	// Decision/reasoning context if either side has it.
	for (const [label, scenario] of [['A', mapA.scenario], ['B', mapB.scenario]] as [string, any][]) {
		if (scenario && (scenario.decision || scenario.reasoning)) {
			if (scenario.decision) out.push(`  ${label}.decision:  ${scenario.decision}`);
			if (scenario.reasoning) out.push(`  ${label}.reasoning: ${scenario.reasoning}`);
		}
	}
	out.push('');

	// Per-property aggregate deltas at root.
	out.push('Aggregate (A / B / delta):');
	const resA = mapA.result || {};
	const resB = mapB.result || {};
	const allProps = new Set([...Object.keys(resA), ...Object.keys(resB)]);
	for (const k of allProps) {
		const a = typeof (resA as any)[k] === 'number' ? (resA as any)[k] as number : 0;
		const b = typeof (resB as any)[k] === 'number' ? (resB as any)[k] as number : 0;
		if (Math.abs(a) < 1e-9 && Math.abs(b) < 1e-9) continue;
		const d = b - a;
		const sign = d >= 0 ? '+' : '';
		out.push(`  ${k.padEnd(20)} ${a.toFixed(2).padStart(9)} ${b.toFixed(2).padStart(9)} ${(sign + d.toFixed(2)).padStart(9)}`);
	}
	out.push('');

	// Per-node value deltas + added/removed.
	out.push('Per-node:');
	let anyNodeDiff = false;
	const allNodeIDs = new Set([...Object.keys(mapA.nodes), ...Object.keys(mapB.nodes)]);
	for (const id of allNodeIDs) {
		if (id === '') continue;
		const inA = id in mapA.nodes;
		const inB = id in mapB.nodes;
		if (inA && !inB) { out.push(`  - ${id} (only in A)`); anyNodeDiff = true; continue; }
		if (!inA && inB) { out.push(`  + ${id} (only in B)`); anyNodeDiff = true; continue; }
		const av = mapA.node(id).values || {};
		const bv = mapB.node(id).values || {};
		const keys = new Set([...Object.keys(av), ...Object.keys(bv)]);
		for (const k of keys) {
			const a = (av as any)[k];
			const b = (bv as any)[k];
			if (typeof a === 'number' && typeof b === 'number') {
				if (Math.abs(a - b) > 1e-9) {
					const sign = b - a >= 0 ? '+' : '';
					out.push(`  ~ ${id}.${k}: ${a.toFixed(2)} -> ${b.toFixed(2)} (${sign}${(b - a).toFixed(2)})`);
					anyNodeDiff = true;
				}
			} else if (a !== b && typeof a !== 'number' && typeof b !== 'number') {
				out.push(`  ~ ${id}.${k}: ${JSON.stringify(a)} -> ${JSON.stringify(b)}`);
				anyNodeDiff = true;
			}
		}
	}
	if (!anyNodeDiff) out.push('  (no node-level diffs)');

	// Events: per-event presence deltas across the two scenarios.
	const eventDefs = (mapA.data && mapA.data.events) || {};
	const eventIDs = Object.keys(eventDefs);
	if (eventIDs.length > 0) {
		out.push('');
		out.push('Events:');
		let anyEventDiff = false;
		for (const id of eventIDs) {
			const a = (mapA as any).isEventPresent(id) as boolean;
			const b = (mapB as any).isEventPresent(id) as boolean;
			if (a !== b) {
				out.push(`  ~ ${id}.present: ${a} -> ${b}`);
				anyEventDiff = true;
			}
		}
		if (!anyEventDiff) out.push('  (no event-level diffs)');
	}

	console.log(out.join('\n'));
};

main().catch(err => {
	console.error(err);
	process.exit(1);
});
