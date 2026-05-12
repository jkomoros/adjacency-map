import { writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

const STATE_SIDECAR_PATH = join(tmpdir(), 'adjacency-state.json');

// Koa-style middleware that handles POST /__state__ by writing the request
// body to /tmp/adjacency-state.json. Lets the webapp publish its current view
// (file, scenario, selection, etc.) to a file agents can read.
const stateSidecarMiddleware = async (ctx, next) => {
	if (ctx.method === 'POST' && ctx.path === '/__state__') {
		try {
			const chunks = [];
			for await (const chunk of ctx.req) chunks.push(chunk);
			const body = Buffer.concat(chunks).toString('utf8');
			// Validate it's JSON before writing.
			JSON.parse(body);
			await writeFile(STATE_SIDECAR_PATH, body);
			ctx.status = 204;
		} catch (err) {
			ctx.status = 400;
			ctx.body = String(err && err.message || err);
		}
		return;
	}
	await next();
};

export default {
	//File to return for any path that would otherwise 404
	appIndex: 'dist/index.html',
	rootDir: 'dist',
	//Flags for --node-resolve (options at https://www.npmjs.com/package/rollup-plugin-node-resolve-main-fields)
	nodeResolve: {
		/* reselect-map has an ESG export at jsnext */
		mainFields: ['jsnext:main', 'module', 'main']
	},
	middleware: [stateSidecarMiddleware]
};
