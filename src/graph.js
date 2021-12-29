/*

Graph is a graph with nodes and edges, and values for each node/edge.

Canonical IDs are represented in strings. However, every method that takes an
identifer may take any of the packedID (the string), a node object that contains
an ID, or an 'unpackedID', which is an array of parts that will be joined by
Graph.ID_DELIMITER.

unpackID will reverse the packing of an ID, by splitting on Graph.ID_DELIMITER
and then converting any number-like parts to numbers.

Methods or arguiments have ID in the name will return or expect a packedID.
Methods or arguments that have 'Identifier' in the name will return or expect an
unpackedID

*/
export class Graph {

	//data is the starter data. We will never modify data passed to us, but
	//rather clone and set.
	constructor(data) {
		if (!data) data = {};
		this._data = data;
		this._changesMade = false;
	}

	static get ID_DELIMITER() {
		return ':';
	}

	static packID(identifier) {
		if (typeof identifier == 'string') return identifier;
		if (Array.isArray(identifier)) {
			const strs = identifier.map(part => '' + part);
			if (strs.some(str => str.includes(Graph.ID_DELIMITER))) throw new Error('An unpacked ID part contained the ID_DELIMITER');
			return strs.join(Graph.ID_DELIMITER);
		}
		if (typeof identifier == 'object') {
			if (identifier.id) return identifier.id;
		}
		throw new Error('Identifier was not a known type to pack: ', identifier);
	}

	static unpackID(packedID) {
		return packedID.split(Graph.ID_DELIMITER).map(item => isNaN(parseFloat(item)) ? item : parseFloat(item));
	}

	static packEdgeID(fromIdentifier, toIdentifier) {
		const fromID = Graph.packID(fromIdentifier);
		const toID = Graph.packID(toIdentifier);
		return fromID + Graph.ID_DELIMITER + Graph.ID_DELIMITER + toID;
	}

	static unpackEdgeID(packedEdgeID) {
		return packedEdgeID.split(Graph.ID_DELIMITER + Graph.ID_DELIMITER).map(id => Graph.unpackID(id));
	}

	//Whether modifications have been made since the object was created or saved
	//was called.
	get changesMade() {
		return this._changesMade;
	}

	//Should be called when the backing store has been saved.
	saved() {
		this._changesMade = false;
	}

	//same checks for logical equality, since you can't rely on values objects
	//being strictly equaly if changesMade is false.
	same(left, right) {
		if (left == right) return true;
		if (!left || !right) return false;
		if (typeof left != 'object') return false;
		if (typeof right != 'object') return false;
		if (!left.id || !right.id) return false;
		return left.id == right.id;
	}

	_nodeObject(identifier) {
		const id = Graph.packID(identifier);
		return this._data[id];
	}

	get data() {
		return this._data;
	}

	//Get the values stored on the node, or undefined if it doesn't exist. Note
	//that you can only rely on value equality for nodes if changesMade is
	//false. Instead, use Graph.same()
	node(identifier) {
		//Note: this is an override point for subclasses, so use _node(identifer)
		return this._node(identifier);

	}

	_node(identifier) {
		//_nodeObject will pack identifier
		const node = this._nodeObject(identifier);
		if (!node) return undefined;
		return node.values;
	}

	//Get the values stored on the edge, or undefined if that edge doesnt'
	//exist. Note that you can only rely on value equality for edges if
	//changesMade is false. Instead use Graph.same()
	edge(fromIdentifier, toIdentifier) {

		//Note: this is an override point for subclasses, do not assume it has the same signature
		return this._edge(fromIdentifier, toIdentifier);
	}

	_edge(fromIdentifier, toIdentifier) {
		const node = this._nodeObject(fromIdentifier);
		if (!node) return undefined;
		const toID = Graph.packID(toIdentifier);
		return node.edges[toID];
	}

	//Returns a map of toIdentifier, and the EDGE values.
	edges(identifier) {
		//Note: this can be overriden in subclasses, so don't rely on it to have this signature
		return this._edges(identifier);
	}

	_edges(identifier) {
		//_nodeObject will pack identifier
		const node = this._nodeObject(identifier);
		if (!node) return undefined;
		return node.edges;
	}

	nodes() {
		return Object.fromEntries(Object.entries(this._data).map(entry => [entry[0], entry[1].values]));
	}

