import {
	EdgeType,
	EdgeValue,
	JSONData,
	NodeData,
	NodeID,
	NodeValues,
	NodeValuesMap,
	SimpleGraph,
	ValueDefinition
} from './types.js';

import {
	deepCopy
} from './util.js';

const ROOT_ID : NodeID = '';

const validateValueDefinition = (definition : ValueDefinition) : void => {
	if (typeof definition == 'number') return;
	const _exhaustiveCheck : never = definition;
	throw new Error('Illegal value for definition');
	return _exhaustiveCheck;
};

const extractSimpleGraph = (data : JSONData) : SimpleGraph => {
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

const incomingGraph = (graph : SimpleGraph) : SimpleGraph => {
	const result : SimpleGraph = {};
	for (const [nodeID, edges] of Object.entries(graph)) {
		//Make sure that even nodes with no incoming edges show up in result
		if (!result[nodeID]) result[nodeID] = {};
		for (const ref of Object.keys(edges)) {
			if (!result[ref]) result[ref] = {};
			result[ref][nodeID] = true;
		}
	}
	return result;
};

const topologicalSort = (graph : SimpleGraph) : NodeID[] => {
	//https://stackoverflow.com/questions/4168/graph-serialization/4577#4577
	const result : NodeID[] = [];
	const workingGraph = deepCopy(graph);
	const incoming = incomingGraph(workingGraph);
	const noIncomingEdges = Object.entries(incoming).filter(entry => Object.keys(entry[1]).length == 0).map(entry => entry[0]);
	while (noIncomingEdges.length) {
		const id = noIncomingEdges.shift() as NodeID;
		result.push(id);
		const outbound = workingGraph[id];
		for (const outboundRef of Object.keys(outbound)) {
			delete workingGraph[id][outboundRef];
			const incoming = incomingGraph(workingGraph);
			if (Object.keys(incoming[outboundRef] || {}).length) continue;
			noIncomingEdges.push(outboundRef);
		}
	}
	if (result.length < Object.keys(graph).length) throw new Error('Cycle detected');
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
	for(const [type, edgeDefinition] of Object.entries(data.types)) {
		try {
			validateValueDefinition(edgeDefinition.value);
		} catch (err) {
			throw new Error(type + ' does not have a legal value definition: ' + err);
		}
		if (edgeDefinition.description && typeof edgeDefinition.description != 'string') throw new Error(type + ' has a description not of type string');
		if (edgeDefinition.constants) {
			for (const [constantName, constantValue] of Object.entries(edgeDefinition.constants)) {
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

const calculateValue = (definition : ValueDefinition) : number => {
	return definition;
};

export class AdjacencyMap {
	
	_data : JSONData;
	_nodes : {[id : NodeID] : AdjacencyMapNode};
	_cachedRoot : NodeValues;

	constructor(data : JSONData) {
		//Will throw if it doesn't validate
		validateData(data);
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
			if (!this._data.nodes[id]) throw new Error('ID ' + id + ' does not exist in input');
			this._nodes[id] = new AdjacencyMapNode(this, this._data.nodes[id]);
		}
		return this._nodes[id];
	}

	nodeValues() : NodeValuesMap {
		//TODO: cache. Not a huge deal because the heavy lifting is cached behind node().
		return Object.fromEntries(Object.keys(this._data.nodes).map(id => [id, this.node(id).values]));
	}
}

class AdjacencyMapNode {
	_map : AdjacencyMap;
	_data : NodeData;
	_values : NodeValues;

	constructor(parent : AdjacencyMap, data : NodeData) {
		this._map = parent;
		this._data = data;
	}

	_computeValues() : NodeValues {
		const result = {...this._map.root};
		const edgeByType : {[type : EdgeType] : EdgeValue[]} = {};
		const values = this._data.values || [];
		for (const edge of values) {
			if (!edgeByType[edge.type]) edgeByType[edge.type] = [];
			edgeByType[edge.type].push(edge);
		}
		for (const type of Object.keys(edgeByType)) {
			const edgeValueDefinition = this._map.data.types[type].value;
			result[type] = calculateValue(edgeValueDefinition);
		}
		return result;
	}

	/**
	 * The final computed values
	 */
	get values() : NodeValues {
		if (!this._values) {
			this._values = this._computeValues();
		}
		return this._values;
	}
}