import resolve from '@rollup/plugin-node-resolve';
import { terser } from 'rollup-plugin-terser';
import minifyHTML from 'rollup-plugin-minify-html-literals';
import copy from 'rollup-plugin-copy';
import commonjs from '@rollup/plugin-commonjs';
import summary from 'rollup-plugin-summary';
import dynamicImportVars from '@rollup/plugin-dynamic-import-vars';
import { importAssertionsPlugin } from 'rollup-plugin-import-assert';
import { importAssertions } from 'acorn-import-assertions';

export default {
	input: 'src/components/my-app.js',
	output: {
		dir: 'build/src/components',
		format: 'es',
	},
	acornInjectPlugins: [ importAssertions ],
	plugins: [
		minifyHTML(),
		importAssertionsPlugin(),
		dynamicImportVars(),
		copy({
			targets: [
				{ src: 'src/listings.json', dest: 'build/src' },
				{ src: 'images', dest: 'build' },
				{ src: 'fonts', dest: 'build' },
				{ src: 'manifest.json', dest: 'build' },
				{ src: 'index.html', dest: 'build' },
			],
		}),
		resolve(),
		terser({
			format: {
				comments: false,
			}
		}),
		commonjs(),
		summary(),
	],
	preserveEntrySignatures: 'strict',
};