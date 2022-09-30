/*eslint-env node*/

import {
	AdjacencyMap,
	extractSimpleGraph
} from '../../src/adjacency-map.js';

import {
	tidyLongestTree, treeGraphFromParentGraph
} from '../../src/graph.js';

import {
	deepCopy
} from '../../src/util.js';

import assert from 'assert';

const legalBaseInput = {
	"version": 1,
	"types": {
		"engineering": {
			"value": 3,
			"constants": {
				"weight": 1.0
			}
		},
		"ux": {
			"value": 4,
			"description": "A description of ux"
		},
		"data": {
			"value": 2,
			"description": "Investment in data quality"
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
		},
		"b": {
			"description": "Node b",
			"values": [
				{
					"type": "ux",
					"ref": "a"
				}
			]
		},
		"c": {
			"description": "Node c",
			"values": [
				{
					"type": "engineering",
					"ref": "a"
				},
				{
					"type": "ux",
					"ref": "b"
				}
			]
		},
		"d": {
			"description": "Node d",
			"values": [
				{
					"type": "engineering",
					"ref": "b"
				}
			]
		}
	}
};

describe('AdjacencyMap validation', () => {
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
		const input = deepCopy(legalBaseInput);
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

	it('barfs if you try to provide a rootID node directly', async () => {
		const input = deepCopy(legalBaseInput);
		input.nodes[''] = {description: 'invalid'};
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

	it('barfs for a node with a value without a type', async () => {
		const input = deepCopy(legalBaseInput);
		delete input.nodes.a.values[0].type;
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

	it('barfs for a node with a value with an unenumerated type', async () => {
		const input = deepCopy(legalBaseInput);
		input.nodes.a.values[0].type = 'foo';
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

	it('barfs for an edge with an illegal value definition', async () => {
		const input = deepCopy(legalBaseInput);
		input.types.engineering.value = 'invalid';
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

	it('barfs for a type with a non-string description', async () => {
		const input = deepCopy(legalBaseInput);
		input.types.ux.description = 5;
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

	it('barfs for a type with a non-number constant', async () => {
		const input = deepCopy(legalBaseInput);
		input.types.engineering.constants.weight = 'invalid';
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

	it('allows a missing root', async () => {
		const input = deepCopy(legalBaseInput);
		delete input.root;
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

	it('barfs for a root with a non-number key', async () => {
		const input = deepCopy(legalBaseInput);
		input.root.engineering = 'invalid';
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

	it('barfs for a root with a key not in types', async () => {
		const input = deepCopy(legalBaseInput);
		input.root.foo = 3;
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

	it('barfs for a graph with a direct cycle in it', async () => {
		const input = deepCopy(legalBaseInput);
		input.nodes.b.values.push({type: 'engineering', ref:'d'});
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

	it('barfs for a graph with an indirect cycle in it', async () => {
		const input = deepCopy(legalBaseInput);
		input.nodes.a.values.push({type: 'engineering', ref:'d'});
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

	it('barfs for an edge with a value of edge with illegal property', async () => {
		const input = deepCopy(legalBaseInput);
		input.types.engineering.value = {constant: 'ref'};
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

	it('barfs for an edge with a value of edge with constant that doesn\'t exist for that type', async () => {
		const input = deepCopy(legalBaseInput);
		input.types.engineering.value = {constant: 'foo'};
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

	it('allows edge with a value of edge with constant that does exist for that type', async () => {
		const input = deepCopy(legalBaseInput);
		input.types.engineering.value = {constant: 'weight'};
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

	it('barfs for edge with invalid combiner', async () => {
		const input = deepCopy(legalBaseInput);
		input.types.engineering.combine = 'foo';
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

	it('allows edge with valid combiner', async () => {
		const input = deepCopy(legalBaseInput);
		input.types.engineering.combine = 'first';
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

	it('allows value with array of numbers', async () => {
		const input = deepCopy(legalBaseInput);
		input.types.engineering.value = [1,2,3];
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

	it('barfs for value with array containing a non-number', async () => {
		const input = deepCopy(legalBaseInput);
		input.types.engineering.value = [1,2,'fail'];
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

	it('barfs for value with array of zero length', async () => {
		const input = deepCopy(legalBaseInput);
		input.types.engineering.value = [];
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

	it('barfs for TypeRef with non existing property', async () => {
		const input = deepCopy(legalBaseInput);
		input.types.engineering.value = {ref: 'foo'};
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

	it('allows TypeRef with existing property', async () => {
		const input = deepCopy(legalBaseInput);
		input.types.engineering.value = {ref: 'engineering'};
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

	it('barfs for dependency on a non-existent edge', async () => {
		const input = deepCopy(legalBaseInput);
		input.types.engineering.dependencies = ['foo'];
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

	it('barfs for dependency on self', async () => {
		const input = deepCopy(legalBaseInput);
		input.types.engineering.dependencies = ['engineering'];
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

	it('barfs for a dependency on a thing that depends directly on us', async () => {
		const input = deepCopy(legalBaseInput);
		input.types.engineering.dependencies = ['ux'];
		input.types.ux.dependencies = ['engineering'];
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

	it('barfs for a dependency on a thing that indirectly directly on us', async () => {
		const input = deepCopy(legalBaseInput);
		input.types.engineering.dependencies = ['ux'];
		input.types.ux.dependencies = ['data'];
		input.types.data.dependencies = ['engineering'];
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

	it('allows a dependency on another', async () => {
		const input = deepCopy(legalBaseInput);
		input.types.engineering.dependencies = ['ux'];
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

	it('allows a dependency on another that has a dependency', async () => {
		const input = deepCopy(legalBaseInput);
		input.types.engineering.dependencies = ['ux'];
		input.types.ux.dependencies = ['data'];
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

	it('allows a value defintion of type ResultValue that lists the dependency', async () => {
		const input = deepCopy(legalBaseInput);
		input.root = {data: 12};
		input.types.engineering.dependencies = ['data'];
		input.types.engineering.value = {result: 'data'};
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

	it('barfs on a value defintion of type ResultValue that does not list the dependency', async () => {
		const input = deepCopy(legalBaseInput);
		input.root = {data: 12};
		input.types.engineering.value = {result: 'data'};
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

	it('barfs on a value defintion of type combiner that has 0 children', async () => {
		const input = deepCopy(legalBaseInput);
		input.types.engineering.value = {
			combine: 'mean'
		};
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

	it('barfs on a value defintion of type combiner that an invalid combiner', async () => {
		const input = deepCopy(legalBaseInput);
		input.types.engineering.value = {
			combine: 'foo',
			child: [1]
		};
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

	it('barfs on a value defintion that includes a result ref without declared dependency', async () => {
		const input = deepCopy(legalBaseInput);
		input.types.engineering.value = {
			combine: 'min',
			child: { result: 'ux' }
		};
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

	it('Allows a valid value defintion of type combiner', async () => {
		const input = deepCopy(legalBaseInput);
		input.types.engineering.value = {
			combine: 'min',
			child: [3,4,5]
		};
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

	it('barfs for a value defintion of type arithmetic with invalid operator', async () => {
		const input = deepCopy(legalBaseInput);
		input.types.engineering.value = {
			operator: '&',
			child: [3, 4, 5],
			term: [1]
		};
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

	it('barfs for a value defintion of type arithmetic missing term', async () => {
		const input = deepCopy(legalBaseInput);
		input.types.engineering.value = {
			operator: '+',
			child: [3, 4, 5],
		};
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

	it('barfs for a value defintion of type arithmetic missing child', async () => {
		const input = deepCopy(legalBaseInput);
		input.types.engineering.value = {
			operator: '+',
			term: [1]
		};
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

	it('Allows a valid value defintion of type arithmetic', async () => {
		const input = deepCopy(legalBaseInput);
		input.types.engineering.value = {
			operator: '+',
			child: [3,4,5],
			term: [1]
		};
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

	it('barfs for a value defintion of type compare missing term', async () => {
		const input = deepCopy(legalBaseInput);
		input.types.engineering.value = {
			compare: '<=',
			child: [3, 4, 5]
		};
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

	it('barfs for a value defintion of type compare missing child', async () => {
		const input = deepCopy(legalBaseInput);
		input.types.engineering.value = {
			compare: '<=',
			term: [4]
		};
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

	it('barfs for a value defintion of type compare with invalid operator', async () => {
		const input = deepCopy(legalBaseInput);
		input.types.engineering.value = {
			compare: '===',
			child: [3, 4, 5],
			term: [4]
		};
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

	it('Allows a valid value defintion of type compare', async () => {
		const input = deepCopy(legalBaseInput);
		input.types.engineering.value = {
			compare: '<=',
			child: [3,4,5],
			term: [4]
		};
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

	it('barfs for defintion of type if missing then', async () => {
		const input = deepCopy(legalBaseInput);
		input.types.engineering.value = {
			if: [0, 1, 0],
			else: [5]
		};
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

	it('barfs for defintion of type if missing else', async () => {
		const input = deepCopy(legalBaseInput);
		input.types.engineering.value = {
			if: [0, 1, 0],
			then: [5]
		};
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

	it('Allows a valid value defintion of type if', async () => {
		const input = deepCopy(legalBaseInput);
		input.types.engineering.value = {
			if: [0, 1, 0],
			then: [3, 4],
			else: [5]
		};
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

	it('barfs for a value defintion of type clip missing input', async () => {
		const input = deepCopy(legalBaseInput);
		input.types.engineering.value = {
			low: 3,
			high: 10
		};
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

	it('barfs for a value defintion of type clip with niether low nor high', async () => {
		const input = deepCopy(legalBaseInput);
		input.types.engineering.value = {
			clip: [-10, 3, 100]
		};
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

	it('allows a value defintion of type clip with only low', async () => {
		const input = deepCopy(legalBaseInput);
		input.types.engineering.value = {
			clip: [-10, 3, 100],
			low: 0
		};
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

	it('allows a value defintion of type clip with only high', async () => {
		const input = deepCopy(legalBaseInput);
		input.types.engineering.value = {
			clip: [-10, 3, 100],
			high: 50
		};
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

	it('allows a value defintion of type clip with low and high', async () => {
		const input = deepCopy(legalBaseInput);
		input.types.engineering.value = {
			clip: [-10, 3, 100],
			low: 0,
			high: 50
		};
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

	it('barfs for a value defintion of type clip with no high', async () => {
		const input = deepCopy(legalBaseInput);
		input.types.engineering.value = {
			range: [-10, 3, 100],
			low: 3
		};
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

	it('barfs for a value defintion of type clip with no low', async () => {
		const input = deepCopy(legalBaseInput);
		input.types.engineering.value = {
			range: [-10, 3, 100],
			high: 50
		};
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

	it('allows a value defintion of type range with low and high', async () => {
		const input = deepCopy(legalBaseInput);
		input.types.engineering.value = {
			range: [-10, 3, 100],
			low: 0,
			high: 50
		};
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

	it('barfs for a value defintion of type percent with no high', async () => {
		const input = deepCopy(legalBaseInput);
		input.types.engineering.value = {
			percent: [-10, 3, 100],
			low: 50
		};
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

	it('barfs for a value defintion of type percent with no low', async () => {
		const input = deepCopy(legalBaseInput);
		input.types.engineering.value = {
			percent: [-10, 3, 100],
			high: 50
		};
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

	it('allows a value defintion of type percent with low and high', async () => {
		const input = deepCopy(legalBaseInput);
		input.types.engineering.value = {
			percent: [-10, 3, 100],
			low: 0,
			high: 50
		};
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

describe('AdjacencyMap root', () => {
	it('includes missing types from root', async () => {
		const input = deepCopy(legalBaseInput);
		const errorExpected = false;
		const fn = () => {
			new AdjacencyMap(input);
		};
		if (errorExpected) {
			assert.throws(fn);
		} else {
			assert.doesNotThrow(fn);
		}
		const map = new AdjacencyMap(input);
		const actual = map.rootValues;
		const golden = {
			"engineering": 4.0,
			"ux": 0.0,
			"data": 0.0
		};
		assert.deepStrictEqual(actual, golden);
	});

	it('handles edges correctly', async () => {
		const input = deepCopy(legalBaseInput);
		const map = new AdjacencyMap(input);
		const actual = map.edges;
		const golden = [
			{
				"ref": "",
				"source": "a",
				"type": "engineering",
				"weight": 4,
			},
			{
				"ref": "",
				"source": "a",
				"type": "engineering",
			},
			{
				"ref": "a",
				"source": "b",
				"type": "ux",
			},
			{
				"ref": "a",
				"source": "c",
				"type": "engineering",
			},
			{
				"ref": "b",
				"source": "c",
				"type": "ux",
			},
			{
				"ref": "b",
				"source": "d",
				"type": "engineering"
			}
		];
		assert.deepStrictEqual(actual, golden);
	});



});

describe('AdjacencyMap node', () => {
	it('allows a named node', async () => {
		const input = deepCopy(legalBaseInput);
		const map = new AdjacencyMap(input);
		const fn = () => {
			map.node('a');
		};
		assert.doesNotThrow(fn);
	});

	it('barfs for an unknown node', async () => {
		const input = deepCopy(legalBaseInput);
		const map = new AdjacencyMap(input);
		const fn = () => {
			map.node('NONEXISTENT');
		};
		assert.throws(fn);
	});

	it('values works for a named node', async () => {
		const input = deepCopy(legalBaseInput);
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.values;
		const golden = {
			engineering: 3,
			ux: 0,
			data: 0
		};
		assert.deepStrictEqual(actual, golden);
	});

	it('children for a named node', async () => {
		const input = deepCopy(legalBaseInput);
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.children;
		const golden = ['b', 'c'];
		assert.deepStrictEqual(actual, golden);
	});

	it('children for root node', async () => {
		const input = deepCopy(legalBaseInput);
		const map = new AdjacencyMap(input);
		const node = map.node('');
		const actual = node.children;
		const golden = ['a'];
		assert.deepStrictEqual(actual, golden);
	});

	it('works for root node', async () => {
		const input = deepCopy(legalBaseInput);
		const map = new AdjacencyMap(input);
		const node = map.node('');
		const actual = node.values;
		const golden = {
			engineering: 4,
			ux: 0,
			data: 0
		};
		assert.deepStrictEqual(actual, golden);
	});

	it('allows a named node with edge constant value', async () => {
		const input = deepCopy(legalBaseInput);
		input.types.engineering.value = {constant: 'weight'};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.values;
		const golden = {
			engineering: 2.5,
			ux: 0,
			data: 0
		};
		assert.deepStrictEqual(actual, golden);
	});

	it('allows a named node with non-default combiner', async () => {
		const input = deepCopy(legalBaseInput);
		//Give it a more interesting value.
		input.types.engineering.value = {constant: 'weight'};
		input.types.engineering.combine = 'first';
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.values;
		const golden = {
			engineering: 4.0,
			ux: 0,
			data: 0
		};
		assert.deepStrictEqual(actual, golden);
	});

	it('allows a named node with array of items', async () => {
		const input = deepCopy(legalBaseInput);
		input.types.engineering.value = [8,9];
		input.types.engineering.combine = 'first';
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.values;
		const golden = {
			engineering: 8.0,
			ux: 0,
			data: 0
		};
		assert.deepStrictEqual(actual, golden);
	});

	it('allows a named node with a RefValue', async () => {
		const input = deepCopy(legalBaseInput);
		input.types.engineering.value = {ref:'engineering'};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.values;
		const golden = {
			engineering: 4.0,
			ux: 0,
			data: 0
		};
		assert.deepStrictEqual(actual, golden);
	});

	it('allows a named node with last combiner', async () => {
		const input = deepCopy(legalBaseInput);
		//Give it a more interesting value.
		input.types.engineering.value = [1,2,10];
		input.types.engineering.combine = 'last';
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.values;
		const golden = {
			engineering: 10.0,
			ux: 0,
			data: 0
		};
		assert.deepStrictEqual(actual, golden);
	});

	it('allows a named node with min combiner', async () => {
		const input = deepCopy(legalBaseInput);
		//Give it a more interesting value.
		input.types.engineering.value = [1,-3,10];
		input.types.engineering.combine = 'min';
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.values;
		const golden = {
			engineering: -3.0,
			ux: 0,
			data: 0
		};
		assert.deepStrictEqual(actual, golden);
	});

	it('allows a named node with max combiner', async () => {
		const input = deepCopy(legalBaseInput);
		//Give it a more interesting value.
		input.types.engineering.value = [1,-3,10, 2];
		input.types.engineering.combine = 'max';
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.values;
		const golden = {
			engineering: 10.0,
			ux: 0,
			data: 0
		};
		assert.deepStrictEqual(actual, golden);
	});

	it('allows a named node with sum combiner', async () => {
		const input = deepCopy(legalBaseInput);
		//Give it a more interesting value.
		input.types.engineering.value = [1.5,-3,10, 2];
		input.types.engineering.combine = 'sum';
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.values;
		const golden = {
			engineering: 10.5,
			ux: 0,
			data: 0
		};
		assert.deepStrictEqual(actual, golden);
	});

	it('allows a named node with product combiner', async () => {
		const input = deepCopy(legalBaseInput);
		//Give it a more interesting value.
		input.types.engineering.value = [1.5,-3,10, 2];
		input.types.engineering.combine = 'product';
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.values;
		const golden = {
			engineering: -90,
			ux: 0,
			data: 0
		};
		assert.deepStrictEqual(actual, golden);
	});

	it('Correctly sorts edge types', async () => {
		const input = deepCopy(legalBaseInput);
		input.types.data.dependencies = ['engineering'];
		input.types.engineering.dependencies = ['ux'];
		const map = new AdjacencyMap(input);
		const actual = map.edgeTypes;
		const golden = ['ux', 'engineering', 'data'];
		assert.deepStrictEqual(actual, golden);
	});

	it('Tests a ResultValue ref calculation', async () => {
		const input = deepCopy(legalBaseInput);
		input.types.data.dependencies = ['engineering'];
		input.types.data.value = {result: 'engineering'};
		input.types.engineering.dependencies = ['ux'];
		input.types.engineering.value = {result: 'ux'};
		input.root = {'ux': 12};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.values;
		const golden = {
			engineering: 12,
			ux: 12,
			//Data is 0 because there is no data edge on node a, so it's just an implicit reference to its root.
			data: 0
		};
		assert.deepStrictEqual(actual, golden);
	});

	it('Tests a ResultValue ref calculation with two edges', async () => {
		const input = deepCopy(legalBaseInput);
		input.types.data.dependencies = ['engineering'];
		input.types.data.value = {result: 'engineering'};
		input.types.engineering.dependencies = ['ux'];
		input.types.engineering.value = {result: 'ux'};
		input.nodes.a.values.push({type: 'data'});
		input.root = {'ux': 12};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.values;
		const golden = {
			engineering: 12,
			ux: 12,
			data: 12
		};
		assert.deepStrictEqual(actual, golden);
	});

	it('Tests a ResultValue ref calculation with a combine type', async () => {
		const input = deepCopy(legalBaseInput);
		input.types.engineering.value = {
			combine: 'min',
			child: [1, 4, 5]
		};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.values;
		const golden = {
			engineering: 1,
			ux: 0,
			data: 0
		};
		assert.deepStrictEqual(actual, golden);
	});

	it('Correctly calculates an arithmetic add type', async () => {
		const input = deepCopy(legalBaseInput);
		input.types.engineering.combine = 'sum';
		input.types.engineering.value = {
			operator: '+',
			child: [0, 1, 2],
			term: [0, 1]
		};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.values;
		const golden = {
			engineering: 4,
			ux: 0,
			data: 0
		};
		assert.deepStrictEqual(actual, golden);
	});

	it('Correctly calculates an arithmetic subtract type', async () => {
		const input = deepCopy(legalBaseInput);
		input.types.engineering.combine = 'sum';
		input.types.engineering.value = {
			operator: '-',
			child: [0, 1, 2],
			term: [0, 1]
		};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.values;
		const golden = {
			engineering: 2,
			ux: 0,
			data: 0
		};
		assert.deepStrictEqual(actual, golden);
	});

	it('Correctly calculates an arithmetic divide type', async () => {
		const input = deepCopy(legalBaseInput);
		input.types.engineering.combine = 'sum';
		input.types.engineering.value = {
			operator: '/',
			child: [0, 2, 6],
			term: [2, 4]
		};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.values;
		const golden = {
			engineering: 3.5,
			ux: 0,
			data: 0
		};
		assert.deepStrictEqual(actual, golden);
	});

	it('Correctly calculates an compare type ==', async () => {
		const input = deepCopy(legalBaseInput);
		input.types.engineering.combine = 'sum';
		input.types.engineering.value = {
			compare: '==',
			child: [3, 4, 5],
			term: [4]
		};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.values;
		const golden = {
			engineering: 1.0,
			ux: 0,
			data: 0
		};
		assert.deepStrictEqual(actual, golden);
	});

	it('Correctly calculates an compare type !=', async () => {
		const input = deepCopy(legalBaseInput);
		input.types.engineering.combine = 'sum';
		input.types.engineering.value = {
			compare: '!=',
			child: [3, 4, 5],
			term: [4]
		};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.values;
		const golden = {
			engineering: 2.0,
			ux: 0,
			data: 0
		};
		assert.deepStrictEqual(actual, golden);
	});

	it('Correctly calculates an compare type <', async () => {
		const input = deepCopy(legalBaseInput);
		input.types.engineering.combine = 'sum';
		input.types.engineering.value = {
			compare: '<',
			child: [3, 4, 5],
			term: [4]
		};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.values;
		const golden = {
			engineering: 1.0,
			ux: 0,
			data: 0
		};
		assert.deepStrictEqual(actual, golden);
	});

	it('Correctly calculates an compare type >', async () => {
		const input = deepCopy(legalBaseInput);
		input.types.engineering.combine = 'sum';
		input.types.engineering.value = {
			compare: '>',
			child: [3, 4, 5],
			term: [4]
		};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.values;
		const golden = {
			engineering: 1.0,
			ux: 0,
			data: 0
		};
		assert.deepStrictEqual(actual, golden);
	});

	it('Correctly calculates an compare type <=', async () => {
		const input = deepCopy(legalBaseInput);
		input.types.engineering.combine = 'sum';
		input.types.engineering.value = {
			compare: '<=',
			child: [3, 4, 5],
			term: [4]
		};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.values;
		const golden = {
			engineering: 2.0,
			ux: 0,
			data: 0
		};
		assert.deepStrictEqual(actual, golden);
	});

	it('Correctly calculates an compare type >=', async () => {
		const input = deepCopy(legalBaseInput);
		input.types.engineering.combine = 'sum';
		input.types.engineering.value = {
			compare: '>=',
			child: [3, 4, 5],
			term: [4]
		};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.values;
		const golden = {
			engineering: 2.0,
			ux: 0,
			data: 0
		};
		assert.deepStrictEqual(actual, golden);
	});

	it('Correctly calculates an if', async () => {
		const input = deepCopy(legalBaseInput);
		input.types.engineering.combine = 'sum';
		input.types.engineering.value = {
			if: [0, 2, 0],
			then: [3, 4],
			else: [7]
		};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.values;
		const golden = {
			engineering: 18,
			ux: 0,
			data: 0
		};
		assert.deepStrictEqual(actual, golden);
	});

	it('Correctly calculates a clip with only low', async () => {
		const input = deepCopy(legalBaseInput);
		input.types.engineering.combine = 'sum';
		input.types.engineering.value = {
			clip: [-10, 3, 100],
			low: 0,
		};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.values;
		const golden = {
			engineering: 103,
			ux: 0,
			data: 0
		};
		assert.deepStrictEqual(actual, golden);
	});

	it('Correctly calculates a clip with only high', async () => {
		const input = deepCopy(legalBaseInput);
		input.types.engineering.combine = 'sum';
		input.types.engineering.value = {
			clip: [-10, 3, 100],
			high: 50,
		};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.values;
		const golden = {
			engineering: 43,
			ux: 0,
			data: 0
		};
		assert.deepStrictEqual(actual, golden);
	});

	it('Correctly calculates a clip with both low and high', async () => {
		const input = deepCopy(legalBaseInput);
		input.types.engineering.combine = 'sum';
		input.types.engineering.value = {
			clip: [-10, 3, 100],
			low: 0,
			high: 50,
		};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.values;
		const golden = {
			engineering: 53,
			ux: 0,
			data: 0
		};
		assert.deepStrictEqual(actual, golden);
	});

	it('Correctly calculates a range with both low and high', async () => {
		const input = deepCopy(legalBaseInput);
		input.types.engineering.combine = 'sum';
		input.types.engineering.value = {
			range: [-10, 3, 100],
			low: 0,
			high: 50,
		};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.values;
		const golden = {
			engineering: 1.06,
			ux: 0,
			data: 0
		};
		assert.deepStrictEqual(actual, golden);
	});

	it('Correctly calculates a percent with both low and high', async () => {
		const input = deepCopy(legalBaseInput);
		input.types.engineering.combine = 'sum';
		input.types.engineering.value = {
			percent: [-0.5, 0.06, 1.1],
			low: 5,
			high: 50,
		};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.values;
		const golden = {
			engineering: 62.7,
			ux: 0,
			data: 0
		};
		assert.deepStrictEqual(actual, golden);
	});



});

describe('tidyLongestTree', () => {
	it('basic', async () => {
		const input = deepCopy(legalBaseInput);
		const dag = extractSimpleGraph(input);
		const actual = tidyLongestTree(dag);
		const golden = {
			a : '',
			b : 'a',
			c : 'b',
			d : 'b'
		};
		assert.deepStrictEqual(actual, golden);
		const actualTree = treeGraphFromParentGraph(actual);
		const goldenTree = {
			name: '',
			children: [
				{
					name: 'a',
					children: [
						{
							name: 'b',
							children: [
								{
									name: 'c'
								},
								{
									name: 'd'
								}
							]
						}
					]
				}
			]
		};
		assert.deepStrictEqual(actualTree, goldenTree);
	});

});