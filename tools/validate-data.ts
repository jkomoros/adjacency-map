import { spawnSync } from 'child_process';

const main = async () => {
	// Re-generate the manifest so we pick up any new files / sidecars.
	const gen = spawnSync('npm', ['run', 'generate:config'], { stdio: 'inherit' });
	if (gen.status !== 0) {
		console.error('generate:config failed');
		process.exit(1);
	}

	// Dynamic import after regeneration.
	const generated = await import('../src/data.GENERATED.js');
	const { AdjacencyMap } = await import('../src/adjacency-map.js');
	const DATA = generated.DATA as Record<string, any>;
	const SIDECAR_EDITS = (generated.SIDECAR_EDITS || {}) as Record<string, any>;

	let failures = 0;

	for (const filename of Object.keys(DATA)) {
		const baseRaw = DATA[filename];
		const sidecar = SIDECAR_EDITS[filename] || {};
		const merged = {
			...baseRaw,
			scenarios: { ...(baseRaw.scenarios || {}), ...sidecar }
		};

		// Build the validatable scenario name list. Array-valued scenarios are
		// expanded by processMapDefinition into name_0, name_1, ... so we don't
		// instantiate them by the raw key; we instantiate each expansion.
		const scenarioNames : string[] = [''];
		for (const [name, def] of Object.entries(merged.scenarios || {})) {
			if (Array.isArray(def)) {
				for (let i = 0; i < def.length; i++) scenarioNames.push(`${name}_${i}`);
			} else {
				scenarioNames.push(name);
			}
		}

		for (const scenarioName of scenarioNames) {
			try {
				// eslint-disable-next-line @typescript-eslint/no-new
				new AdjacencyMap(merged, scenarioName);
			} catch (err) {
				failures++;
				const e = err as Error;
				console.error(`FAIL ${filename} [${scenarioName || '(base)'}]: ${e.message}`);
			}
		}
	}

	if (failures > 0) {
		console.error(`\n${failures} validation failure(s).`);
		process.exit(1);
	}
	console.log('All data files validate.');
};

main().catch(err => {
	console.error(err);
	process.exit(1);
});
