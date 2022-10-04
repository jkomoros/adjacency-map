/*eslint-env node*/

import {
	AdjacencyMap,
	extractSimpleGraph
} from '../../src/adjacency-map.js';

import {
	tidyLongestTree,
	treeGraphFromParentGraph
} from '../../src/graph.js';

import {
	LIBRARIES
} from '../../src/libraries.js';

import {
	color,
	packColor,
	unpackColor
} from '../../src/color.js';

import {
	NULL_SENTINEL
} from '../../src/constants.js';

import {
	deepCopy
} from '../../src/util.js';

import assert from 'assert';

const legalBaseInput = {
	"version": 1,
	"properties": {
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
		const input = Object.fromEntries(Object.entries(legalBaseInput).filter(entry => entry[0] != 'properties'));
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

	it('barfs on empty properties', async () => {
		const input = {...legalBaseInput, properties: {}};
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
		input.properties.engineering.value = 'invalid';
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
		input.properties.ux.description = 5;
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
		input.properties.engineering.constants.weight = 'invalid';
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

	it('allows a root with a true key', async () => {
		const input = deepCopy(legalBaseInput);
		input.root.engineering = true;
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

	it('allows a root with a false key', async () => {
		const input = deepCopy(legalBaseInput);
		input.root.engineering = false;
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

	it('allows a root with a null key', async () => {
		const input = deepCopy(legalBaseInput);
		input.root.engineering = null;
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

	it('barfs for a root with a key not in properties', async () => {
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

	it('allows an edge with a constants of type true', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.constants.weight = true;
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

	it('allows an edge with a constants of type false', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.constants.weight = false;
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

	it('allows an edge with a constants of type null', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.constants.weight = null;
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

	it('allows a node with an edge with a weight of type false', async () => {
		const input = deepCopy(legalBaseInput);
		input.nodes.a.values[0].weight = false;
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

	it('allows a node with an edge with a weight of type true', async () => {
		const input = deepCopy(legalBaseInput);
		input.nodes.a.values[0].weight = true;
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

	it('allows a node with an edge with a weight of type null', async () => {
		const input = deepCopy(legalBaseInput);
		input.nodes.a.values[0].weight = null;
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


	it('barfs for an edge with a value of edge with illegal property', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.value = {constant: 'ref'};
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
		input.properties.engineering.value = {constant: 'foo'};
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
		input.properties.engineering.value = {constant: 'weight'};
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

	it('allows value with legal edge type for root', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.value = {root: 'engineering'};
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

	it('barfs for value with illegal edge type for root', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.value = {root: 'foo'};
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

	it('barfs for edge with invalid combiner', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.combine = 'foo';
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
		input.properties.engineering.combine = 'first';
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
		input.properties.engineering.value = [1,2,3];
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

	it('Allows passing true directly as ValueDefinition', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.value = true;
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

	it('Allows passing false directly as ValueDefinition', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.value = false;
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

	it('Allows passing null directly as ValueDefinition', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.value = null;
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

	it('Allows passing true and false in arrays as ValueDefinition', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.value = [true, false, 3.0];
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
		input.properties.engineering.value = [1,2,'fail'];
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
		input.properties.engineering.value = [];
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
		input.properties.engineering.value = {ref: 'foo'};
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
		input.properties.engineering.value = {ref: 'engineering'};
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
		input.properties.engineering.dependencies = ['foo'];
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
		input.properties.engineering.dependencies = ['engineering'];
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
		input.properties.engineering.dependencies = ['ux'];
		input.properties.ux.dependencies = ['engineering'];
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
		input.properties.engineering.dependencies = ['ux'];
		input.properties.ux.dependencies = ['data'];
		input.properties.data.dependencies = ['engineering'];
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
		input.properties.engineering.dependencies = ['ux'];
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
		input.properties.engineering.dependencies = ['ux'];
		input.properties.ux.dependencies = ['data'];
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
		input.properties.engineering.dependencies = ['data'];
		input.properties.engineering.value = {result: 'data'};
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
		input.properties.engineering.value = {result: 'data'};
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
		input.properties.engineering.value = {
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
		input.properties.engineering.value = {
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
		input.properties.engineering.value = {
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
		input.properties.engineering.value = {
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

	it('Allows a valid named color', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.value = {
			color: 'blue',
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

	it('Allows a valid rgb triple color', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.value = {
			color: [255, 0, 0],
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

	it('Allows a valid rgba quad color', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.value = {
			color: [255, 0, 0, 0.5],
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

	it('Allows a valid string rgb color', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.value = {
			color: 'rgb(255,0,255)',
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

	it('barfs for an unknown named color', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.value = {
			color: 'invalid',
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

	it('barfs for an rgb color with too few items', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.value = {
			color: [255,255],
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

	it('barfs for an rgb string with too few items', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.value = {
			color: 'rgb(255,0)',
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

	it('barfs for a value defintion of type arithmetic with invalid operator', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.value = {
			operator: '&',
			a: [3, 4, 5],
			b: [1]
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

	it('barfs for a value defintion of type arithmetic missing b', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.value = {
			operator: '+',
			b: [3, 4, 5],
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

	it('barfs for a value defintion of type arithmetic missing a', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.value = {
			operator: '+',
			a: [1]
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
		input.properties.engineering.value = {
			operator: '+',
			a: [3,4,5],
			b: [1]
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

	it('Allows a valid value defintion of type arithmetic unary missing b', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.value = {
			operator: '!',
			a: [3,4,5]
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

	it('barfs for a value defintion of type compare missing b', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.value = {
			compare: '<=',
			a: [3, 4, 5]
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

	it('barfs for a value defintion of type compare missing a', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.value = {
			compare: '<=',
			a: [4]
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
		input.properties.engineering.value = {
			compare: '===',
			a: [3, 4, 5],
			b: [4]
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
		input.properties.engineering.value = {
			compare: '<=',
			a: [3,4,5],
			b: [4]
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
		input.properties.engineering.value = {
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
		input.properties.engineering.value = {
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
		input.properties.engineering.value = {
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
		input.properties.engineering.value = {
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
		input.properties.engineering.value = {
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
		input.properties.engineering.value = {
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
		input.properties.engineering.value = {
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
		input.properties.engineering.value = {
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
		input.properties.engineering.value = {
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
		input.properties.engineering.value = {
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
		input.properties.engineering.value = {
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
		input.properties.engineering.value = {
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
		input.properties.engineering.value = {
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
		input.properties.engineering.value = {
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

	it('barsf for a value defintion of type collect with no children', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.value = {
			collect: 'foo'
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

	it('allows a value defintion of type collect with children', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.value = {
			collect: [{root: 'engineering'}, 3]
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

	it('barfs for an invalid radius on map', async () => {
		const input = deepCopy(legalBaseInput);
		input.display = {
			node: {
				radius: 'invalid'
			}
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

	it('Barfs for invalid radius on a', async () => {
		const input = deepCopy(legalBaseInput);
		input.nodes.a.display = {
			radius: 'invalid'
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

	it('Allows radius on node and map', async () => {
		const input = deepCopy(legalBaseInput);
		input.display = {
			node: {
				radius: 3,
			}
		};
		input.nodes.a.display = {
			radius: 5
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

	it('barfs for an invalid opacity on map', async () => {
		const input = deepCopy(legalBaseInput);
		input.display = {
			node: {
				opacity: 'invalid'
			}
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

	it('Barfs for invalid opacity on a', async () => {
		const input = deepCopy(legalBaseInput);
		input.nodes.a.display = {
			opacity: 'invalid'
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

	it('Allows opacity on node and map', async () => {
		const input = deepCopy(legalBaseInput);
		input.display = {
			node: {
				opacity: 3,
			}
		};
		input.nodes.a.display = {
			opacity: -1.0
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
	it('includes missing properties from root', async () => {
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
			"core:radius": 6.0,
			"core:opacity": 1.0,
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

const NODE_A_BASE_VALUES = {
	'core:radius': 6.0,
	'core:opacity': 1.0,
	engineering: 3,
	ux: 0,
	data: 0
};

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
			...NODE_A_BASE_VALUES	
		};
		assert.deepStrictEqual(actual, golden);
	});

	it('fullDescription works for a named node', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.data.hide = true;
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.fullDescription();
		const golden = `Node a

ux: 0
engineering: 3`;

		assert.deepStrictEqual(actual, golden);
	});

	it('fullDescription(true) works for a named node', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.data.hide = true;
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.fullDescription(true);
		const golden = `Node a

data: 0
ux: 0
engineering: 3
core:opacity: 1
core:radius: 6`;

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
			...NODE_A_BASE_VALUES,
			engineering: 4,
		};
		assert.deepStrictEqual(actual, golden);
	});

	it('allows a named node with edge constant value', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.value = {constant: 'weight'};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.values;
		const golden = {
			...NODE_A_BASE_VALUES,
			engineering: 2.5,
		};
		assert.deepStrictEqual(actual, golden);
	});

	it('Correctly handles literal booleans', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.combine = 'sum';
		input.properties.engineering.value = [true, false, 3.0];
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.values;
		const golden = {
			...NODE_A_BASE_VALUES,
			engineering: 4.0,
		};
		assert.deepStrictEqual(actual, golden);
	});

	it('Correctly handles literal null', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.combine = 'sum';
		input.properties.engineering.value = [null, 3.0];
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.values;
		const golden = {
			...NODE_A_BASE_VALUES,
			engineering: NULL_SENTINEL + 3.0,
		};
		assert.deepStrictEqual(actual, golden);
	});

	it('allows a named node with non-default combiner', async () => {
		const input = deepCopy(legalBaseInput);
		//Give it a more interesting value.
		input.properties.engineering.value = {constant: 'weight'};
		input.properties.engineering.combine = 'first';
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.values;
		const golden = {
			...NODE_A_BASE_VALUES,
			engineering: 4.0,
		};
		assert.deepStrictEqual(actual, golden);
	});

	it('allows a named node with array of items', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.value = [8,9];
		input.properties.engineering.combine = 'first';
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.values;
		const golden = {
			...NODE_A_BASE_VALUES,
			engineering: 8.0,
		};
		assert.deepStrictEqual(actual, golden);
	});

	it('allows a named node with a RefValue', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.value = {ref:'engineering'};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.values;
		const golden = {
			...NODE_A_BASE_VALUES,
			engineering: 4.0,
		};
		assert.deepStrictEqual(actual, golden);
	});

	it('allows a named node with a root value', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.value = {root:'engineering'};
		input.root.engineering = 5.0;
		const map = new AdjacencyMap(input);
		const node = map.node('b');
		const actual = node.values;
		const golden = {
			...NODE_A_BASE_VALUES,
			engineering: 5.0,
			ux: 4.0
		};
		assert.deepStrictEqual(actual, golden);
	});

	it('allows a named node with last combiner', async () => {
		const input = deepCopy(legalBaseInput);
		//Give it a more interesting value.
		input.properties.engineering.value = [1,2,10];
		input.properties.engineering.combine = 'last';
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.values;
		const golden = {
			...NODE_A_BASE_VALUES,
			engineering: 10.0,
		};
		assert.deepStrictEqual(actual, golden);
	});

	it('allows a named node with min combiner', async () => {
		const input = deepCopy(legalBaseInput);
		//Give it a more interesting value.
		input.properties.engineering.value = [1,-3,10];
		input.properties.engineering.combine = 'min';
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.values;
		const golden = {
			...NODE_A_BASE_VALUES,
			engineering: -3.0,
		};
		assert.deepStrictEqual(actual, golden);
	});

	it('allows a named node with max combiner', async () => {
		const input = deepCopy(legalBaseInput);
		//Give it a more interesting value.
		input.properties.engineering.value = [1,-3,10, 2];
		input.properties.engineering.combine = 'max';
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.values;
		const golden = {
			...NODE_A_BASE_VALUES,
			engineering: 10.0,
		};
		assert.deepStrictEqual(actual, golden);
	});

	it('allows a named node with sum combiner', async () => {
		const input = deepCopy(legalBaseInput);
		//Give it a more interesting value.
		input.properties.engineering.value = [1.5,-3,10, 2];
		input.properties.engineering.combine = 'sum';
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.values;
		const golden = {
			...NODE_A_BASE_VALUES,
			engineering: 10.5,
		};
		assert.deepStrictEqual(actual, golden);
	});

	it('allows a named node with product combiner', async () => {
		const input = deepCopy(legalBaseInput);
		//Give it a more interesting value.
		input.properties.engineering.value = [1.5,-3,10, 2];
		input.properties.engineering.combine = 'product';
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.values;
		const golden = {
			...NODE_A_BASE_VALUES,
			engineering: -90,
		};
		assert.deepStrictEqual(actual, golden);
	});

	it('allows a named node with and combiner all true', async () => {
		const input = deepCopy(legalBaseInput);
		//Give it a more interesting value.
		input.properties.engineering.value = [2.0, 1.0];
		input.properties.engineering.combine = 'and';
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.values;
		const golden = {
			...NODE_A_BASE_VALUES,
			engineering: 1.0,
		};
		assert.deepStrictEqual(actual, golden);
	});

	it('allows a named node with and combiner some true', async () => {
		const input = deepCopy(legalBaseInput);
		//Give it a more interesting value.
		input.properties.engineering.value = [2.0, 1.0, 0.0];
		input.properties.engineering.combine = 'and';
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.values;
		const golden = {
			...NODE_A_BASE_VALUES,
			engineering: 0.0,
		};
		assert.deepStrictEqual(actual, golden);
	});

	it('allows a named node with or combiner some true', async () => {
		const input = deepCopy(legalBaseInput);
		//Give it a more interesting value.
		input.properties.engineering.value = [0.0, 1.0];
		input.properties.engineering.combine = 'or';
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.values;
		const golden = {
			...NODE_A_BASE_VALUES,
			engineering: 1.0,
		};
		assert.deepStrictEqual(actual, golden);
	});

	it('allows a named node with or combiner none true', async () => {
		const input = deepCopy(legalBaseInput);
		//Give it a more interesting value.
		input.properties.engineering.value = [0.0, 0.0];
		input.properties.engineering.combine = 'or';
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.values;
		const golden = {
			...NODE_A_BASE_VALUES,
			engineering: 0.0,
		};
		assert.deepStrictEqual(actual, golden);
	});

	it('Correctly sorts propertyNames', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.data.dependencies = ['engineering'];
		input.properties.engineering.dependencies = ['ux'];
		const map = new AdjacencyMap(input);
		const actual = map.propertyNames;
		const golden = ['ux', 'engineering', 'data', 'core:opacity', 'core:radius'];
		assert.deepStrictEqual(actual, golden);
	});

	it('Tests a ResultValue ref calculation', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.data.dependencies = ['engineering'];
		input.properties.data.value = {result: 'engineering'};
		input.properties.engineering.dependencies = ['ux'];
		input.properties.engineering.value = {result: 'ux'};
		input.root = {'ux': 12};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.values;
		const golden = {
			...NODE_A_BASE_VALUES,
			engineering: 12,
			ux: 12,
			//Data is 0 because there is no data edge on node a, so it's just an implicit reference to its root.
			data: 0
		};
		assert.deepStrictEqual(actual, golden);
	});

	//TODO: test that having a true/false/null in edge constants, node values,
	//etc all work.

	it('Tests a ResultValue ref calculation with two edges', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.data.dependencies = ['engineering'];
		input.properties.data.value = {result: 'engineering'};
		input.properties.engineering.dependencies = ['ux'];
		input.properties.engineering.value = {result: 'ux'};
		input.nodes.a.values.push({type: 'data'});
		input.root = {'ux': 12};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.values;
		const golden = {
			...NODE_A_BASE_VALUES,
			engineering: 12,
			ux: 12,
			data: 12
		};
		assert.deepStrictEqual(actual, golden);
	});

	it('Tests a ResultValue ref calculation with a combine type', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.value = {
			combine: 'min',
			child: [1, 4, 5]
		};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.values;
		const golden = {
			...NODE_A_BASE_VALUES,
			engineering: 1,
		};
		assert.deepStrictEqual(actual, golden);
	});

	it('Correctly calculates an arithmetic add type', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.combine = 'sum';
		input.properties.engineering.value = {
			operator: '+',
			a: [0, 1, 2],
			b: [0, 1]
		};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.values;
		const golden = {
			...NODE_A_BASE_VALUES,
			engineering: 4,
		};
		assert.deepStrictEqual(actual, golden);
	});

	it('Correctly calculates an arithmetic subtract type', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.combine = 'sum';
		input.properties.engineering.value = {
			operator: '-',
			a: [0, 1, 2],
			b: [0, 1]
		};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.values;
		const golden = {
			...NODE_A_BASE_VALUES,
			engineering: 2,
		};
		assert.deepStrictEqual(actual, golden);
	});

	it('Correctly calculates an arithmetic divide type', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.combine = 'sum';
		input.properties.engineering.value = {
			operator: '/',
			a: [0, 2, 6],
			b: [2, 4]
		};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.values;
		const golden = {
			...NODE_A_BASE_VALUES,
			engineering: 3.5,
		};
		assert.deepStrictEqual(actual, golden);
	});

	it('Correctly calculates an arithmetic and type', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.combine = 'sum';
		input.properties.engineering.value = {
			operator: '&&',
			a: [0, 2, 6],
			b: [2, 0]
		};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.values;
		const golden = {
			...NODE_A_BASE_VALUES,
			engineering: 1.0,
		};
		assert.deepStrictEqual(actual, golden);
	});

	it('Correctly calculates an arithmetic or type', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.combine = 'sum';
		input.properties.engineering.value = {
			operator: '||',
			a: [0, 2, 0, 0],
			b: [2, 0]
		};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.values;
		const golden = {
			...NODE_A_BASE_VALUES,
			engineering: 3.0,
		};
		assert.deepStrictEqual(actual, golden);
	});

	it('Correctly calculates an arithmetic not type', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.combine = 'sum';
		input.properties.engineering.value = {
			operator: '!',
			a: [0, 2, 0, 0],
		};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.values;
		const golden = {
			...NODE_A_BASE_VALUES,
			engineering: 3.0,
		};
		assert.deepStrictEqual(actual, golden);
	});

	it('Correctly calculates an compare type ==', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.combine = 'sum';
		input.properties.engineering.value = {
			compare: '==',
			a: [3, 4, 5],
			b: [4]
		};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.values;
		const golden = {
			...NODE_A_BASE_VALUES,
			engineering: 1.0,
		};
		assert.deepStrictEqual(actual, golden);
	});

	it('Correctly calculates an compare type !=', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.combine = 'sum';
		input.properties.engineering.value = {
			compare: '!=',
			a: [3, 4, 5],
			b: [4]
		};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.values;
		const golden = {
			...NODE_A_BASE_VALUES,
			engineering: 2.0,
		};
		assert.deepStrictEqual(actual, golden);
	});

	it('Correctly calculates an compare type <', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.combine = 'sum';
		input.properties.engineering.value = {
			compare: '<',
			a: [3, 4, 5],
			b: [4]
		};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.values;
		const golden = {
			...NODE_A_BASE_VALUES,
			engineering: 1.0,
		};
		assert.deepStrictEqual(actual, golden);
	});

	it('Correctly calculates an compare type >', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.combine = 'sum';
		input.properties.engineering.value = {
			compare: '>',
			a: [3, 4, 5],
			b: [4]
		};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.values;
		const golden = {
			...NODE_A_BASE_VALUES,
			engineering: 1.0,
		};
		assert.deepStrictEqual(actual, golden);
	});

	it('Correctly calculates an compare type <=', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.combine = 'sum';
		input.properties.engineering.value = {
			compare: '<=',
			a: [3, 4, 5],
			b: [4]
		};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.values;
		const golden = {
			...NODE_A_BASE_VALUES,
			engineering: 2.0,
		};
		assert.deepStrictEqual(actual, golden);
	});

	it('Correctly calculates an compare type >=', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.combine = 'sum';
		input.properties.engineering.value = {
			compare: '>=',
			a: [3, 4, 5],
			b: [4]
		};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.values;
		const golden = {
			...NODE_A_BASE_VALUES,
			engineering: 2.0,
		};
		assert.deepStrictEqual(actual, golden);
	});

	it('Correctly calculates an if', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.combine = 'sum';
		input.properties.engineering.value = {
			if: [0, 2, 0],
			then: [3, 4],
			else: [7]
		};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.values;
		const golden = {
			...NODE_A_BASE_VALUES,
			engineering: 18,
		};
		assert.deepStrictEqual(actual, golden);
	});

	it('Correctly calculates a clip with only low', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.combine = 'sum';
		input.properties.engineering.value = {
			clip: [-10, 3, 100],
			low: 0,
		};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.values;
		const golden = {
			...NODE_A_BASE_VALUES,
			engineering: 103,
		};
		assert.deepStrictEqual(actual, golden);
	});

	it('Correctly calculates a clip with only high', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.combine = 'sum';
		input.properties.engineering.value = {
			clip: [-10, 3, 100],
			high: 50,
		};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.values;
		const golden = {
			...NODE_A_BASE_VALUES,
			engineering: 43,
		};
		assert.deepStrictEqual(actual, golden);
	});

	it('Correctly calculates a clip with both low and high', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.combine = 'sum';
		input.properties.engineering.value = {
			clip: [-10, 3, 100],
			low: 0,
			high: 50,
		};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.values;
		const golden = {
			...NODE_A_BASE_VALUES,
			engineering: 53,
		};
		assert.deepStrictEqual(actual, golden);
	});

	it('Correctly calculates a range with both low and high', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.combine = 'sum';
		input.properties.engineering.value = {
			range: [-10, 3, 100],
			low: 0,
			high: 50,
		};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.values;
		const golden = {
			...NODE_A_BASE_VALUES,
			engineering: 1.06,
		};
		assert.deepStrictEqual(actual, golden);
	});

	it('Correctly calculates a percent with both low and high', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.combine = 'sum';
		input.properties.engineering.value = {
			percent: [-0.5, 0.06, 1.1],
			low: 5,
			high: 50,
		};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.values;
		const golden = {
			...NODE_A_BASE_VALUES,
			engineering: 62.7,
		};
		assert.deepStrictEqual(actual, golden);
	});

	it('Correctly calculates a collect', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.combine = 'sum';
		input.properties.engineering.value = {
			collect: [
				{root:'engineering'},
				3
			]
		};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.values;
		const golden = {
			...NODE_A_BASE_VALUES,
			engineering: 7.0,
		};
		assert.deepStrictEqual(actual, golden);
	});

	it('Correctly calculates a color', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.combine = 'max';
		input.properties.engineering.value = {
			color: 'blue'
		};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.values;
		const golden = {
			...NODE_A_BASE_VALUES,
			engineering: packColor(color('blue')),
		};
		assert.deepStrictEqual(actual, golden);
	});

	it('Correctly calculates a radius set on map', async () => {
		const input = deepCopy(legalBaseInput);
		input.display = {
			node: {
				radius: 10
			}
		};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.radius;
		const golden = 10;
		assert.deepStrictEqual(actual, golden);
	});


	it('Correctly calculates a radius set on node', async () => {
		const input = deepCopy(legalBaseInput);
		input.nodes.a.display = {
			radius: 10
		};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.radius;
		const golden = 10;
		assert.deepStrictEqual(actual, golden);
	});

	it('Correctly calculates a radius set on node that relies on a value', async () => {
		const input = deepCopy(legalBaseInput);
		input.nodes.a.display = {
			radius: {
				result: 'engineering'
			}
		};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.radius;
		const golden = NODE_A_BASE_VALUES.engineering;
		assert.deepStrictEqual(actual, golden);
	});

	it('Correctly calculates an opacity set on map', async () => {
		const input = deepCopy(legalBaseInput);
		input.display = {
			node: {
				opacity: 0.8
			}
		};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.opacity;
		const golden = 0.8;
		assert.deepStrictEqual(actual, golden);
	});


	it('Correctly calculates an opacity set on node', async () => {
		const input = deepCopy(legalBaseInput);
		input.nodes.a.display = {
			opacity: 0.8
		};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.opacity;
		const golden = 0.8;
		assert.deepStrictEqual(actual, golden);
	});

	it('Correctly calculates a opacity set on node that relies on a value', async () => {
		const input = deepCopy(legalBaseInput);
		input.nodes.a.display = {
			opacity: {
				result: 'engineering'
			}
		};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.opacity;
		//We expect it to be clipped
		const golden = 1.0;
		assert.deepStrictEqual(actual, golden);
	});

	it('Correctly handles libraries', async () => {
		const input = deepCopy(legalBaseInput);
		input.import = '_test_b_';
		LIBRARIES['_test_a_'] = {
			properties: {
				'_test_a_:one': {
					value: 1
				}
			},
			root: {
				'_test_a_:one': 3
			}
		};
		LIBRARIES['_test_b_'] = {
			import: ['_test_a_'],
			properties: {
				'_test_b_:two': {
					value: 2,
				}
			},
			root: {
				'_test_b_:two': 4,
			}
		};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.values;
		const golden = {
			...NODE_A_BASE_VALUES,
			'_test_a_:one': 3,
			'_test_b_:two': 4,
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

describe('packColor', () => {
	it('roundtrip', async () => {
		const input = ['blue', '#FF00FF33', '#FF00FF', 'rgb(32,28,28)', 'rgba(32, 28, 28, 0.1)'];
		for (const test of input) {
			const golden = color(test);
			const actual = unpackColor(packColor(golden));
			assert.deepStrictEqual(actual, golden, input);
		}
	});

	it('overflow clips', async() => {
		//Very large number
		const input = 0xFFFFFFFFFF;
		const actual = unpackColor(input);
		const golden = color([255, 255, 255, 1]);
		assert.deepStrictEqual(actual, golden);
	});

});