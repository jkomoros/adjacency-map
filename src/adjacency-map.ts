import {
	EdgeType,
	JSONData,
	NodeData,
	NodeID,
	NodeValues,
	NodeValuesMap
} from './types.js';

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
	//TODO: check the nodes are all a DAG
};

export class AdjacencyMap {
	
	_data : JSONData;
	_nodes : {[id : NodeID] : AdjacencyMapNode};
	_cachedRoot : NodeValues;

	constructor(data : JSONData) {
		//Will throw if it doesn't validate
		validateData(data);
		this._data = data;
		this._nodes = {};
		this._cachedRoot = null;
	}

	get edgeTypes() : EdgeType[] {
		return Object.keys(this._data.types);
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
		//TODO: cache
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
		//TODO: actually implement
		return null;
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