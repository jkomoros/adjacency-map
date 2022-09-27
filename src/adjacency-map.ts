import {
	EdgeType,
	EdgeValue,
	JSONData,
	NodeData,
	NodeID,
	NodeValues,
	NodeValuesMap,
	ValueDefinition
} from './types.js';

const validateValueDefinition = (definition : ValueDefinition) : void => {
	if (typeof definition == 'number') return;
	const _exhaustiveCheck : never = definition;
	throw new Error('Illegal value for definition');
	return _exhaustiveCheck;
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
	}
	//TODO: check that root (if provided) has only keys as enumerated in types
	//TODO: check the nodes are all a DAG
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
		this._cachedRoot = null;
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
		this._values = null;
	}

	_computeValues() : NodeValues {
		const result = {...this._map.root};
		const edgeByType : {[type : EdgeType] : EdgeValue[]} = {};
		for (const edge of this._data.values) {
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