import {
	EdgeType,
	JSONData,
	NodeData,
	NodeID,
	NodeValues
} from './types.js';

export class AdjacencyMap {
	
	_data : JSONData;
	_nodes : {[id : NodeID] : AdjacencyMapNode}

	constructor(data : JSONData) {
		this._data = data;
		this._nodes = {};
	}

	get edgeTypes() : EdgeType[] {
		return Object.keys(this._data.types);
	}

	node(id : NodeID) : AdjacencyMapNode {
		if (!this._nodes[id]) {
			if (!this._data.nodes[id]) throw new Error('ID ' + id + ' does not exist in input');
			this._nodes[id] = new AdjacencyMapNode(this, this._data.nodes[id]);
		}
		return this._nodes[id];
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