/*eslint-env node*/

import {
	AdjacencyMap
} from '../../src/adjacency-map.js';

import assert from 'assert';

const legalBaseInput = {
	"version": 1,
	"types": {
		"engineering": {
			"value": 3,
			"weight": 1.0
		}
	},
	"root": {
		"engineering" : 4.0
	},
	"nodes": {
		"a": {
			"description": "Node a",
			"values": [
				{
					"type": "engineering",
					"weight": 4.0
				},
				{
					"type": "engineering"
				}
			]
		}
	}
};

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

	it('barfs on no nodes', async () => {
		const input = Object.fromEntries(Object.entries(legalBaseInput).filter(entry => entry[0] != 'nodes'));
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

	it('barfs on undefined types', async () => {
		const input = Object.fromEntries(Object.entries(legalBaseInput).filter(entry => entry[0] != 'types'));
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

	it('barfs on empty types', async () => {
		const input = {...legalBaseInput, types: {}};
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

	it('allows base input', async () => {
		const input = legalBaseInput;
		const errorExpected = false;
		const fn = () => {
			new AdjacencyMap(input);
		};
		if (errorExpected) {
			assert.throws(fn);
		} else {
			assert.doesNotThrow(fn);
		}
	});

	it('allows base input with node with no values', async () => {
		const input = {...legalBaseInput};
		delete input.nodes.a.values;
		const errorExpected = false;
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