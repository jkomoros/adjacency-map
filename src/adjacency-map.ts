import {
	EdgeDefinition,
	EdgeType,
	EdgeValue,
	JSONData,
	NodeDefinition,
	NodeID,
	NodeValues,
	NodeValuesMap,
	SimpleGraph,
	TreeGraph,
	TreeGraphWithDetails,
	ValueDefinition,
	ValueDefinitionRefValue,
	ValueDefintionEdgeConstant
} from './types.js';

import {
	tidyLongestTree,
	topologicalSort,
	treeGraphFromParentGraph
} from './graph.js';

import {
	ROOT_ID
} from './constants.js';

import {
	DEFAULT_REDUCER,
	REDUCERS
} from './reduce.js';

const RESERVED_VALUE_DEFINITION_PROPERTIES : {[name : string] : true} = {
	'ref': true,
	'type': true
};

const valueDefintionIsEdgeConstant = (definition : ValueDefinition) : definition is ValueDefintionEdgeConstant => {
	if (!definition || typeof definition != 'object') return false;
	if (Array.isArray(definition)) return false;
	return definition.type == 'edge';
};

const valueDefintionIsRefValue = (definition : ValueDefinition) : definition is ValueDefinitionRefValue => {
	if (!definition || typeof definition != 'object') return false;
	if (Array.isArray(definition)) return false;
	return definition.type == 'ref';
};

const validateValueDefinition = (definition : ValueDefinition, edgeDefinition : EdgeDefinition, exampleValue : NodeValues) : void => {
	if (typeof definition == 'number') return;
	if (typeof definition == 'object' && Array.isArray(definition)) {
		if (definition.some(item => typeof item != 'number')) throw new Error('An array was provided but some items were not numbers');
		if (definition.length == 0) throw new Error('If an array of numbers is provided there must be at least one');
		return;
	}
	if (valueDefintionIsEdgeConstant(definition)) {
		if (RESERVED_VALUE_DEFINITION_PROPERTIES[definition.property]) throw new Error(definition.property + ' is a reserved edge property name');
		const constants = edgeDefinition.constants || {};
		if (!constants[definition.property]) throw new Error(definition.property + ' for edge type value definition but that constant doesn\'t exist for that type.');
		return;
	}
	if (valueDefintionIsRefValue(definition)) {
		if (exampleValue[definition.property] == undefined) throw new Error(definition.property + ' is not a defined edge type');
		return;
	}
	const _exhaustiveCheck : never = definition;
	throw new Error('Illegal value for definition');
	return _exhaustiveCheck;
};

export const extractSimpleGraph = (data : JSONData) : SimpleGraph => {
	const result : SimpleGraph = {};
	for (const [id, value] of Object.entries(data.nodes)) {
		const edges : {[id : NodeID] : true} = {};
		for (const edge of value.values || []) {
			const ref = edge.ref || ROOT_ID;
			edges[ref] = true;
		}
		result[id] = edges;
	}
	result[ROOT_ID] = {};
	return result;
};

const validateData = (data : JSONData) : void => {
	if (!data) throw new Error('No data provided');
	if (!data.nodes) throw new Error('No nodes provided');
	//It is allowed for root to be empty.
	if (!data.types || Object.keys(data.types).length == 0) throw new Error('No edge types provided');
	for (const [nodeName, nodeData] of Object.entries(data.nodes)) {
		if (!nodeData.description) throw new Error(nodeName + ' has no description');
		const nodeValues = nodeData.values || [];
		for (const edge of nodeValues) {
			if (!edge.type) throw new Error(nodeName + ' has an edge with no type');
			if (!data.types[edge.type]) throw new Error(nodeName + ' has an edge of type ' + edge.type + ' which is not included in types');
		}
	}
	const exampleValues = Object.fromEntries(Object.keys(data.types).map(typeName => [typeName, 1.0]));
	for(const [type, edgeDefinition] of Object.entries(data.types)) {
		try {
			validateValueDefinition(edgeDefinition.value, edgeDefinition, exampleValues);
		} catch (err) {
			throw new Error(type + ' does not have a legal value definition: ' + err);
		}
		if (edgeDefinition.reducer && !REDUCERS[edgeDefinition.reducer]) throw new Error('Unknown reducer: ' + edgeDefinition.reducer);
		if (edgeDefinition.description && typeof edgeDefinition.description != 'string') throw new Error(type + ' has a description not of type string');
		if (edgeDefinition.constants) {
			for (const [constantName, constantValue] of Object.entries(edgeDefinition.constants)) {
				if (RESERVED_VALUE_DEFINITION_PROPERTIES[constantName]) throw new Error(constantName + ' was present in constants for ' + type + ' but is reserved');
				if (typeof constantValue != 'number') throw new Error(type + ' constant ' + constantName + ' was not number as expected');
			}
		}
	}
	if (data.root) {
		if (typeof data.root != 'object') throw new Error('root if provided must be an object');
		for (const [rootName, rootValue] of Object.entries(data.root)) {
			if (typeof rootValue != 'number') throw new Error('root property ' + rootName + ' is not a number as expected');
			if (!data.types[rootName]) throw new Error('root property ' + rootName + ' is not defined in types');
		}
	}
	try {
		topologicalSort(extractSimpleGraph(data));
	} catch (err) {
		throw new Error('The edges provided did not form a DAG');
	}
};

