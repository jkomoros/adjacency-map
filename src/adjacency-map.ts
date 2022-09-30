import {
	EdgeDefinition,
	EdgeType,
	EdgeValue,
	ExpandedEdgeValue,
	LayoutInfo,
	MapDefinition,
	NodeDefinition,
	NodeID,
	NodeValues,
	SimpleGraph,
	TreeGraph,
	TreeGraphWithDetails,
	ValueDefinition,
	ValueDefinitionArithmetic,
	ValueDefinitionCombine,
	ValueDefinitionRefValue,
	ValueDefinitionResultValue,
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
	COMBINERS,
	DEFAULT_COMBINER
} from './combine.js';
import { TreeLayout } from './tree-svg.js';

const RESERVED_VALUE_DEFINITION_PROPERTIES : {[name : string] : true} = {
	'ref': true,
	'type': true
};

const valueDefintionIsEdgeConstant = (definition : ValueDefinition) : definition is ValueDefintionEdgeConstant => {
	if (!definition || typeof definition != 'object') return false;
	if (Array.isArray(definition)) return false;
	return 'constant' in definition;
};

const valueDefintionIsRefValue = (definition : ValueDefinition) : definition is ValueDefinitionRefValue => {
	if (!definition || typeof definition != 'object') return false;
	if (Array.isArray(definition)) return false;
	return 'ref' in definition;
};

const valueDefintionIsResultValue = (definition : ValueDefinition) : definition is ValueDefinitionResultValue => {
	if (!definition || typeof definition != 'object') return false;
	if (Array.isArray(definition)) return false;
	return 'result' in definition;
};

const valueDefintionIsCombine = (definition : ValueDefinition) : definition is ValueDefinitionCombine => {
	if (!definition || typeof definition != 'object') return false;
	if (Array.isArray(definition)) return false;
	return 'combine' in definition;
};

const valueDefinitionIsArithmetic = (definition : ValueDefinition): definition is ValueDefinitionArithmetic => {
	if (!definition || typeof definition != 'object') return false;
	if (Array.isArray(definition)) return false;
	return 'operator' in definition;
};

const validateValueDefinition = (definition : ValueDefinition, edgeDefinition : EdgeDefinition, exampleValue : NodeValues) : void => {
	if (typeof definition == 'number') return;
	if (typeof definition == 'object' && Array.isArray(definition)) {
		if (definition.some(item => typeof item != 'number')) throw new Error('An array was provided but some items were not numbers');
		if (definition.length == 0) throw new Error('If an array of numbers is provided there must be at least one');
		return;
	}
	if (valueDefintionIsEdgeConstant(definition)) {
		if (RESERVED_VALUE_DEFINITION_PROPERTIES[definition.constant]) throw new Error(definition.constant + ' is a reserved edge property name');
		const constants = edgeDefinition.constants || {};
		if (!constants[definition.constant]) throw new Error(definition.constant + ' for edge type value definition but that constant doesn\'t exist for that type.');
		return;
	}
	if (valueDefintionIsRefValue(definition)) {
		if (exampleValue[definition.ref] == undefined) throw new Error(definition.ref + ' is not a defined edge type');
		return;
	}
	if (valueDefintionIsResultValue(definition)) {
		const declaredDependencies = edgeDefinition.dependencies || [];
		if (!declaredDependencies.some(dependency => dependency == definition.result)) throw new Error(definition.result + ' is used in a ResultValue definition but it is not declared in dependencies.');
		return;
	}

	if (valueDefintionIsCombine(definition)) {
		validateValueDefinition(definition.child, edgeDefinition, exampleValue);
		if (!COMBINERS[definition.combine]) throw new Error('Unknown combiner: ' + definition.combine);
		return;
	}

	if (valueDefinitionIsArithmetic(definition)) {
		validateValueDefinition(definition.child, edgeDefinition, exampleValue);
		validateValueDefinition(definition.term, edgeDefinition, exampleValue);
		if (!['+', '*'].some(operator => operator == definition.operator)) throw new Error('Unknown operator: ' + definition.operator);
		return;
	}

	const _exhaustiveCheck : never = definition;
	throw new Error('Illegal value for definition');
	return _exhaustiveCheck;
};