	//Returns the values objects for all neighbors 
	neighbors(identifier, ply = 1) {
		const result = {};
		const id = Graph.packID(identifier);
		const nodesToProcess = Object.fromEntries(Object.entries(this._edges(identifier)).map(entry => [entry[0], 1]));
		while (Object.keys(nodesToProcess).length) {
			const [otherID, distance] = Object.entries(nodesToProcess)[0];
			delete nodesToProcess[otherID];
			const values = this._node(otherID);
			result[otherID] = values;
			//Only add more items to the queue if we haven't already hit the ply limit
			if (distance >= ply) continue;
			for (const newID of Object.keys(this._edges(otherID))) {
				//Don't revisit the one we started from
				if (newID == id) continue;
				//Don't revisit ones we've already processed
				if (result[newID]) continue;
				//Don't add another entry for one we're already planning to process
				if (nodesToProcess[newID]) continue;
				nodesToProcess[newID] = distance + 1;
			}
		}
		return result;
	}

	_prepareForModifications() {
		if (!this.changesMade) {
			this._data = {...this._data};
		}
		this._changesMade = true;
	}

	setNode(identifier, values) {
		const id = Graph.packID(identifier);
		let node = this._nodeObject(id);
		if (!node) node = {edges:{}};
		if (node.values == values) return;
		if (!values) values = {};
		if (values.id != id) values.id = id;
		node = {...node};
		node.values = values;
		this._prepareForModifications();
		this._data[id] = node;
		return node;
	}

	setNodeProperty(identifier, property, value) {
		let values = this.node(identifier);
		values = values ? {...values} : {};
		values[property] = value;
		return this.setNode(identifier, values);
	}

	deleteNode(identifier) {
		const id = Graph.packID(identifier);
		let node = this._nodeObject(id);
		if (!node) return;
		this._prepareForModifications();
		delete this._data[id];
	}

	setEdge(fromIdentifier, toIdentifier, values = {}) {
		const fromID = Graph.packID(fromIdentifier);
		const toID = Graph.packID(toIdentifier);
		let node = this._nodeObject(fromID);
		if (!node) {
			node = this.setNode(fromID);
		}
		const edgeID = Graph.packEdgeID(fromIdentifier, toIdentifier);
		if (values.id != edgeID) values.id = edgeID;
		if (values.from != fromID) values.from = fromID;
		if (values.to != toID) values.to = toID;
		this._prepareForModifications();
		this._data[fromID] = {...node, edges:{...node.edges, [toID]: values}};
	}

	setEdgeProperty(fromIdentifier, toIdentifier, property, value) {
		let values = this.edge(fromIdentifier, toIdentifier);
		values = values ? {...values} : {};
		values[property] = value;
		this.setEdge(fromIdentifier, toIdentifier, values);
	}

	deleteEdge(fromIdentifier, toIdentifier) {
		const fromID = Graph.packID(fromIdentifier);
		const toID = Graph.packID(toIdentifier);
		let node = this._nodeObject(fromID);
		if (!node) return;
		let edge = node.edges[toID];
		if (!edge) return;
		this._prepareForModifications();
		const newEdges = {...node.edges};
		delete newEdges[toID];
		this._data[fromID] = {...node, edges: newEdges};
	}

	lastNodeID() {
		const keys = Object.keys(this._data);
		return keys[keys.length - 1];
	}

	lastNodeIdentifier() {
		return Graph.unpackID(this.lastNodeID());
	}
}

export class RectangleGraph extends Graph {

	static identifier(row, col) {
		return [row, col];
	}

	static rowColFromIdentifier(identifier) {
		return identifier;
	}

	static make(rows, cols, starterValues = {}) {
		if (typeof rows != 'number' || rows < 1.0) throw new Error('Rows must be a positive integer');
		if (typeof cols != 'number' || cols < 1.0) throw new Error('Cols must be a positive integer');

		const result = new RectangleGraph();
		for (let r = 0; r < rows; r++) {
			for (let c = 0; c < cols; c++) {
				const values = {...starterValues, row: r, col: c};
				const identifier = RectangleGraph.identifier(r, c);
				result.setNode(identifier, values);
				if (r > 0) result.setEdge(identifier, RectangleGraph.identifier(r - 1, c), {distance: 1.0});
				if (c > 0) result.setEdge(identifier, RectangleGraph.identifier(r, c - 1), {distance: 1.0});
				if (r < rows - 1) result.setEdge(identifier, RectangleGraph.identifier(r + 1, c), {distance: 1.0});
				if (c < cols - 1) result.setEdge(identifier, RectangleGraph.identifier(r, c + 1), {distance: 1.0});
				//TODO set diagonals too if desired
			}
		}
		return result;
	}

	get rows() {
		return this.lastNodeIdentifier()[0] + 1;
	}

	get cols() {
		return this.lastNodeIdentifier()[1] + 1;
	}

}