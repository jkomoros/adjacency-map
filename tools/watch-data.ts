import chokidar from 'chokidar';
import { spawnSync } from 'child_process';

const DATA_GLOB = 'data/**/*.{ts,json}';

const regenerate = (path : string) => {
	console.log(`[watch-data] change detected in ${path}; regenerating data manifest`);
	const result = spawnSync('npm', ['run', 'generate:config'], { stdio: 'inherit' });
	if (result.status !== 0) {
		console.warn('[watch-data] generate:config failed');
	}
};

console.log('[watch-data] watching', DATA_GLOB);
const watcher = chokidar.watch(DATA_GLOB, { ignoreInitial: true }) as any;
watcher.on('add', regenerate);
watcher.on('change', regenerate);
watcher.on('unlink', regenerate);
