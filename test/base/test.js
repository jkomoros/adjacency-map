/*eslint-env node*/

import {
	randomString
} from '../../src/util.js';

import {
	makeSeededRandom
} from '../../src/random.js';

import assert from 'assert';

describe('randomString', () => {
	it('handles 1.0 / 1.0', async () => {
		const rnd = makeSeededRandom('');
		const result = randomString(3, rnd);
		const golden = '270';
		assert.deepStrictEqual(result, golden);
	}); 
});