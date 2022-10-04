import {
	PropertyDefinition,
	PropertyName,
	EdgeValue,
	ExpandedEdgeValue,
	LayoutInfo,
	Library,
	LibraryType,
	MapDefinition,
	NodeDefinition,
	NodeID,
	NodeValues,
	RawMapDefinition,
	SimpleGraph,
	RawNodeValues,
	ValueDefinition,
	RawPropertyDefinition,
	NodeDisplay,
	MapDisplay,
	Color,
	RenderEdgeValue
} from './types.js';

import {
	tidyLongestTree,
	topologicalSort,
	treeGraphFromParentGraph
} from './graph.js';

import {
	ROOT_ID,
	SVG_HEIGHT,
	SVG_WIDTH
} from './constants.js';

import {
	COMBINERS,
	DEFAULT_COMBINER
} from './combine.js';

import {
	TreeLayout
} from './tree-svg.js';

import {
	calculateValue, 
	calculateValueLeaf, 
	RESERVED_VALUE_DEFINITION_PROPERTIES, 
	validateValueDefinition,
	valueDefinitionIsLeaf
} from './value-definition.js';

import {
	CORE_LIBRARY_NAME,
	LIBRARIES
} from './libraries.js';

import {
	color,
	unpackColor
} from './color.js';

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

const BASE_NODE_DISPLAY : NodeDisplay = {
	radius: 6,
	opacity: 1.0,
	color: {
		color: '#333'
	}
};

//Does things like include libraries, convert Raw* to * (by calculateValueLeaf
//on any constants, etc)
const processMapDefinition = (data : RawMapDefinition) : MapDefinition => {
	let baseImports : LibraryType[] = [];
	if (data.import) {
		if (typeof data.import == 'string') {
			baseImports = [data.import as LibraryType];
		} else {
			baseImports = [...data.import];
		}
	}
	baseImports.push(CORE_LIBRARY_NAME);
	const importsToProcess = baseImports;
	const importsMap : {[name in LibraryType]+?: Library} = {};
	while (importsToProcess.length) {
		const importName = importsToProcess.shift() as LibraryType;
		//Skip ones we've already processed
		if (importsMap[importName]) continue;
		const library = LIBRARIES[importName];
		if (!library) throw new Error('Unknown library: ' + importName);
		importsMap[importName]= library;
		importsToProcess.push(...(library.import || []));
	}
	let baseTypes : {[name : PropertyName] : RawPropertyDefinition} = {};
	let baseRoot : RawNodeValues = {};
	for (const library of Object.values(importsMap)) {
		baseTypes = {...baseTypes, ...library.properties};
		baseRoot = {...baseRoot, ...library.root};
	}
	const dataTypes = data.properties || {};
	const dataRoot = data.root || {};

	const rawCombinedRoot = {...baseRoot, ...dataRoot};
	const root = Object.fromEntries(Object.entries(rawCombinedRoot).map(entry => [entry[0], calculateValueLeaf(entry[1])]));

	const combinedProperties = {...baseTypes, ...dataTypes};
	const properties : {[name : PropertyName] : PropertyDefinition} = {};
	for (const [name, rawDefinition] of Object.entries(combinedProperties)) {
		const definition = {
			...rawDefinition,
			constants: Object.fromEntries(Object.entries(rawDefinition.constants || {}).map(entry => [entry[0], calculateValueLeaf(entry[1])]))
		};
		properties[name] = definition;
	}
	const nodes : {[id : NodeID]: NodeDefinition} = {};
	for (const [id, rawNode] of Object.entries(data.nodes)) {
		const values : EdgeValue[] = [];
		if (rawNode.values) {
			for (const rawValue of rawNode.values) {
				const value : EdgeValue = {type: rawValue.type};
				if (rawValue.ref != undefined) value.ref = rawValue.ref;
				for (const entry of Object.entries(rawValue)) {
					if (RESERVED_VALUE_DEFINITION_PROPERTIES[entry[0]]) continue;
					const val = entry[1] as ValueDefinition;
					if (!valueDefinitionIsLeaf(val)) continue;
					value[entry[0]] = calculateValueLeaf(val);
				}
				values.push(value);
			}
		}
		const rawNodeDisplay = rawNode.display || {};
		nodes[id] = {
			...rawNode,
			values,
			display: {
				...rawNodeDisplay
			}
		};
	}
	const rawNodeDisplay = data.display?.node || {};
	const display : MapDisplay = {
		node: {
			...BASE_NODE_DISPLAY,
			...rawNodeDisplay
		}
	};
	return {
		...data,
		root,
		display,
		properties,
		nodes
	};
};