//TODO: is there a way to make it clear this must return an array with at least
//one number?
const calculateValue = (definition : ValueDefinition, edges : EdgeValue[], refs : AdjacencyMapNode[]) : number[] => {
	if (typeof definition == 'number') return [definition];

	if (Array.isArray(definition)) return definition;

	if (valueDefintionIsEdgeConstant(definition)) {
		return edges.map(edge => edge[definition.property] as number);
	}
	if (valueDefintionIsRefValue(definition)) {
		return refs.map(ref => ref.values).map(values => values[definition.property]);
	}

	const _exhaustiveCheck : never = definition;
	throw new Error('Illegal value for definition');
	return _exhaustiveCheck;
};

const treeGraphWithDetails = (graph : TreeGraph, map : AdjacencyMap) : TreeGraphWithDetails => {
	const node = map.node(graph.name);
	const result : TreeGraphWithDetails = {
		name: graph.name,
		description: node.description,
		values: node.values
	};
	if (graph.children) result.children = graph.children.map(child => treeGraphWithDetails(child, map));
	return result;
};

export class AdjacencyMap {
	
	_data : JSONData;
	_nodes : {[id : NodeID] : AdjacencyMapNode};
	_cachedRoot : NodeValues;

	constructor(data : JSONData) {
		//Will throw if it doesn't validate
		validateData(data);
		if (!data) throw new Error('undefined data');
		//TODO: deep freeze a copy of data
		this._data = data;
		this._nodes = {};
	}

	get edgeTypes() : EdgeType[] {
		return Object.keys(this._data.types);
	}

	get data() : JSONData {
		return this._data;
	}

	get root() : NodeValues {
		if (!this._cachedRoot) {
			const baseObject = Object.fromEntries(this.edgeTypes.map(typ => [typ, 0.0]));
			this._cachedRoot = {...baseObject, ...this._data.root};
		}
		return this._cachedRoot;
	}

	node(id : NodeID) : AdjacencyMapNode {
		if (!this._nodes[id]) {
			if (id != ROOT_ID && !this._data.nodes[id]) throw new Error('ID ' + id + ' does not exist in input');
			this._nodes[id] = new AdjacencyMapNode(this, this._data.nodes[id], id == ROOT_ID);
		}
		return this._nodes[id];
	}

	nodeValues() : NodeValuesMap {
		//TODO: cache. Not a huge deal because the heavy lifting is cached behind node().
		return Object.fromEntries(Object.keys(this._data.nodes).map(id => [id, this.node(id).values]));
	}

	treeGraph() : TreeGraphWithDetails {
		//TODO: cache
		const simpleGraph = extractSimpleGraph(this._data);
		const longestTree = tidyLongestTree(simpleGraph);
		const treeGraph = treeGraphFromParentGraph(longestTree);
		return treeGraphWithDetails(treeGraph, this);
	}
}

class AdjacencyMapNode {
	_map : AdjacencyMap;
	_data : NodeDefinition | undefined;
	_values : NodeValues;
	_isRoot : boolean;

	constructor(parent : AdjacencyMap, data : NodeDefinition | undefined, isRoot = false) {
		this._map = parent;
		this._data = data;
		this._isRoot = isRoot;
	}

	_computeValues() : NodeValues {
		const result = {...this._map.root};
		const edgeByType : {[type : EdgeType] : EdgeValue[]} = {};
		const values = this._data?.values || [];
		for (const edge of values) {
			if (!edgeByType[edge.type]) edgeByType[edge.type] = [];
			edgeByType[edge.type].push(edge);
		}
		for (const [type, rawEdges] of Object.entries(edgeByType)) {
			const typeDefinition = this._map.data.types[type];
			const edgeValueDefinition = typeDefinition.value;
			const constants = typeDefinition.constants || {};
			const defaultedEdges = rawEdges.map(edge => ({...constants, ...edge}));
			//TODO: should we make it illegal to have an edge of same type and ref on a node? 
			const refs = rawEdges.map(edge => this._map.node(edge.ref || ''));
			const values = calculateValue(edgeValueDefinition, defaultedEdges, refs);
			if (values.length == 0) throw new Error('values was not at least of length 1');
			const finalReducer = typeDefinition.reducer ? REDUCERS[typeDefinition.reducer] : DEFAULT_REDUCER;
			result[type] = finalReducer(values)[0];
		}
		return result;
	}

	get isRoot() : boolean {
		return this._isRoot;
	}

	get description() : string {
		return this._data ? this._data.description : '';
	}

	/**
	 * The final computed values
	 */
	get values() : NodeValues {
		if (this.isRoot) return this._map.root;
		if (!this._values) {
			this._values = this._computeValues();
		}
		return this._values;
	}
}