/*eslint-env node*/

import {
	AdjacencyMap
} from '../../src/adjacency-map.js';

import assert from 'assert';

describe('AdjacencyMap', () => {
	it('barfs on null data', async () => {
		const input = null;
		const errorExpected = true;
		const fn = () => {
			new AdjacencyMap(input);
		};
		if (errorExpected) {
			assert.throws(fn);
		} else {
			assert.doesNotThrow(fn);
		}
	}); 
});