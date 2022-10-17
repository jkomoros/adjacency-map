/*eslint-env node*/

import {
	AdjacencyMap,
	extractSimpleGraph,
	processMapDefinition
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
	deepCopy,
	wrapArrays
} from '../../src/util.js';

import assert from 'assert';

const legalBaseInput = {
	properties: {
		engineering: {
			value: 3,
			constants: {
				weight: 1.0
			}
		},
		ux: {
			value: 4,
			description: "A description of ux"
		},
		data: {
			value: 2,
			description: "Investment in data quality"
		}
	},
	root: {
		engineering : 4.0
	},
	nodes: {
		a: {
			description: "Node a",
			edges: [
				{
					type: "engineering",
					weight: 4.0
				},
				{
					type: "engineering"
				}
			]
		},
		b: {
			description: "Node b",
			edges: [
				{
					type: "ux",
					ref: "a"
				}
			]
		},
		c: {
			description: "Node c",
			edges: [
				{
					type: "engineering",
					ref: "a"
				},
				{
					type: "ux",
					ref: "b"
				}
			]
		},
		d: {
			description: "Node d",
			edges: [
				{
					type: "engineering",
					ref: "b"
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

	it('Allows no nodes', async () => {
		const input = deepCopy(legalBaseInput);
		delete input.nodes;
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

	it('allows base input with node with no edges', async () => {
		const input = deepCopy(legalBaseInput);
		delete input.nodes.a.edges;
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
		delete input.nodes.a.edges[0].type;
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
		input.nodes.a.edges[0].type = 'foo';
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

	it('barfs for a property definition that has an explicit implication for a non-existent property', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.implies = ['foo'];
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

	it('barfs for an edge that has an explicit implication for a non-existent property', async () => {
		const input = deepCopy(legalBaseInput);
		input.nodes.a.edges[0].implies = ['foo'];
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

	it('barfs for a property definition that says no edges but there are edges in nodes on the map', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.calculateWhen = 'always';
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

	it('barfs for a property definition that says no edges also sets implies', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.foo = {
			value: 3,
			calculateWhen: 'always',
			implies: '*'
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

	it('barfs for a property definition that says no edges but has a value that relies on edges', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.foo = {
			value: {constant: 'weight'},
			calculateWhen: 'always',
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

	it('barfs for a property definition that says no edges but has a value that relies on refs', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.foo = {
			value: {ref: 'engineering'},
			calculateWhen: 'always',
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

	it('barfs for a property definition that has an explicit implication for property that says noEdges', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.implies = ['foo'];
		input.properties.foo = {
			value: 3,
			calculateWhen: 'always'
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

	it('barfs for an edge that has an explicit implication for a property that is noEdges', async () => {
		const input = deepCopy(legalBaseInput);
		input.nodes.a.edges[0].implies = ['foo'];
		input.properties.foo = {
			value: 3,
			calculateWhen: 'always'
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

	it('Allows a property definition that says no edges', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.foo = {
			value: 3,
			calculateWhen: 'always'
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

	it('barfs for a graph with a direct cycle in it', async () => {
		const input = deepCopy(legalBaseInput);
		input.nodes.b.edges.push({type: 'engineering', ref:'d'});
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
		input.nodes.a.edges.push({type: 'engineering', ref:'d'});
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
		input.nodes.a.edges[0].weight = false;
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
		input.nodes.a.edges[0].weight = true;
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
		input.nodes.a.edges[0].weight = null;
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

	it('barfs for a dependency on a thing that depends directly on us', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.value = {
			result: 'ux'
		};
		input.properties.ux.value = {
			result: 'engineering'
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

	it('barfs for a dependency on a thing that indirectly directly on us', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.value = {
			result: 'ux'
		};
		input.properties.ux.value = {
			result: 'data'
		};
		input.properties.data.value = {
			result: 'engineering'
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

	it('allows a value defintion of type ResultValue that has a dependency', async () => {
		const input = deepCopy(legalBaseInput);
		input.root = {data: 12};
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
			value: [1]
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

	it('allows a value defintion that includes a result ref', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.value = {
			combine: 'min',
			value: { result: 'ux' }
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

	it('Allows a valid value defintion of type combiner', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.value = {
			combine: 'min',
			value: [3,4,5]
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

	it('barfs for a value defintion of type filter missing filter', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.value = {
			value: [0, 1]
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

	it('barfs for a value defintion of type filter missing value', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.value = {
			filter: [0, 1],
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

	it('Allows a valid value defintion of type filter', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.value = {
			filter: [0, 1],
			value: [0, 1]
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

	it('barfs for a value defintion of type lengthOf with illegal lengthOf property', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.value = {
			lengthOf: 'invalid',
			value: 3
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

	it('barfs for a value defintion of type lengthOf with illegal value property', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.value = {
			lengthOf: 'edges',
			value: 'invalid'
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

	it('allows a value defintion of type lengthOf', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.value = {
			lengthOf: 'edges',
			value: 3
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

	it('Barfs for a valid defintion of type input in a context in which its not allowed', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.value = 'input';
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

	it('Allows a valid defintion of type input in a context in which it is allowed', async () => {
		const input = deepCopy(legalBaseInput);
		input.display = {
			edgeCombiner: {
				weight: 'input',
			}
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

	it('barfs for a resultValue definition that references self', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.value = {
			result: '.'
		};
		//A result relying on self is a direct cycle, so illegal.
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

	it('allows a root definition that references self', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.value = {
			root: '.'
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

	it('allows a refValue definition that references self', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.value = {
			ref: '.'
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

	it('barfs for a duplicate declared variable', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.value = {
			let: 'foo',
			value: 3,
			block: {
				let: 'foo',
				value: 4,
				block: 5
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

	it('Allows a declared variable', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.value = {
			let: 'foo',
			value: 3,
			block: {
				variable: 'foo'
			}
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

	it('barfs for a variable access outside of its let block', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.value = {
			variable: 'foo'
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

	it('barfs for an invalid color on map', async () => {
		const input = deepCopy(legalBaseInput);
		input.display = {
			node: {
				color: 'invalid'
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

	it('Barfs for invalid color on a', async () => {
		const input = deepCopy(legalBaseInput);
		input.nodes.a.display = {
			color: 'invalid'
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

	it('Allows color on node and map', async () => {
		const input = deepCopy(legalBaseInput);
		input.display = {
			node: {
				color: 3,
			}
		};
		input.nodes.a.display = {
			color: -1.0
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

	it('barfs for an invalid strokeWidth on map', async () => {
		const input = deepCopy(legalBaseInput);
		input.display = {
			node: {
				strokeWidth: 'invalid'
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

	it('Barfs for invalid strokeWidth on a', async () => {
		const input = deepCopy(legalBaseInput);
		input.nodes.a.display = {
			strokeWidth: 'invalid'
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

	it('Allows strokeWidth on node and map', async () => {
		const input = deepCopy(legalBaseInput);
		input.display = {
			node: {
				strokeWidth: 3,
			}
		};
		input.nodes.a.display = {
			strokeWidth: 5
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

	it('barfs for an invalid strokeOpacity on map', async () => {
		const input = deepCopy(legalBaseInput);
		input.display = {
			node: {
				strokeOpacity: 'invalid'
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

	it('Barfs for invalid strokeOpacity on a', async () => {
		const input = deepCopy(legalBaseInput);
		input.nodes.a.display = {
			strokeOpacity: 'invalid'
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

	it('Allows strokeOpacity on node and map', async () => {
		const input = deepCopy(legalBaseInput);
		input.display = {
			node: {
				strokeOpacity: 3,
			}
		};
		input.nodes.a.display = {
			strokeOpacity: -1.0
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

	it('barfs for an invalid strokeColor on map', async () => {
		const input = deepCopy(legalBaseInput);
		input.display = {
			node: {
				strokeColor: 'invalid'
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

	it('Barfs for invalid strokeColor on a', async () => {
		const input = deepCopy(legalBaseInput);
		input.nodes.a.display = {
			strokeColor: 'invalid'
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

	it('Allows strokeColor on node and map', async () => {
		const input = deepCopy(legalBaseInput);
		input.display = {
			node: {
				strokeColor: 3,
			}
		};
		input.nodes.a.display = {
			strokeColor: -1.0
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

	it('barfs for an invalid width on map', async () => {
		const input = deepCopy(legalBaseInput);
		input.display = {
			edge: {
				width: 'invalid'
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

	it('Barfs for invalid width on engineering', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.display = {
			width: 'invalid'
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

	it('Allows width on node and map', async () => {
		const input = deepCopy(legalBaseInput);
		input.display = {
			edge: {
				width: 3,
			}
		};
		input.properties.engineering.display = {
			width: 4
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

	it('barfs for an invalid color on map', async () => {
		const input = deepCopy(legalBaseInput);
		input.display = {
			edge: {
				color: 'invalid'
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

	it('Barfs for invalid color on engineering', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.display = {
			color: 'invalid'
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

	it('Allows color on node and map', async () => {
		const input = deepCopy(legalBaseInput);
		input.display = {
			edge: {
				color: {
					color: '#555'
				},
			}
		};
		input.properties.engineering.display = {
			width: {
				color: '#555'
			}
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
			edge: {
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

	it('Barfs for invalid opacity on engineering', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.display = {
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
			edge: {
				opacity: 0.4
			}
		};
		input.properties.engineering.display = {
			opacity: 0.4
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

	it('barfs for an invalid distinct on map', async () => {
		const input = deepCopy(legalBaseInput);
		input.display = {
			edge: {
				distinct: 'invalid'
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

	it('Barfs for invalid distinct on engineering', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.display = {
			distinct: 'invalid'
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

	it('Allows distinct on node and map', async () => {
		const input = deepCopy(legalBaseInput);
		input.display = {
			edge: {
				distinct: false
			}
		};
		input.properties.engineering.display = {
			distinct: false
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

	it('barfs for an invalid width combiner on map', async () => {
		const input = deepCopy(legalBaseInput);
		input.display = {
			edgeCombiner: {
				width: 'invalid'
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

	it('Allows width combiner on map', async () => {
		const input = deepCopy(legalBaseInput);
		input.display = {
			edgeCombiner: {
				width: 3,
			}
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

	it('barfs for an invalid color combiner on map', async () => {
		const input = deepCopy(legalBaseInput);
		input.display = {
			edgeCombiner: {
				color: 'invalid'
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

	it('Allows color combiner on map', async () => {
		const input = deepCopy(legalBaseInput);
		input.display = {
			edgeCombiner: {
				color: {
					color: '#555'
				},
			}
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

	it('barfs for an invalid opacity combiner on map', async () => {
		const input = deepCopy(legalBaseInput);
		input.display = {
			edgeCombiner: {
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

	it('Allows opacity combiner on map', async () => {
		const input = deepCopy(legalBaseInput);
		input.display = {
			edgeCombiner: {
				opacity: 0.4
			}
		};
		input.properties.engineering.display = {
			opacity: 0.4
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

	it('Barfs for an enumerated constant on property definition of name implied', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.constants.implied = 1;
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

	it('Allows a value definition that relies on implied constant even though it wasn\'t defined', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.value = {
			constant: 'implied'
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

	it('Barfs for a node defining base with illegal property names', async () => {
		const input = deepCopy(legalBaseInput);
		input.nodes.a.values = {
			illegal: 0,
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

	it('Barfs for a node defining base with illegal value', async () => {
		const input = deepCopy(legalBaseInput);
		input.nodes.a.values = {
			ux: 'invalid',
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

	it('allows node defining base legally', async () => {
		const input = deepCopy(legalBaseInput);
		input.nodes.a.values = {
			ux: 3,
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

	it('barfs for scenario with name ""', async () => {
		const input = deepCopy(legalBaseInput);
		input.scenarios = {
			'': {}
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

	it('Barfs for a scenario with a non-existent node', async () => {
		const input = deepCopy(legalBaseInput);
		input.scenarios = {
			'1' : {
				nodes: {
					'invalid': {
						'ux': 0,
					}
				}
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

	it('Barfs for a scenario with a node with an invalid property name', async () => {
		const input = deepCopy(legalBaseInput);
		input.scenarios = {
			'1' : {
				nodes: {
					'a': {
						'invalid': 0
					}
				}
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

	it('Allows a legal scenario', async () => {
		const input = deepCopy(legalBaseInput);
		input.scenarios = {
			'1' : {
				nodes: {
					//Overriding root node is legal
					'': {
						'engineering': null,
					},
					'a': {
						'ux': true
					}
				}
			}
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

	it('barfs for an illegal scenario as constructor argument', async () => {
		const input = deepCopy(legalBaseInput);
		input.scenarios = {
			'1' : {
				nodes: {
					//Overriding root node is legal
					'': {
						'engineering': null,
					},
					'a': {
						'ux': true
					}
				}
			}
		};
		const errorExpected = true;
		const fn = () => {
			new AdjacencyMap(input, 'invalid');
		};
		if (errorExpected) {
			assert.throws(fn);
		} else {
			assert.doesNotThrow(fn);
		}
	});

	it('Allows a legal scenario as constructor argument', async () => {
		const input = deepCopy(legalBaseInput);
		input.scenarios = {
			'1' : {
				nodes: {
					//Overriding root node is legal
					'': {
						'engineering': null,
					},
					'a': {
						'ux': true
					}
				}
			}
		};
		const errorExpected = false;
		const fn = () => {
			new AdjacencyMap(input, '1');
		};
		if (errorExpected) {
			assert.throws(fn);
		} else {
			assert.doesNotThrow(fn);
		}
	});

	it('Barfs for a node with a nonexistent edge', async () => {
		const input = deepCopy(legalBaseInput);
		input.tags = {
			tagA: {},
			tagB: {}
		};
		input.nodes.a.tags = {tagA: true, tagC: true};
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


	it('Barfs for a value of hasTag with a nonexistent tag', async () => {
		const input = deepCopy(legalBaseInput);
		input.tags = {
			tagA: {},
			tagB: {}
		};
		input.properties.engineering.value = {
			has: 'tagC'
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

	it('Allows a value of hasTag with an existing tag', async () => {
		const input = deepCopy(legalBaseInput);
		input.tags = {
			tagA: {},
			tagB: {}
		};
		input.properties.engineering.value = {
			has: 'tagA'
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

	it('Barfs for a value of tagConstant with a non-existing constant', async () => {
		const input = deepCopy(legalBaseInput);
		input.tags = {
			tagA: {
				constants: {
					weight: 5
				}
			},
			tagB: {
				constants: {
					weight: 2
				}
			}
		};
		input.properties.engineering.value = {
			tagConstant: 'invalid'
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

	it('Barfs for a value of tagConstant with an invalid default', async () => {
		const input = deepCopy(legalBaseInput);
		input.tags = {
			tagA: {
				constants: {
					weight: 5
				}
			},
			tagB: {
				constants: {
					weight: 2
				}
			}
		};
		input.properties.engineering.value = {
			tagConstant: 'weight',
			default: 'invalid'
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

	it('Allows a ValueDefinition of tagConstant with a valid constant', async () => {
		const input = deepCopy(legalBaseInput);
		input.tags = {
			tagA: {
				constants: {
					weight: 5
				}
			},
			tagB: {
				constants: {
					weight: 2
				}
			}
		};
		input.properties.engineering.value = {
			tagConstant: 'weight'
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

	it('Allows a ValueDefinition of tagConstant with a valid constant and default', async () => {
		const input = deepCopy(legalBaseInput);
		input.tags = {
			tagA: {
				constants: {
					weight: 5
				}
			},
			tagB: {
				constants: {
					weight: 2
				}
			}
		};
		input.properties.engineering.value = {
			tagConstant: 'weight',
			default: 3
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
				implied: 0
			},
			{
				"ref": "",
				"source": "a",
				"type": "engineering",
				implied: 0
			},
			{
				"ref": "a",
				"source": "b",
				"type": "ux",
				implied: 0
			},
			{
				"ref": "a",
				"source": "c",
				"type": "engineering",
				implied: 0
			},
			{
				"ref": "b",
				"source": "c",
				"type": "ux",
				implied: 0
			},
			{
				"ref": "b",
				"source": "d",
				"type": "engineering",
				implied: 0
			}
		];
		assert.deepStrictEqual(actual, golden);
	});



});

const NODE_A_BASE_VALUES = {
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
		const golden = `a
Node a

ux: 0
engineering: 3`;

		assert.deepStrictEqual(actual, golden);
	});

	it('fullDescription includes tags', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.data.hide = true;
		input.tags = {tagA: {displayName: 'Tag A'}};
		input.nodes.a.tags = 'tagA';
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.fullDescription();
		const golden = `a
Node a

ux: 0
engineering: 3

Tags:
Tag A`;

		assert.deepStrictEqual(actual, golden);
	});

	it('fullDescription(true) works for a named node', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.data.hide = true;
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.fullDescription(true);
		const golden = `a
Node a

data: 0
ux: 0
engineering: 3`;

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
		input.properties.data.value = {
			result: 'engineering'
		};
		input.properties.engineering.value ={
			result: 'ux'
		};
		const map = new AdjacencyMap(input);
		const actual = map.propertyNames;
		const golden = ['ux', 'engineering', 'data'];
		assert.deepStrictEqual(actual, golden);
	});

	it('Tests a ResultValue ref calculation', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.data.value = {result: 'engineering'};
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

	it('Tests a refValue ref calculation that uses self', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.value = {ref: '.'};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.values;
		const golden = {
			...NODE_A_BASE_VALUES,
			engineering: 4,
		};
		assert.deepStrictEqual(actual, golden);
	});

	//TODO: test that having a true/false/null in edge constants, node values,
	//etc all work.

	it('Tests a ResultValue ref calculation with two edges', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.data.value = {result: 'engineering'};
		input.properties.engineering.value = {result: 'ux'};
		input.nodes.a.edges.push({type: 'data'});
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
			value: [1, 4, 5]
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

	it('Correctly calculates a filter', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.combine = 'sum';
		input.properties.engineering.value = {
			filter: [0, 1, 0, 1],
			value: [0, 1, 2, 3]
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

	it('Correctly calculates a filter that filters away everything', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.combine = 'sum';
		input.properties.engineering.value = {
			filter: 0,
			value: [0, 1, 2, 3]
		};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.values;
		const golden = {
			...NODE_A_BASE_VALUES,
			engineering: NULL_SENTINEL,
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

	it('Correctly calculates a lenghtOf on edges', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.combine = 'sum';
		input.properties.engineering.value = {
			lengthOf: 'edges',
			value: 3
		};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.values;
		const golden = {
			...NODE_A_BASE_VALUES,
			engineering: 6.0,
		};
		assert.deepStrictEqual(actual, golden);
	});

	it('Correctly calculates a lenghtOf on refs', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.combine = 'sum';
		input.properties.engineering.value = {
			lengthOf: 'refs',
			value: 3
		};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.values;
		const golden = {
			...NODE_A_BASE_VALUES,
			//Ideally this would be 3.0 (one ref, de-duped) but we don't de-dupe refs.
			engineering: 6.0,
		};
		assert.deepStrictEqual(actual, golden);
	});

	it('Correctly calculates a statement that uses let/variable', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.combine = 'sum';
		input.properties.engineering.value = {
			let: 'foo',
			value: 3,
			block: {
				variable: 'foo'
			}
		};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.values;
		const golden = {
			...NODE_A_BASE_VALUES,
			engineering: 3
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

	it('Correctly calculates a base value with no edge', async () => {
		const input = deepCopy(legalBaseInput);
		input.nodes.a.values = {
			'ux': 5,
		};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.values;
		const golden = {
			...NODE_A_BASE_VALUES,
			ux: 5
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

	it('Correctly calculates a radius set on node below 0', async () => {
		const input = deepCopy(legalBaseInput);
		input.nodes.a.display = {
			radius: -1
		};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.radius;
		const golden = 0;
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

	it('Correctly calculates a color set on map', async () => {
		const input = deepCopy(legalBaseInput);
		input.display = {
			node: {
				color: {
					color: '#CCC'
				}
			}
		};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.color;
		const golden = color('#CCC');
		assert.deepStrictEqual(actual, golden);
	});


	it('Correctly calculates an opacity set on node', async () => {
		const input = deepCopy(legalBaseInput);
		input.nodes.a.display = {
			color: {
				color: '#CCC'
			}
		};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.color;
		const golden = color('#CCC');
		assert.deepStrictEqual(actual, golden);
	});

	it('Correctly handles a color shorthand set on node', async () => {
		const input = deepCopy(legalBaseInput);
		input.nodes.a.display = {
			color: '#CCC'
		};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.color;
		const golden = color('#CCC');
		assert.deepStrictEqual(actual, golden);
	});

	it('Correctly calculates a strokeWidth set on map', async () => {
		const input = deepCopy(legalBaseInput);
		input.display = {
			node: {
				strokeWidth: 10
			}
		};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.strokeWidth;
		const golden = 10;
		assert.deepStrictEqual(actual, golden);
	});


	it('Correctly calculates a strokeWidth set on node', async () => {
		const input = deepCopy(legalBaseInput);
		input.nodes.a.display = {
			strokeWidth: 10
		};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.strokeWidth;
		const golden = 10;
		assert.deepStrictEqual(actual, golden);
	});

	it('Correctly calculates a strokeWidth set on node below 0', async () => {
		const input = deepCopy(legalBaseInput);
		input.nodes.a.display = {
			strokeWidth: -1
		};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.strokeWidth;
		const golden = 0;
		assert.deepStrictEqual(actual, golden);
	});

	it('Correctly calculates a strokeWidth set on node that relies on a value', async () => {
		const input = deepCopy(legalBaseInput);
		input.nodes.a.display = {
			strokeWidth: {
				result: 'engineering'
			}
		};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.strokeWidth;
		const golden = NODE_A_BASE_VALUES.engineering;
		assert.deepStrictEqual(actual, golden);
	});

	it('Correctly calculates a strokeOpacity set on map', async () => {
		const input = deepCopy(legalBaseInput);
		input.display = {
			node: {
				strokeOpacity: 0.8
			}
		};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.strokeOpacity;
		const golden = 0.8;
		assert.deepStrictEqual(actual, golden);
	});


	it('Correctly calculates an strokeOpacity set on node', async () => {
		const input = deepCopy(legalBaseInput);
		input.nodes.a.display = {
			strokeOpacity: 0.8
		};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.strokeOpacity;
		const golden = 0.8;
		assert.deepStrictEqual(actual, golden);
	});

	it('Correctly calculates a strokeOpacity set on node that relies on a value', async () => {
		const input = deepCopy(legalBaseInput);
		input.nodes.a.display = {
			strokeOpacity: {
				result: 'engineering'
			}
		};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.strokeOpacity;
		//We expect it to be clipped
		const golden = 1.0;
		assert.deepStrictEqual(actual, golden);
	});

	it('Correctly calculates a strokeColor set on map', async () => {
		const input = deepCopy(legalBaseInput);
		input.display = {
			node: {
				strokeColor: {
					color: '#CCC'
				}
			}
		};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.strokeColor;
		const golden = color('#CCC');
		assert.deepStrictEqual(actual, golden);
	});


	it('Correctly calculates a strokeColor set on node', async () => {
		const input = deepCopy(legalBaseInput);
		input.nodes.a.display = {
			strokeColor: {
				color: '#CCC'
			}
		};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.strokeColor;
		const golden = color('#CCC');
		assert.deepStrictEqual(actual, golden);
	});

	it('Correctly handles a strokeColor shorthand set on node', async () => {
		const input = deepCopy(legalBaseInput);
		input.nodes.a.display = {
			strokeColor: '#CCC'
		};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.strokeColor;
		const golden = color('#CCC');
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

	it('Correctly handles libraries with display node override', async () => {
		const input = deepCopy(legalBaseInput);
		input.import = '_test_a_';
		LIBRARIES['_test_a_'] = {
			properties: {
				'_test_a_:one': {
					value: 1
				}
			},
			display: {
				node: {
					color: '#FFF'
				}
			},
			root: {
				'_test_a_:one': 3
			}
		};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.color;
		const golden = color('#FFF');
		assert.deepStrictEqual(actual, golden);
	});

	it('Correctly handles libraries with display edge override', async () => {
		const input = deepCopy(legalBaseInput);
		input.import = '_test_a_';
		LIBRARIES['_test_a_'] = {
			properties: {
				'_test_a_:one': {
					value: 1
				}
			},
			display: {
				edge: {
					color: '#FFF',
					distinct: true
				}
			},
			root: {
				'_test_a_:one': 3
			}
		};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.renderEdges;
		const golden = [
			{
				...BASE_RENDER_EDGE,
				color: color('#FFF')
			}
		];
		assert.deepStrictEqual(actual, golden);
	});

	it('Correctly handles libraries with display edgeCombiner override', async () => {
		const input = deepCopy(legalBaseInput);
		input.import = '_test_a_';
		LIBRARIES['_test_a_'] = {
			properties: {
				'_test_a_:one': {
					value: 1
				}
			},
			display: {
				edgeCombiner: {
					color: '#FFF',
				}
			},
			root: {
				'_test_a_:one': 3
			}
		};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.renderEdges;
		const golden = [
			{
				...BASE_RENDER_EDGE,
				color: color('#FFF')
			}
		];
		assert.deepStrictEqual(actual, golden);
	});

	it('ensure when noEdges provided excludeFromDefaultImplication automatically set', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.foo = {
			value: 3,
			calculateWhen: 'always'
		};
		const map = new AdjacencyMap(input);
		assert.deepStrictEqual(map.data.properties.foo.excludeFromDefaultImplication, true);
		// const node = map.node('a');
		// const actual = node.values;
		// const golden = {
		// 	...NODE_A_BASE_VALUES
		// }
		// assert.deepStrictEqual(actual, golden);
	});

	it('Correctly calculates a constant noEdges property even when no edges', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.foo = {
			value: 3,
			calculateWhen: 'always'
		};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.values;
		const golden = {
			...NODE_A_BASE_VALUES,
			foo: 3
		};
		assert.deepStrictEqual(actual, golden);
	});

	it('Correctly calculates a noEdges property even when no edges that relies on other values', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.foo = {
			value: {
				operator: '+',
				a: {result: 'engineering'},
				b: {result: 'ux'}
			},
			calculateWhen: 'always'
		};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.values;
		const golden = {
			...NODE_A_BASE_VALUES,
			foo: 3
		};
		assert.deepStrictEqual(actual, golden);
	});

	it('Correctly calculates map.rootEdges', async () => {
		const input = deepCopy(legalBaseInput);
		input.tags= {
			tagA: {
				root: true
			},
			tagB: {}
		};
		const map = new AdjacencyMap(input);
		const actual = map.rootTags;
		const golden = {
			tagA: true
		};
		assert.deepStrictEqual(actual, golden);
	});

	it('Allows node.tags as map', async () => {
		const input = deepCopy(legalBaseInput);
		input.tags = {
			tagA: {},
			tagB: {}
		};
		input.nodes.a.tags = {tagA: true};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.tags;
		const golden = {
			tagA: true
		};
		assert.deepStrictEqual(actual, golden);
	});

	it('Allows node.tags as list', async () => {
		const input = deepCopy(legalBaseInput);
		input.tags = {
			tagA: {},
			tagB: {}
		};
		input.nodes.a.tags = ['tagA', 'tagB'];
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.tags;
		const golden = {
			tagA: true,
			tagB: true
		};
		assert.deepStrictEqual(actual, golden);
	});

	it('Allows node.tags as a single tagID', async () => {
		const input = deepCopy(legalBaseInput);
		input.tags = {
			tagA: {},
			tagB: {root: true}
		};
		input.nodes.a.tags = 'tagA';

		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.tags;
		const golden = {
			tagA: true,
			tagB: true
		};
		assert.deepStrictEqual(actual, golden);

	});

	it('Allows node.tags to remove a tag in root', async () => {
		const input = deepCopy(legalBaseInput);
		input.tags = {
			tagA: {
				root: true
			},
			tagB: {}
		};
		input.nodes.a.tags = {
			tagA: false,
			tagB: true
		};

		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.tags;
		const golden = {
			tagB: true
		};
		assert.deepStrictEqual(actual, golden);

	});

	it('Allows node.tags to remove a tag in root', async () => {
		const input = deepCopy(legalBaseInput);
		input.tags = {
			tagA: {},
			tagB: {}
		};
		input.properties.ux.extendTags = true;
		input.nodes.a.tags = 'tagA';
		input.nodes.b.tags = 'tagB';

		const map = new AdjacencyMap(input);
		const node = map.node('b');
		const actual = node.tags;
		const golden = {
			//This one comes from node a
			tagA:true,
			tagB:true
		};
		assert.deepStrictEqual(actual, golden);

	});

	it('Correctly handles ValueDefinitionHasTags without all', async () => {
		const input = deepCopy(legalBaseInput);
		input.tags = {
			tagA: {},
			tagB: {}
		};
		input.nodes.a.tags = 'tagA';
		input.properties.engineering.value = {
			has: ['tagA', 'tagB']
		};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.values;
		const golden = {
			...NODE_A_BASE_VALUES,
			engineering: 1
		};
		assert.deepStrictEqual(actual, golden);

	});

	it('Correctly handles ValueDefinitionHasTags with which self included', async () => {
		const input = deepCopy(legalBaseInput);
		input.tags = {
			tagA: {},
			tagB: {}
		};
		input.nodes.a.tags = 'tagA';
		input.nodes.b.tags = 'tagB';
		input.nodes.b.edges.push({
			type: 'engineering',
			ref: 'a'
		});
		input.properties.engineering.value = {
			has: 'tagB',
			which: 'self'
		};
		input.properties.ux.extendTags = true;
		const map = new AdjacencyMap(input);
		const node = map.node('b');
		const actual = node.values;
		const golden = {
			engineering: 1,
			data: 0,
			ux: 4
		};
		assert.deepStrictEqual(actual, golden);

	});

	it('Correctly handles ValueDefinitionHasTags with which self excluded', async () => {
		const input = deepCopy(legalBaseInput);
		input.tags = {
			tagA: {},
			tagB: {}
		};
		input.nodes.a.tags = 'tagA';
		input.nodes.b.tags = 'tagB';
		input.nodes.b.edges.push({
			type: 'engineering',
			ref: 'a'
		});
		input.properties.engineering.value = {
			has: 'tagA',
			which: 'self'
		};
		input.properties.ux.extendTags = true;
		const map = new AdjacencyMap(input);
		const node = map.node('b');
		const actual = node.values;
		const golden = {
			engineering: 0,
			data: 0,
			ux: 4
		};
		assert.deepStrictEqual(actual, golden);

	});

	it('Correctly handles ValueDefinitionHasTags with which extended included', async () => {
		const input = deepCopy(legalBaseInput);
		input.tags = {
			tagA: {},
			tagB: {}
		};
		input.nodes.a.tags = 'tagA';
		input.nodes.b.tags = 'tagB';
		input.nodes.b.edges.push({
			type: 'engineering',
			ref: 'a'
		});
		input.properties.engineering.value = {
			has: 'tagB',
			which: 'extended'
		};
		input.properties.ux.extendTags = true;
		const map = new AdjacencyMap(input);
		const node = map.node('b');
		const actual = node.values;
		const golden = {
			engineering: 0,
			data: 0,
			ux: 4
		};
		assert.deepStrictEqual(actual, golden);

	});

	it('Correctly handles ValueDefinitionHasTags with which extended excluded', async () => {
		const input = deepCopy(legalBaseInput);
		input.tags = {
			tagA: {},
			tagB: {}
		};
		input.nodes.a.tags = 'tagA';
		input.nodes.b.tags = 'tagB';
		input.nodes.b.edges.push({
			type: 'engineering',
			ref: 'a'
		});
		input.properties.engineering.value = {
			has: 'tagA',
			which: 'extended'
		};
		input.properties.ux.extendTags = true;
		const map = new AdjacencyMap(input);
		const node = map.node('b');
		const actual = node.values;
		const golden = {
			engineering: 1,
			data: 0,
			ux: 4
		};
		assert.deepStrictEqual(actual, golden);

	});


	it('Correctly handles ValueDefinitionHasTags with all', async () => {
		const input = deepCopy(legalBaseInput);
		input.tags = {
			tagA: {},
			tagB: {}
		};
		input.nodes.a.tags = 'tagA';
		input.properties.engineering.value = {
			has: ['tagA', 'tagB'],
			all: true
		};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.values;
		const golden = {
			...NODE_A_BASE_VALUES,
			engineering: 0
		};
		assert.deepStrictEqual(actual, golden);

	});

	it('Correctly handles ValueDefinitionTagConstant', async () => {
		const input = deepCopy(legalBaseInput);
		input.tags = {
			tagA: {
				constants: {
					weight: 5
				}
			},
			tagB: {
				constants: {
					weight: 7
				}
			}
		};
		input.nodes.a.tags = ['tagA', 'tagB'];
		input.properties.engineering.value = {
			tagConstant: 'weight'
		};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.values;
		const golden = {
			...NODE_A_BASE_VALUES,
			engineering: 6
		};
		assert.deepStrictEqual(actual, golden);

	});

	it('Correctly handles ValueDefinitionTagConstant with which self', async () => {
		const input = deepCopy(legalBaseInput);
		input.tags = {
			tagA: {
				constants: {
					weight: 5
				}
			},
			tagB: {
				constants: {
					weight: 7
				}
			}
		};
		input.nodes.b.edges.push({
			type: 'engineering',
			ref: 'a'
		});
		input.nodes.a.tags = 'tagA';
		input.nodes.b.tags = 'tagB';
		input.properties.ux.extendTags = true;
		input.properties.engineering.value = {
			tagConstant: 'weight',
			which: 'self'
		};
		const map = new AdjacencyMap(input);
		const node = map.node('b');
		const actual = node.values;
		const golden = {
			data: 0,
			ux: 4,
			engineering: 7
		};
		assert.deepStrictEqual(actual, golden);

	});

	it('Correctly handles ValueDefinitionTagConstant with which extended', async () => {
		const input = deepCopy(legalBaseInput);
		input.tags = {
			tagA: {
				constants: {
					weight: 5
				}
			},
			tagB: {
				constants: {
					weight: 7
				}
			}
		};
		input.nodes.b.edges.push({
			type: 'engineering',
			ref: 'a'
		});
		input.nodes.a.tags = 'tagA';
		input.nodes.b.tags = 'tagB';
		input.properties.ux.extendTags = true;
		input.properties.engineering.value = {
			tagConstant: 'weight',
			which: 'extended'
		};
		const map = new AdjacencyMap(input);
		const node = map.node('b');
		const actual = node.values;
		const golden = {
			data: 0,
			ux: 4,
			engineering: 5
		};
		assert.deepStrictEqual(actual, golden);

	});

	it('Correctly handles ValueDefinitionTagConstant with a default', async () => {
		const input = deepCopy(legalBaseInput);
		input.tags = {
			tagA: {
				constants: {
					weight: 5
				}
			},
			tagB: {
				constants: {
					weight: 7
				}
			}
		};
		input.nodes.a.tags = [];
		input.properties.engineering.value = {
			tagConstant: 'weight',
			default: 3
		};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.values;
		const golden = {
			...NODE_A_BASE_VALUES,
			engineering: 3
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

describe('wrapArrays', () => {
	it('all same length', async () => {
		const input = [
			[0],
			[0],
			[0]
		];
		const golden = [
			[0],
			[0],
			[0]
		];
		const actual = wrapArrays(...input);
		assert.deepStrictEqual(actual, golden);
	});

	it('one longer', async () => {
		const input = [
			[0, 1],
			[0],
			[0]
		];
		const golden = [
			[0, 1],
			[0, 0],
			[0, 0]
		];
		const actual = wrapArrays(...input);
		assert.deepStrictEqual(actual, golden);
	});

	it('one longer, another slightly shorter', async () => {
		const input = [
			[0, 1, 2],
			[0, 1],
			[0]
		];
		const golden = [
			[0, 1, 2],
			[0, 1, 0],
			[0, 0, 0]
		];
		const actual = wrapArrays(...input);
		assert.deepStrictEqual(actual, golden);
	});

});

const BASE_RENDER_EDGE = {
	opacity: 0.4,
	ref: '',
	source: 'a',
	width: 1.5,
	color: color('#555'),
	bump: 0.5
};

describe('renderEdges', () => {
	it('basic case', async () => {
		const input = deepCopy(legalBaseInput);

		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.renderEdges;
		const golden = [
			{...BASE_RENDER_EDGE}
		];
		assert.deepStrictEqual(actual, golden);
	});

	it('basic case with edge color shorthand', async () => {
		const input = deepCopy(legalBaseInput);
		input.display = {
			edge: {
				distinct: true,
				color: '#FFF'
			}
		};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.renderEdges;
		const golden = [
			{
				...BASE_RENDER_EDGE,
				color: color('#FFF')
			}
		];
		assert.deepStrictEqual(actual, golden);
	});

	it('basic case with edgeCombiner color shorthand', async () => {
		const input = deepCopy(legalBaseInput);
		input.display = {
			edgeCombiner: {
				color: '#FFF'
			}
		};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.renderEdges;
		const golden = [
			{
				...BASE_RENDER_EDGE,
				color: color('#FFF')
			}
		];
		assert.deepStrictEqual(actual, golden);
	});

	it('basic case no combining', async () => {
		const input = deepCopy(legalBaseInput);
		input.display = {
			edge: {
				width: {
					lengthOf: 'edges',
					value: 1.5
				}
			},
			edgeCombiner: {
				width: {
					lengthOf: 'input',
					value: 1.5
				}
			}
		};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.renderEdges;
		const golden = [
			{
				...BASE_RENDER_EDGE,
				bump: 0.3
			},
			{
				...BASE_RENDER_EDGE,
				bump: 0.7
			}
		];
		assert.deepStrictEqual(actual, golden);
	});

	it('basic case distinct', async () => {
		const input = deepCopy(legalBaseInput);
		input.display = {
			edge: {
				distinct: {
					lengthOf: 'edges',
					value: true
				}
			}
		};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.renderEdges;
		const golden = [
			{
				...BASE_RENDER_EDGE,
				bump: 0.3
			},
			{
				...BASE_RENDER_EDGE,
				bump: 0.7
			}
		];
		assert.deepStrictEqual(actual, golden);
	});

	it('basic case with two other edges', async () => {
		const input = deepCopy(legalBaseInput);
		input.nodes.a.edges.push(
			{type: 'ux'},
			{type: 'data'}
		);
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.renderEdges;
		const golden = [
			//Everything merged together
			{
				...BASE_RENDER_EDGE,
				width: BASE_RENDER_EDGE.width * 3
			}
		];
		assert.deepStrictEqual(actual, golden);
	});

	it('basic case with two other edge engineering distinct', async () => {
		const input = deepCopy(legalBaseInput);
		input.nodes.a.edges.push(
			{type: 'ux'},
			{type: 'data'}
		);
		input.properties.engineering.display = {
			distinct: {
				lengthOf: 'edges',
				value: true
			}
		};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.renderEdges;
		const golden = [
			//Each engineering node
			{
				...BASE_RENDER_EDGE,
				bump: 0.09999999999999998
			},
			{
				...BASE_RENDER_EDGE,
				bump: 0.5
			},
			//Everything else
			{
				...BASE_RENDER_EDGE,
				bump: 0.9,
				width: BASE_RENDER_EDGE.width * 2
			}

		];
		assert.deepStrictEqual(actual, golden);
	});

	it('basic case with two other edge engineering distinct no combine', async () => {
		const input = deepCopy(legalBaseInput);
		input.nodes.a.edges.push(
			{type: 'ux'},
			{type: 'data'}
		);
		input.properties.engineering.display = {
			distinct: {
				lengthOf: 'edges', 
				value: true
			}
		};
		input.display = {
			edgeCombiner: {
				width: {
					lengthOf: 'input',
					value: 1.5
				}
			}
		};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.renderEdges;
		const golden = [
			//Each engineering node
			{
				...BASE_RENDER_EDGE,
				bump: 0.0
			},
			{
				...BASE_RENDER_EDGE,
				bump: 1/3
			},
			//UX node
			{
				...BASE_RENDER_EDGE,
				bump: 2/3
			},
			//data node
			{
				...BASE_RENDER_EDGE,
				bump: 1.0
			}
		];
		assert.deepStrictEqual(actual, golden);
	});

	it('basic case with two other edge engineering no combine', async () => {
		const input = deepCopy(legalBaseInput);
		input.nodes.a.edges.push(
			{type: 'ux'},
			{type: 'data'}
		);
		input.display = {
			edge: {
				distinct: {
					lengthOf: 'edges',
					value: false
				}
			},
			edgeCombiner: {
				width: {
					lengthOf: 'input',
					value: 1.5
				}
			}
		};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.renderEdges;
		const golden = [
			//Each engineering node
			{
				...BASE_RENDER_EDGE,
				bump: 0.0
			},
			{
				...BASE_RENDER_EDGE,
				bump: 1/3
			},
			//UX node
			{
				...BASE_RENDER_EDGE,
				bump: 2/3
			},
			//data node
			{
				...BASE_RENDER_EDGE,
				bump: 1.0
			}
		];
		assert.deepStrictEqual(actual, golden);
	});

	it('basic case with two other edge engineering combines, no type combine', async () => {
		const input = deepCopy(legalBaseInput);
		input.nodes.a.edges.push(
			{type: 'ux'},
			{type: 'data'}
		);
		input.properties.engineering.display = {
			//Override the default lengthOf to make it a constant
			width: 1.5
		};
		input.display = {
			edgeCombiner: {
				width: {
					lengthOf: 'input',
					value: 1.5
				}
			}
		};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.renderEdges;
		const golden = [
			//Each engineering node
			{
				...BASE_RENDER_EDGE,
				bump: 0.09999999999999998
			},
			//UX node
			{
				...BASE_RENDER_EDGE,
				bump: 0.5
			},
			//data node
			{
				...BASE_RENDER_EDGE,
				bump: 0.9
			}
		];
		assert.deepStrictEqual(actual, golden);
	});

	it('edge width clips', async () => {
		const input = deepCopy(legalBaseInput);
		input.display = {
			edge: {
				width: -10
			},
			edgeCombiner: {
				width: 'input'
			}
		};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.renderEdges;
		const golden = [
			//When the width is 0 it's removed
		];
		assert.deepStrictEqual(actual, golden);
	});

	it('edge opacity clips', async () => {
		const input = deepCopy(legalBaseInput);
		input.display = {
			edge: {
				//Make it combine
				width: 1.5,
				opacity: -10
			},
			edgeCombiner: {
				opacity: 'input'
			}
		};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.renderEdges;
		const golden = [
			{
				...BASE_RENDER_EDGE,
				opacity: 0.0
			},
		];
		assert.deepStrictEqual(actual, golden);
	});

	it('edgeCombiner width clips', async () => {
		const input = deepCopy(legalBaseInput);
		input.display = {
			edgeCombiner: {
				width: -10
			}
		};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.renderEdges;
		const golden = [
			//An edge with width 0 will be removed
		];
		assert.deepStrictEqual(actual, golden);
	});

	it('edgeCombiner opacity clips', async () => {
		const input = deepCopy(legalBaseInput);
		input.display = {
			edgeCombiner: {
				opacity: -10
			}
		};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.renderEdges;
		const golden = [
			{
				...BASE_RENDER_EDGE,
				opacity: 0.0
			},
		];
		assert.deepStrictEqual(actual, golden);
	});

});

describe('impliedEdges', () => {
	it('basic case defined on property definition', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.implies = '*';
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.edges;
		const golden = [
			{
				type: 'engineering',
				ref: '',
				source: 'a',
				weight: 4,
				implied: 0
			},
			{
				type: 'engineering',
				ref: '',
				source: 'a',
				implied: 0
			},
			{
				type: 'ux',
				ref: '',
				source: 'a',
				implied: 1
			},
			{
				type: 'data',
				ref: '',
				source: 'a',
				implied: 1
			}
		];
		assert.deepStrictEqual(actual, golden);
	});

	it('basic case implied on edge itself', async () => {
		const input = deepCopy(legalBaseInput);
		input.nodes.a.edges[0].implies = '*';
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.edges;
		const golden = [
			{
				type: 'engineering',
				ref: '',
				source: 'a',
				weight: 4,
				implied: 0,
			},
			{
				type: 'engineering',
				ref: '',
				source: 'a',
				implied: 0
			},
			{
				type: 'ux',
				ref: '',
				source: 'a',
				implied: 1
			},
			{
				type: 'data',
				ref: '',
				source: 'a',
				implied: 1
			}
		];
		assert.deepStrictEqual(actual, golden);
	});

	it('basic case property enumeration on property definition', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.implies = ['engineering', 'ux'];
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.edges;
		const golden = [
			{
				type: 'engineering',
				ref: '',
				source: 'a',
				weight: 4,
				implied: 0
			},
			{
				type: 'engineering',
				ref: '',
				source: 'a',
				implied: 0
			},
			{
				type: 'ux',
				ref: '',
				source: 'a',
				implied: 1
			}
		];
		assert.deepStrictEqual(actual, golden);
	});

	it('basic case property exclusion on property definition', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.implies = {exclude: ['engineering', 'ux']};
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.edges;
		const golden = [
			{
				type: 'engineering',
				ref: '',
				source: 'a',
				weight: 4,
				implied: 0
			},
			{
				type: 'engineering',
				ref: '',
				source: 'a',
				implied: 0
			},
			{
				type: 'data',
				ref: '',
				source: 'a',
				implied: 1
			}
		];
		assert.deepStrictEqual(actual, golden);
	});

	it('basic case with one property excluded', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.implies = '*';
		input.properties.ux.excludeFromDefaultImplication = true;
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.edges;
		const golden = [
			{
				type: 'engineering',
				ref: '',
				source: 'a',
				weight: 4,
				implied: 0
			},
			{
				type: 'engineering',
				ref: '',
				source: 'a',
				implied: 0
			},
			{
				type: 'data',
				ref: '',
				source: 'a',
				implied: 1
			}
		];
		assert.deepStrictEqual(actual, golden);
	});

	it('basic case with one property excluded but explicitly requested', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.engineering.implies = ['ux', 'data'];
		//Even though ux says it shouldnt' be implied, it is explicitly
		//requested by another edge so will be included.
		input.properties.ux.excludeFromDefaultImplication = true;
		const map = new AdjacencyMap(input);
		const node = map.node('a');
		const actual = node.edges;
		const golden = [
			{
				type: 'engineering',
				ref: '',
				source: 'a',
				weight: 4,
				implied: 0
			},
			{
				type: 'engineering',
				ref: '',
				source: 'a',
				implied: 0
			},
			{
				type: 'ux',
				ref: '',
				source: 'a',
				implied: 1
			},
			{
				type: 'data',
				ref: '',
				source: 'a',
				implied: 1
			}
		];
		assert.deepStrictEqual(actual, golden);
	});

});

describe('scenarios', () => {
	it('base case', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.ux.value = {
			ref: 'ux'
		};
		input.scenarios = {
			one: {
				nodes: {
					a: {
						engineering: 2.0,
						ux: 10.0,
					}
				}
			}
		};
		const map = new AdjacencyMap(input);
		assert.deepStrictEqual(map.scenarioName, '');
		const node = map.node('a');
		assert.deepStrictEqual(node.values.ux, 0.0);
		const nodeB = map.node('b');
		assert.deepStrictEqual(nodeB.values.ux, 0.0);
		map.scenarioName = 'one';
		assert.deepStrictEqual(node.values.ux, 10.0);
		assert.deepStrictEqual(nodeB.values.ux, 10.0);

	});

	it('scenario passed in constructor', async () => {
		const input = deepCopy(legalBaseInput);
		input.properties.ux.value = {
			ref: 'ux'
		};
		input.scenarios = {
			one: {
				nodes: {
					a: {
						engineering: 2.0,
						ux: 10.0,
					}
				}
			}
		};
		const map = new AdjacencyMap(input, 'one');
		assert.deepStrictEqual(map.scenarioName, 'one');
		const node = map.node('a');
		assert.deepStrictEqual(node.values.ux, 10.0);
		const nodeB = map.node('b');
		assert.deepStrictEqual(nodeB.values.ux, 10.0);
	});

	it('scenario with ValueDefinition input', async () => {
		const input = deepCopy(legalBaseInput);
		input.scenarios = {
			one: {
				nodes: {
					a: {
						engineering: {
							operator: '+',
							a: 'input',
							b: 3.0
						},
					}
				}
			}
		};
		const map = new AdjacencyMap(input, 'one');
		const node = map.node('a');
		assert.deepStrictEqual(node.values.engineering, NODE_A_BASE_VALUES.engineering + 3.0);

	});

	it('scenario with ValueDefinition input on root', async () => {
		const input = deepCopy(legalBaseInput);
		input.scenarios = {
			one: {
				nodes: {
					'': {
						engineering: {
							operator: '+',
							a: 'input',
							b: 3.0
						},
					}
				}
			}
		};
		const map = new AdjacencyMap(input, 'one');
		const node = map.node('');
		assert.deepStrictEqual(node.values.engineering, 7.0);

	});

	it('barfs for scenario with ValueDefinition of illegal type', async () => {
		const input = deepCopy(legalBaseInput);
		input.scenarios = {
			one: {
				nodes: {
					a: {
						engineering: {
							operator: '+',
							a: 'input',
							b: {
								result: 'ux'
							}
						},
					}
				}
			}
		};
		const fn = () => {
			new AdjacencyMap(input, 'one');
		};
		assert.throws(fn);
	});

	it('barfs for scenario with extension with a cycle', async () => {
		const input = deepCopy(legalBaseInput);
		input.scenarios = {
			one: {
				extends: 'three',
				nodes: {
					a: {
						engineering: 10
					}
				}
			},
			two: {
				extends: 'one',
				nodes: {
					b: {
						ux: 5
					}
				}
			},
			three: {
				extends: 'two',
				nodes: {
					c: {
						ux: 8
					}
				}
			}
		};
		const fn = () => {
			new AdjacencyMap(input);
		};
		assert.throws(fn);
	});

	it('barfs for scenario with extension of root scenario', async () => {
		const input = deepCopy(legalBaseInput);
		input.scenarios = {
			one: {
				extends: '',
				nodes: {
					a: {
						engineering: 10
					}
				}
			}
		};
		const fn = () => {
			new AdjacencyMap(input);
		};
		assert.throws(fn);
	});

	it('barfs for scenario with extension of non-exsitent other scenario', async () => {
		const input = deepCopy(legalBaseInput);
		input.scenarios = {
			one: {
				extends: 'invalid',
				nodes: {
					a: {
						engineering: 10
					}
				}
			}
		};
		const fn = () => {
			new AdjacencyMap(input);
		};
		assert.throws(fn);
	});

	it('Correctly calculates a scenario with direct extension', async () => {
		const input = deepCopy(legalBaseInput);
		input.scenarios = {
			one: {
				nodes: {
					a: {
						engineering: 10
					},
					b: {
						engineering: 3
					}
				}
			},
			two: {
				extends: 'one',
				nodes: {
					b: {
						ux: 5
					}
				}
			}
		};
		const map = new AdjacencyMap(input, 'two');
		const node = map.node('b');
		const actual = node.values;
		const golden = {
			data: 0,
			ux: 5,
			engineering: 3,
		};
		assert.deepStrictEqual(actual, golden);
	});

	it('Correctly calculates a scenario with indirect extension', async () => {
		const input = deepCopy(legalBaseInput);
		input.scenarios = {
			one: {
				nodes: {
					a: {
						engineering: 10
					},
					b: {
						engineering: 3
					}
				}
			},
			two: {
				extends: 'one',
				nodes: {
					b: {
						ux: 5
					}
				}
			},
			three: {
				extends: 'two',
				nodes: {
					a: {
						ux: 2
					}
				}
			}
		};
		const map = new AdjacencyMap(input, 'three');
		const node = map.node('a');
		const actual = node.values;
		const golden = {
			data: 0,
			ux: 2,
			engineering: 10,
		};
		assert.deepStrictEqual(actual, golden);
	});

});

describe('edgeDefinition ergonomics', () => {
	it('baseline', async () => {
		const input = {
			properties: {
				engineering: {
					value: 3,
					constants: {
						weight: 1.0
					}
				},
				ux: {
					value: 4,
					description: "A description of ux"
				},
			},
			nodes: {
				a: {
					description: "Node a",
					edges: [
						{
							type: "engineering",
							weight: 4.0
						},
						{
							type: "engineering"
						}
					]
				},
				b: {
					description: "Node b",
				}
			}
		};
		const goldenNodeA = {
			description: "Node a",
			display: {},
			edges: [
				{
					type: "engineering",
					weight: 4.0
				},
				{
					type: "engineering"
				}
			],
			tags: {},
			values: {}
		};
		const actualFull = processMapDefinition(input);
		const actualNodeA = actualFull.nodes.a;
		assert.deepStrictEqual(actualNodeA, goldenNodeA);
	});

	it('ref with array', async () => {
		const input = {
			properties: {
				engineering: {
					value: 3,
					constants: {
						weight: 1.0
					}
				},
				ux: {
					value: 4,
					description: "A description of ux"
				},
			},
			nodes: {
				a: {
					description: "Node a",
					edges: {
						'': [
							{
								type: "engineering",
								weight: 4.0
							},
							{
								type: "engineering"
							}
						]
					}
				},
				b: {
					description: "Node b",
				}
			}
		};
		const goldenNodeA = {
			description: "Node a",
			display: {},
			edges: [
				{
					ref: '',
					type: "engineering",
					weight: 4.0
				},
				{
					ref: '',
					type: "engineering"
				}
			],
			tags: {},
			values: {}
		};
		const actualFull = processMapDefinition(input);
		const actualNodeA = actualFull.nodes.a;
		assert.deepStrictEqual(actualNodeA, goldenNodeA);
	});

	it('ref with map with array', async () => {
		const input = {
			properties: {
				engineering: {
					value: 3,
					constants: {
						weight: 1.0
					}
				},
				ux: {
					value: 4,
					description: "A description of ux"
				},
			},
			nodes: {
				a: {
					description: "Node a",
					edges: {
						'': {
							'engineering': [
								{
									weight: 4.0
								},
								{}
							]
						}
					}
				},
				b: {
					description: "Node b",
				}
			}
		};
		const goldenNodeA = {
			description: "Node a",
			display: {},
			edges: [
				{
					ref: '',
					type: "engineering",
					weight: 4.0
				},
				{
					ref: '',
					type: "engineering"
				}
			],
			tags: {},
			values: {}
		};
		const actualFull = processMapDefinition(input);
		const actualNodeA = actualFull.nodes.a;
		assert.deepStrictEqual(actualNodeA, goldenNodeA);
	});

	it('ref with map with single item', async () => {
		const input = {
			properties: {
				engineering: {
					value: 3,
					constants: {
						weight: 1.0
					}
				},
				ux: {
					value: 4,
					description: "A description of ux"
				},
			},
			nodes: {
				a: {
					description: "Node a",
					edges: {
						'': {
							'engineering': {
								weight: 4.0
							}
						}
					}
				},
				b: {
					description: "Node b",
				}
			}
		};
		const goldenNodeA = {
			description: "Node a",
			display: {},
			edges: [
				{
					ref: '',
					type: "engineering",
					weight: 4.0
				}
			],
			tags:{},
			values: {}
		};
		const actualFull = processMapDefinition(input);
		const actualNodeA = actualFull.nodes.a;
		assert.deepStrictEqual(actualNodeA, goldenNodeA);
	});
});