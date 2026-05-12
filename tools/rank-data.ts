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

	type Row = { scenario : string, value : number, ok : boolean, err? : string };
	const rows : Row[] = [];
	for (const s of allScenarios) {
		try {
			const map = new AdjacencyMap(merged, s);
			const result = map.result || {};
			const v = (result as any)[propArg];
			if (typeof v !== 'number') {
				rows.push({ scenario: s, value: NaN, ok: false, err: `property '${propArg}' is not numeric (got ${typeof v})` });
				continue;
			}
			rows.push({ scenario: s, value: v, ok: true });
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
		out.push(`  ${(row.scenario || '(base)').padEnd(28)} ${row.value.toFixed(2).padStart(10)}`);
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