const validateData = (data : MapDefinition) : void => {
	if (!data) throw new Error('No data provided');
	if (!data.nodes) throw new Error('No nodes provided');
	//It is allowed for root to be empty.
	if (!data.properties || Object.keys(data.properties).length == 0) throw new Error('No properties provided');
	const exampleValues = Object.fromEntries(Object.keys(data.properties).map(typeName => [typeName, 1.0]));
	for (const [nodeName, nodeData] of Object.entries(data.nodes)) {
		if (nodeName == ROOT_ID) throw new Error('Nodes may not have the same id as root: "' + ROOT_ID + '"');
		if (!nodeData.description) throw new Error(nodeName + ' has no description');
		const nodeValues = nodeData.values || [];
		for (const edge of nodeValues) {
			if (!edge.type) throw new Error(nodeName + ' has an edge with no type');
			if (!data.properties[edge.type]) throw new Error(nodeName + ' has an edge of type ' + edge.type + ' which is not included in types');
		}
		for (const displayValue of Object.values(nodeData.display)) {
			validateValueDefinition(displayValue, exampleValues);
		}
	}
	for(const [type, propertyDefinition] of Object.entries(data.properties)) {
		try {
			validateValueDefinition(propertyDefinition.value, exampleValues, propertyDefinition);
		} catch (err) {
			throw new Error(type + ' does not have a legal value definition: ' + err);
		}
		if (propertyDefinition.combine && !COMBINERS[propertyDefinition.combine]) throw new Error('Unknown combiner: ' + propertyDefinition.combine);
		if (propertyDefinition.description && typeof propertyDefinition.description != 'string') throw new Error(type + ' has a description not of type string');
		if (propertyDefinition.constants) {
			for (const [constantName, constantValue] of Object.entries(propertyDefinition.constants)) {
				if (RESERVED_VALUE_DEFINITION_PROPERTIES[constantName]) throw new Error(constantName + ' was present in constants for ' + type + ' but is reserved');
				if (typeof constantValue != 'number') throw new Error(type + ' constant ' + constantName + ' was not number as expected');
			}
		}
		if (propertyDefinition.dependencies) {
			for (const dependency of propertyDefinition.dependencies) {
				if (!data.properties[dependency]) throw new Error(type + ' declared a dependency on ' + dependency + ' but that is not a valid type');
			}
			const seenTypes = {[type]: true};
			const definitionsToCheck = [propertyDefinition];
			while (definitionsToCheck.length) {
				const definitionToCheck = definitionsToCheck.shift();
				const dependencies = definitionToCheck?.dependencies || [];
				for (const dependencyToCheck of dependencies) {
					if (seenTypes[dependencyToCheck]) throw new Error(type + ' declared a dependency whose sub-definitions contain a cycle or self-reference');
					seenTypes[dependencyToCheck] = true;
					definitionsToCheck.push(data.properties[dependencyToCheck]);
				}
			}
		}
	}
	if (data.root) {
		if (typeof data.root != 'object') throw new Error('root if provided must be an object');
		for (const [rootName, rootValue] of Object.entries(data.root)) {
			if (typeof rootValue != 'number') throw new Error('root property ' + rootName + ' is not a number as expected');
			if (!data.properties[rootName]) throw new Error('root property ' + rootName + ' is not defined in properties');
		}
	}
	for (const displayValue of Object.values(data.display.node)) {
		validateValueDefinition(displayValue, exampleValues);
	}
	try {
		topologicalSort(extractSimpleGraph(data));
	} catch (err) {
		throw new Error('The edges provided did not form a DAG');
	}
};

export class AdjacencyMap {
	
	_data : MapDefinition;
	_nodes : {[id : NodeID] : AdjacencyMapNode};
	_cachedChildren : {[id : NodeID] : NodeID[]};
	_cachedEdges : ExpandedEdgeValue[];
	_cachedRenderEdges : RenderEdgeValue[];
	_cachedRoot : NodeValues;
	_cachedPropertyNames : PropertyName[];
	_cachedLayoutInfo : LayoutInfo;