export const extractSimpleGraph = (data : MapDefinition) : SimpleGraph => {
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

const validateData = (data : MapDefinition) : void => {
	if (!data) throw new Error('No data provided');
	if (!data.nodes) throw new Error('No nodes provided');
	//It is allowed for root to be empty.
	if (!data.types || Object.keys(data.types).length == 0) throw new Error('No edge types provided');
	for (const [nodeName, nodeData] of Object.entries(data.nodes)) {
		if (nodeName == ROOT_ID) throw new Error('Nodes may not have the same id as root: "' + ROOT_ID + '"');
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
		if (edgeDefinition.combine && !COMBINERS[edgeDefinition.combine]) throw new Error('Unknown combiner: ' + edgeDefinition.combine);
		if (edgeDefinition.description && typeof edgeDefinition.description != 'string') throw new Error(type + ' has a description not of type string');
		if (edgeDefinition.constants) {
			for (const [constantName, constantValue] of Object.entries(edgeDefinition.constants)) {
				if (RESERVED_VALUE_DEFINITION_PROPERTIES[constantName]) throw new Error(constantName + ' was present in constants for ' + type + ' but is reserved');
				if (typeof constantValue != 'number') throw new Error(type + ' constant ' + constantName + ' was not number as expected');
			}
		}
		if (edgeDefinition.dependencies) {
			for (const dependency of edgeDefinition.dependencies) {
				if (!data.types[dependency]) throw new Error(type + ' declared a dependency on ' + dependency + ' but that is not a valid type');
			}
			const seenTypes = {[type]: true};
			const definitionsToCheck = [edgeDefinition];
			while (definitionsToCheck.length) {
				const definitionToCheck = definitionsToCheck.shift();
				const dependencies = definitionToCheck?.dependencies || [];
				for (const dependencyToCheck of dependencies) {
					if (seenTypes[dependencyToCheck]) throw new Error(type + ' declared a dependency whose sub-definitions contain a cycle or self-reference');
					seenTypes[dependencyToCheck] = true;
					definitionsToCheck.push(data.types[dependencyToCheck]);
				}
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
const calculateValue = (definition : ValueDefinition, edges : EdgeValue[], refs : AdjacencyMapNode[], partialResult : NodeValues) : number[] => {
	if (typeof definition == 'number') return [definition];

	if (Array.isArray(definition)) return definition;

	if (valueDefintionIsEdgeConstant(definition)) {
		return edges.map(edge => edge[definition.constant] as number);
	}
	if (valueDefintionIsRefValue(definition)) {
		return refs.map(ref => ref.values).map(values => values[definition.ref]);
	}
	if (valueDefintionIsResultValue(definition)) {
		return edges.map(() => partialResult[definition.result]);
	}
	if (valueDefintionIsCombine(definition)) {
		const subValues = calculateValue(definition.child, edges, refs, partialResult);
		const combiner = COMBINERS[definition.combine];
		return combiner(subValues);
	}
	if (valueDefinitionIsArithmetic(definition)) {
		const left = calculateValue(definition.child, edges, refs, partialResult);
		const right = calculateValue(definition.term, edges, refs, partialResult);
		const op = definition.operator == '*' ? (one : number, two : number) => one * two : (one : number, two : number) => one + two;
		//The result is the same length as left, but we loop over and repeat numbers in right if necessary.
		return left.map((term, i) => op(term, right[i % right.length]));
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
	
	_data : MapDefinition;
	_nodes : {[id : NodeID] : AdjacencyMapNode};
	_cachedChildren : {[id : NodeID] : NodeID[]};
	_cachedEdges : ExpandedEdgeValue[];
	_cachedRoot : NodeValues;
	_cachedEdgeTypes : EdgeType[];
	_cachedLayoutInfo : LayoutInfo;

	constructor(data : MapDefinition) {
		//Will throw if it doesn't validate
		validateData(data);
		if (!data) throw new Error('undefined data');
		//TODO: deep freeze a copy of data
		this._data = data;
		this._nodes = {};
		const children : SimpleGraph = {};
		for (const [child, definition] of Object.entries(this._data.nodes)) {
			const values = definition.values || [];
			for (const edge of values) {
				const parent = edge.ref || ROOT_ID;
				if (!children[parent]) children[parent] = {};
				children[parent][child] = true;
			}
		}
		this._cachedChildren = Object.fromEntries(Object.entries(children).map(entry => [entry[0], Object.keys(entry[1])]));
	}

	//edgeTypes returns the types of edges. It's in topological order of any
	//edges that take dependencyes on others, so if you iterate through them in
	//that order then no edgeType that has a dependency on an earlier one will
	//not have been calculated already.
	get edgeTypes() : EdgeType[] {
		if (!this._cachedEdgeTypes) {
			const graph = Object.fromEntries(Object.entries(this._data.types).map(entry => [entry[0], entry[1].dependencies ? Object.fromEntries(entry[1].dependencies.map(edgeType => [edgeType, true])) : {}])) as SimpleGraph;
			const result = topologicalSort(graph) as EdgeType[];
			result.reverse();
			this._cachedEdgeTypes = result;
		}
		return this._cachedEdgeTypes;
	}

	get data() : MapDefinition {
		return this._data;
	}

	get root() : AdjacencyMapNode {
		return this.node(ROOT_ID);
	}

	get rootValues() : NodeValues {
		if (!this._cachedRoot) {
			const baseObject = Object.fromEntries(this.edgeTypes.map(typ => [typ, 0.0]));
			this._cachedRoot = {...baseObject, ...this._data.root};
		}
		return this._cachedRoot;
	}

	node(id : NodeID) : AdjacencyMapNode {
		if (!this._nodes[id]) {
			if (id != ROOT_ID && !this._data.nodes[id]) throw new Error('ID ' + id + ' does not exist in input');
			this._nodes[id] = new AdjacencyMapNode(id, this, this._data.nodes[id]);
		}
		return this._nodes[id];
	}

	_children(id : NodeID) : NodeID[] {
		return this._cachedChildren[id];
	}

	get nodes() : {[id : NodeID] : AdjacencyMapNode} {
		//TODO: cache. Not a huge deal because the heavy lifting is cached behind node().
		const ids = ['',...Object.keys(this._data.nodes)];
		return Object.fromEntries(ids.map(id => [id, this.node(id)]));
	}

	get edges() : ExpandedEdgeValue[] {
		if (!this._cachedEdges) {
			this._cachedEdges = Object.keys(this._data.nodes).map(id => this.node(id).edges).flat();
		}
		return this._cachedEdges;
	}

	treeGraph() : TreeGraphWithDetails {
		//TODO:SVG remove
		//TODO: cache
		const simpleGraph = extractSimpleGraph(this._data);
		const longestTree = tidyLongestTree(simpleGraph);
		const treeGraph = treeGraphFromParentGraph(longestTree);
		return treeGraphWithDetails(treeGraph, this);
	}

	_ensureLayoutInfo() {
		if (this._cachedLayoutInfo) return;
		this._cachedLayoutInfo = TreeLayout(this.treeGraph());
	}

	get width() : number {
		this._ensureLayoutInfo();
		return this._cachedLayoutInfo.width;
	}

	get height() : number{
		this._ensureLayoutInfo();
		return this._cachedLayoutInfo.height;
	}

	get viewBox() : [number, number, number, number] {
		this._ensureLayoutInfo();
		return this._cachedLayoutInfo.viewBox;
	}

	get nodePositions() : {[id : NodeID] : {x: number, y: number}} {
		this._ensureLayoutInfo();
		return this._cachedLayoutInfo.positions;
	}
	
}

class AdjacencyMapNode {
	_id : NodeID;
	_map : AdjacencyMap;
	_data : NodeDefinition | undefined;
	_values : NodeValues;
	_isRoot : boolean;
	_cachedEdges : ExpandedEdgeValue[];

	constructor(id : NodeID, parent : AdjacencyMap, data : NodeDefinition | undefined) {
		this._id = id;
		this._map = parent;
		this._data = data;
		this._isRoot = id == ROOT_ID;
	}

	_computeValues() : NodeValues {
		const partialResult : NodeValues = {};
		const edgeByType : {[type : EdgeType] : EdgeValue[]} = {};
		const values = this._data?.values || [];
		for (const edge of values) {
			if (!edgeByType[edge.type]) edgeByType[edge.type] = [];
			edgeByType[edge.type].push(edge);
		}
		//Iterate through edges in edgeTypes order to make sure that any
		//ValueDefinitionResultValue will have the values they already rely on
		//calculated.
		for (const type of this._map.edgeTypes) {
			//Fill in the partial result as we go so other things htat rely on
			//our root value can have it.
			partialResult[type] = this._map.rootValues[type];
			const rawEdges = edgeByType[type];
			if (!rawEdges) continue;
			const typeDefinition = this._map.data.types[type];
			const edgeValueDefinition = typeDefinition.value;
			const constants = typeDefinition.constants || {};
			const defaultedEdges = rawEdges.map(edge => ({...constants, ...edge}));
			//TODO: should we make it illegal to have an edge of same type and ref on a node? 
			const refs = rawEdges.map(edge => this._map.node(edge.ref || ''));
			const values = calculateValue(edgeValueDefinition, defaultedEdges, refs, partialResult);
			if (values.length == 0) throw new Error('values was not at least of length 1');
			const finalCombiner = typeDefinition.combine ? COMBINERS[typeDefinition.combine] : DEFAULT_COMBINER;
			partialResult[type] = finalCombiner(values)[0];
		}
		//partialResult now contains a value for every item (including hte ones
		//that are just default set to root's value).
		return partialResult;
	}

	get id() : NodeID {
		return this._id;
	}

	get isRoot() : boolean {
		return this._isRoot;
	}

	get description() : string {
		return this._data ? this._data.description : '';
	}

	get edges() : ExpandedEdgeValue[] {
		if (!this._cachedEdges) {
			if (this._data && this._data.values) {
				this._cachedEdges = this._data.values.map(edge => ({...edge, source: this.id, ref: edge.ref || ROOT_ID}));
			} else {
				this._cachedEdges = [];
			}
		}
		return this._cachedEdges;
	}

	//Gets the parents we reference. Note that ROOT_ID is nearly always implied,
	//but not returned here.
	get parents() : NodeID[] {
		if (!this._data || !this._data.values) return [];
		return this._data.values.map(edge => edge.ref).filter(ref => ref && ref != ROOT_ID) as NodeID[];
	}

	//Gets the children we are directly referenced by.
	get children() : NodeID[] {
		return this._map._children(this.id) || [];
	}

	/**
	 * The final computed values
	 */
	get values() : NodeValues {
		if (this.isRoot) return this._map.rootValues;
		if (!this._values) {
			this._values = this._computeValues();
		}
		return this._values;
	}

	get x() : number {
		const pos = this._map.nodePositions[this.id];
		if (!pos) throw new Error(this.id + ' didn\'t exist in parent');
		return pos.x;
	}

	get y() : number {
		const pos = this._map.nodePositions[this.id];
		if (!pos) throw new Error(this.id + ' didn\'t exist in parent');
		return pos.y;
	}
}