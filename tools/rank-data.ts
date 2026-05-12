import { spawnSync } from 'child_process';

const main = async () => {
	const args = process.argv.slice(2);
	const fileArg = args[0];
	const propArg = args[1];
	const ascending = args.includes('--ascending') || args.includes('-a');

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

	if (!fileArg || !propArg) {
		console.log('Usage: npm run rank -- <file> <property> [--ascending]');
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

	type Row = { scenario : string, value : number, ok : boolean, err? : string, expected? : boolean };
	const rows : Row[] = [];
	// First pass: determine which scenarios are branches (have a `branchOf`).
	// Branches are folded into their parent's row via expected-value rather
	// than being ranked as freestanding scenarios — the parent's expected
	// value already accounts for the branch's contribution.
	const branchScenarios = new Set<string>();
	for (const [name, def] of Object.entries(merged.scenarios || {}) as [string, any][]) {
		const defs = Array.isArray(def) ? def : [def];
		for (let i = 0; i < defs.length; i++) {
			const d = defs[i];
			if (d && d.branchOf !== undefined) {
				branchScenarios.add(Array.isArray(def) ? `${name}_${i}` : name);
			} else if (d && d.probability !== undefined) {
				// probability without branchOf implies branchOf:'' (a branch
				// off the base). Mirror the runtime semantic here.
				branchScenarios.add(Array.isArray(def) ? `${name}_${i}` : name);
			}
		}
	}
	for (const s of allScenarios) {
		if (branchScenarios.has(s)) continue;
		try {
			const map = new AdjacencyMap(merged, s);
			let isExpected = false;
			let v : any;
			// If this scenario has branches off it, use the expected-value
			// computation rather than its own result so the rank reflects
			// probability-weighted reality.
			const siblings = (map as any).branchSiblings(s) as string[];
			if (siblings && siblings.length > 0) {
				const expected = (map as any).expectedValueAcrossBranches(s) as Record<string, number>;
				v = expected[propArg];
				isExpected = true;
			} else {
				const result = map.result || {};
				v = (result as any)[propArg];
			}
			if (typeof v !== 'number') {
				rows.push({ scenario: s, value: NaN, ok: false, err: `property '${propArg}' is not numeric (got ${typeof v})` });
				continue;
			}
			rows.push({ scenario: s, value: v, ok: true, expected: isExpected });
		} catch (err) {
			rows.push({ scenario: s, value: NaN, ok: false, err: (err as Error).message });
		}
	}

	const valid = rows.filter(r => r.ok);
	const invalid = rows.filter(r => !r.ok);
	valid.sort((a, b) => ascending ? a.value - b.value : b.value - a.value);

	const out : string[] = [];
	out.push(`File: ${fileArg}`);
	out.push(`Ranking by: ${propArg} (${ascending ? 'ascending' : 'descending'})`);
	out.push('');
	if (valid.length === 0) {
		out.push(`No scenarios have a numeric '${propArg}' value.`);
	}
	for (const row of valid) {
		const marker = row.expected ? '  E' : '   ';
		out.push(`  ${(row.scenario || '(base)').padEnd(28)} ${row.value.toFixed(2).padStart(10)}${marker}`);
	}
	if (valid.some(r => r.expected)) {
		out.push('');
		out.push('  E = expected value across probabilistic branch group');
	}
	if (branchScenarios.size > 0) {
		out.push('');
		out.push(`Folded into branch parents (${branchScenarios.size}): ${[...branchScenarios].join(', ')}`);
	}
	if (invalid.length > 0) {
		out.push('');
		out.push('Skipped:');
		for (const row of invalid) {
			out.push(`  ${(row.scenario || '(base)').padEnd(28)} ${row.err}`);
		}
	}

	console.log(out.join('\n'));
};

main().catch(err => {
	console.error(err);
	process.exit(1);
});