	constructor(rawData : RawMapDefinition) {
		//will throw if invalid library is included
		const data = processMapDefinition(rawData);
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
	get propertyNames() : PropertyName[] {
		if (!this._cachedPropertyNames) {
			const graph = Object.fromEntries(Object.entries(this._data.properties).map(entry => [entry[0], entry[1].dependencies ? Object.fromEntries(entry[1].dependencies.map(edgeType => [edgeType, true])) : {}])) as SimpleGraph;
			const result = topologicalSort(graph) as PropertyName[];
			result.reverse();
			this._cachedPropertyNames = result;
		}
		return this._cachedPropertyNames;
	}

	get data() : MapDefinition {
		return this._data;
	}

	get root() : AdjacencyMapNode {
		return this.node(ROOT_ID);
	}

	get rootValues() : NodeValues {
		if (!this._cachedRoot) {
			const baseObject = Object.fromEntries(this.propertyNames.map(typ => [typ, 0.0]));
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

	get renderEdges() : RenderEdgeValue[] {
		if (!this._cachedRenderEdges) {
			this._cachedRenderEdges = Object.keys(this._data.nodes).map(id => this.node(id).renderEdges).flat();
		}
		return this._cachedRenderEdges;
	}

	_ensureLayoutInfo() {
		if (this._cachedLayoutInfo) return;
		const simpleGraph = extractSimpleGraph(this._data);
		const longestTree = tidyLongestTree(simpleGraph);
		const treeGraph = treeGraphFromParentGraph(longestTree);
		this._cachedLayoutInfo = TreeLayout(treeGraph, SVG_WIDTH, SVG_HEIGHT);
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
	_cachedRenderEdges : RenderEdgeValue[];

	constructor(id : NodeID, parent : AdjacencyMap, data : NodeDefinition | undefined) {
		this._id = id;
		this._map = parent;
		this._data = data;
		this._isRoot = id == ROOT_ID;
	}

	_computeValues() : NodeValues {
		const partialResult : NodeValues = {};
		const edgeByType : {[type : PropertyName] : EdgeValue[]} = {};
		const values = this._data?.values || [];
		for (const edge of values) {
			if (!edgeByType[edge.type]) edgeByType[edge.type] = [];
			edgeByType[edge.type].push(edge);
		}
		//Iterate through edges in propertyNames order to make sure that any
		//ValueDefinitionResultValue will have the values they already rely on
		//calculated.
		for (const type of this._map.propertyNames) {
			//Fill in the partial result as we go so other things htat rely on
			//our root value can have it.
			partialResult[type] = this._map.rootValues[type];
			const rawEdges = edgeByType[type];
			if (!rawEdges) continue;
			const typeDefinition = this._map.data.properties[type];
			const edgeValueDefinition = typeDefinition.value;
			const constants = typeDefinition.constants || {};
			const defaultedEdges = rawEdges.map(edge => ({...constants, ...edge}));
			//TODO: should we make it illegal to have an edge of same type and ref on a node? 
			const refs = rawEdges.map(edge => this._map.node(edge.ref || '').values);
			const args = {
				edges: defaultedEdges,
				refs,
				partialResult,
				rootValue: this._map.rootValues
			};
			const values = calculateValue(edgeValueDefinition, args);
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
		return this._data ? this._data.description : 'Root node';
	}

	fullDescription(includeHidden = false) : string {
		const filter = includeHidden ? () => true : (entry : [PropertyName, number] ) => !this._map.data.properties[entry[0]].hide;
		return this.description + '\n\n' + Object.entries(this.values).filter(filter).map(entry => entry[0] + ': ' + entry[1]).join('\n');
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

	_calculateRenderEdges() : RenderEdgeValue[] {
		
		const defaultWidth = 1.5;
		const defaultOpacity = 0.4;
		const defaultColor = color('#555');
		const defaultBump = 0.5;

		const result : RenderEdgeValue[] = [];
		
		const edgesBySource : {[source : NodeID]: ExpandedEdgeValue[]} = {};
		for (const edge of this.edges) {
			if (!edgesBySource[edge.source]) edgesBySource[edge.source] = [];
			edgesBySource[edge.source].push(edge);
		}
		for (const [source, edges] of Object.entries(edgesBySource)) {
			for (const edge of edges){
				result.push({
					source,
					ref: edge.ref,
					width: defaultWidth,
					opacity: defaultOpacity,
					color: defaultColor,
					bump: defaultBump
				});
			}
		}
		return result;
	}

	get renderEdges(): RenderEdgeValue[] {
		if (!this._cachedRenderEdges) {
			//TODO: actually calculate these
			this._cachedRenderEdges = this._calculateRenderEdges();
		}
		return this._cachedRenderEdges;
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

	_valueDefinitionHelper(definition : ValueDefinition) : number {
		const result = calculateValue(definition, {
			edges: this.edges,
			//TODO: this.parents omits expliti root references
			refs: this.parents.map(id => this._map.node(id).values),
			partialResult: this.values,
			rootValue: this._map.rootValues
		});
		if (result.length < 1) throw new Error('Value definition returned an empty array');
		return result[0];
	}

	get radius() : number {
		//TODO: cache
		const definition = this._data?.display?.radius || this._map.data.display.node.radius;
		const clippedDefinition : ValueDefinition = {
			clip: definition,
			low: 0.0
		};
		return this._valueDefinitionHelper(clippedDefinition);
	}

	get opacity() : number {
		//TODO: cache
		const definition = this._data?.display?.opacity || this._map.data.display.node.opacity;
		const clippedDefinition : ValueDefinition = {
			clip: definition,
			low: 0.0,
			high: 1.0
		};
		return this._valueDefinitionHelper(clippedDefinition);
	}

	get color(): Color {
		//TODO: cache
		const definition = this._data?.display?.color || this._map.data.display.node.color;
		const num = this._valueDefinitionHelper(definition);
		return unpackColor(num);
	}
}