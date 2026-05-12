import { spawnSync } from 'child_process';

const main = async () => {
	const args = process.argv.slice(2);
	const fileArg = args[0];
	const scenarioArg = args[1] !== undefined ? args[1] : '';

	// Regenerate the manifest first so we pick up sidecars + new data files.
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

	if (!fileArg) {
		console.log('Usage: npm run inspect -- <file> [scenario]');
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

	// Resolve scenario name. Array-valued scenarios expand to name_0, name_1, ...
	const allScenarios : string[] = [''];
	for (const [name, def] of Object.entries(merged.scenarios || {})) {
		if (Array.isArray(def)) {
			for (let i = 0; i < def.length; i++) allScenarios.push(`${name}_${i}`);
		} else {
			allScenarios.push(name);
		}
	}
	if (!allScenarios.includes(scenarioArg)) {
		console.error(`Unknown scenario '${scenarioArg}' in ${fileArg}. Available: ${allScenarios.map(s => s || '(base)').join(', ')}`);
		process.exit(1);
	}

	const map = new AdjacencyMap(merged, scenarioArg);
	const baseMap = scenarioArg ? new AdjacencyMap(merged, '') : null;

	const out : string[] = [];
	out.push(`File: ${fileArg}`);
	out.push(`Scenario: ${scenarioArg || '(base)'}`);
	if (map.scenario && map.scenario.description) out.push(`Description: ${map.scenario.description}`);
	out.push(`Map description: ${map.description || '(none)'}`);
	out.push('');

	const nodeIDs = Object.keys(map.nodes).filter(id => id !== '');
	out.push(`Nodes: ${nodeIDs.length}`);
	const removed = (map as any)._removedNodeIDs as Set<string>;
	if (removed && removed.size > 0) out.push(`Removed in scenario: ${[...removed].join(', ')}`);
	out.push(`Edges: ${map.edges.length}`);
	out.push('');

	out.push('Root aggregate values:');
	const result = map.result;
	for (const [k, v] of Object.entries(result)) {
		const num = typeof v === 'number' ? v.toFixed(2) : String(v);
		out.push(`  ${k.padEnd(16)} ${num}`);
	}
	out.push('');

	// Top 5 nodes by 'value' (or whatever property looks like a leaderboard candidate).
	const candidateMetric = 'value' in result ? 'value' : Object.keys(result)[0];
	if (candidateMetric) {
		const ranked = nodeIDs.map(id => {
			const nv = map.node(id).values || {};
			return { id, score: typeof nv[candidateMetric] === 'number' ? nv[candidateMetric] as number : 0 };
		}).sort((a, b) => b.score - a.score).slice(0, 5);
		out.push(`Top 5 by ${candidateMetric}:`);
		for (const r of ranked) {
			out.push(`  ${r.id.padEnd(24)} ${r.score.toFixed(2)}`);
		}
		out.push('');
	}

	if (baseMap) {
		out.push('Modified from base scenario:');
		let anyDiff = false;
		const allIDs = new Set([...Object.keys(map.nodes), ...Object.keys(baseMap.nodes)]);
		for (const id of allIDs) {
			if (id === '') continue;
			const inBase = id in baseMap.nodes;
			const inThis = id in map.nodes;
			if (!inBase && inThis) { out.push(`  + ${id} (added)`); anyDiff = true; continue; }
			if (inBase && !inThis) { out.push(`  - ${id} (removed)`); anyDiff = true; continue; }
			const bv = baseMap.node(id).values || {};
			const tv = map.node(id).values || {};
			for (const k of new Set([...Object.keys(bv), ...Object.keys(tv)])) {
				const a = bv[k];
				const b = tv[k];
				if (typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) > 1e-9) {
					out.push(`  ~ ${id}.${k}: ${a.toFixed(2)} -> ${b.toFixed(2)} (${(b - a >= 0 ? '+' : '')}${(b - a).toFixed(2)})`);
					anyDiff = true;
				} else if (a !== b && typeof a !== 'number' && typeof b !== 'number') {
					out.push(`  ~ ${id}.${k}: ${JSON.stringify(a)} -> ${JSON.stringify(b)}`);
					anyDiff = true;
				}
			}
		}
		if (!anyDiff) out.push('  (no value diffs from base)');
		out.push('');
	}

	console.log(out.join('\n'));
};

main().catch(err => {
	console.error(err);
	process.exit(1);
});
