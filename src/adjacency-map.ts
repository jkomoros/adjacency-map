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
	RenderEdgeValue,
	EdgeDisplay,
	EdgeCombinerDisplay,
	ValueDefinitionCalculationArgs,
	ImpliesConfiguration,
	ScenariosDefinition,
	Scenario,
	ScenarioName,
	RawNodeDefinition
} from './types.js';

import {
	tidyLongestTree,
	topologicalSort,
	treeGraphFromParentGraph
} from './graph.js';

import {
	DEFAULT_SCENARIO_NAME,
	DEFAULT_TRUE_NUMBER,
	FALSE_NUMBER,
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
	cloneWithSelf, 
	extractRequiredDependencies, 
	RESERVED_VALUE_DEFINITION_PROPERTIES, 
	validateValueDefinition,
	valueDefinitionIsLeaf,
	valueDefinitionIsStringType
} from './value-definition.js';

import {
	CORE_LIBRARY_NAME,
	LIBRARIES,
	BASE_NODE_DISPLAY,
	BASE_EDGE_DISPLAY,
	BASE_EDGE_COMBINER_DISPLAY
} from './libraries.js';

import {
	color,
	packColor,
	unpackColor
} from './color.js';

import {
	assertUnreachable,
	wrapArrays
} from './util.js';

//If an edge is bumped, this is the amount we aim to bump it by by default.
const TARGET_BUMP = 0.4;

export const extractSimpleGraph = (data : MapDefinition) : SimpleGraph => {
	const result : SimpleGraph = {};
	for (const [id, value] of Object.entries(data.nodes)) {
		const edges : {[id : NodeID] : true} = {};
		for (const edge of value.edges || []) {
			const ref = edge.ref || ROOT_ID;
			edges[ref] = true;
		}
		result[id] = edges;
	}
	result[ROOT_ID] = {};
	return result;
};

//There are a number of different ways to conveniently define edges, this
//function converts all of them to the base type.
const extractEdgesFromRawNodeDefinition = (nodeData : RawNodeDefinition) : EdgeValue[] => {
	if (!nodeData.edges) return [];
	const edges : EdgeValue [] = [];
	if (Array.isArray(nodeData.edges)) {
		for (const rawValue of nodeData.edges) {
			const value : EdgeValue = {type: rawValue.type};
			if (rawValue.ref != undefined) value.ref = rawValue.ref;
			if (rawValue.implies != undefined) value.implies = rawValue.implies;
			for (const entry of Object.entries(rawValue)) {
				if (RESERVED_VALUE_DEFINITION_PROPERTIES[entry[0]]) continue;
				const val = entry[1] as ValueDefinition;
				if (!valueDefinitionIsLeaf(val)) continue;
				value[entry[0]] = calculateValueLeaf(val);
			}
			edges.push(value);
		}
	} else {
		for (const [ref, refData] of Object.entries(nodeData.edges)) {
			if (Array.isArray(refData)) {
				for (const rawValue of refData) {
					const value : EdgeValue = {
						type: rawValue.type,
						ref
					};
					if (rawValue.implies != undefined) value.implies = rawValue.implies;
					for (const entry of Object.entries(rawValue)) {
						if (RESERVED_VALUE_DEFINITION_PROPERTIES[entry[0]]) continue;
						const val = entry[1] as ValueDefinition;
						if (!valueDefinitionIsLeaf(val)) continue;
						value[entry[0]] = calculateValueLeaf(val);
					}
					edges.push(value);
				}
			} else {
				for (const [type, rawValues] of Object.entries(refData)) {
					const iterValues = Array.isArray(rawValues) ? rawValues : [rawValues];
					for (const rawValue of iterValues) {
						const value : EdgeValue = {
							type,
							ref
						};
						if (rawValue.implies != undefined) value.implies = rawValue.implies;
						for (const entry of Object.entries(rawValue)) {
							if (RESERVED_VALUE_DEFINITION_PROPERTIES[entry[0]]) continue;
							const val = entry[1] as ValueDefinition;
							if (!valueDefinitionIsLeaf(val)) continue;
							value[entry[0]] = calculateValueLeaf(val);
						}
						edges.push(value);
					}
				}
			}
		}
	}
	return edges;
};

//Does things like include libraries, convert Raw* to * (by calculateValueLeaf
//on any constants, etc)
//Exported for use in tests
export const processMapDefinition = (data : RawMapDefinition) : MapDefinition => {
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
	let baseNodeDisplay = {...BASE_NODE_DISPLAY};
	let baseEdgeDisplay = {...BASE_EDGE_DISPLAY};
	let baseEdgeCombinerDisplay = {...BASE_EDGE_COMBINER_DISPLAY};
	for (const library of Object.values(importsMap)) {
		baseTypes = {...baseTypes, ...library.properties};
		baseRoot = {...baseRoot, ...library.root};
		if (library.display) {
			if (library.display.node) baseNodeDisplay = {...baseNodeDisplay, ...library.display.node};
			if (library.display.edge) baseEdgeDisplay = {...baseEdgeDisplay, ...library.display.edge};
			if (library.display.edgeCombiner) baseEdgeCombinerDisplay = {...baseEdgeCombinerDisplay, ...library.display.edgeCombiner};
		}
	}
	const dataTypes = data.properties || {};
	const dataRoot = data.root || {};

	const rawCombinedRoot = {...baseRoot, ...dataRoot};
	const root = Object.fromEntries(Object.entries(rawCombinedRoot).map(entry => [entry[0], calculateValueLeaf(entry[1])]));

	const combinedProperties = {...baseTypes, ...dataTypes};
	const properties : {[name : PropertyName] : PropertyDefinition} = {};
	for (const [name, rawDefinition] of Object.entries(combinedProperties)) {
		const rawEdgeDisplay = rawDefinition.display || {};
		const value = cloneWithSelf(rawDefinition.value, name);
		const dependencies = extractRequiredDependencies(value);
		const definition : PropertyDefinition = {
			...rawDefinition,
			value,
			dependencies,
			excludeFromDefaultImplication: !! rawDefinition.excludeFromDefaultImplication,
			display: {
				...rawEdgeDisplay
			},
			constants: Object.fromEntries(Object.entries(rawDefinition.constants || {}).map(entry => [entry[0], calculateValueLeaf(entry[1])]))
		};
		properties[name] = definition;
	}
	const nodes : {[id : NodeID]: NodeDefinition} = {};
	for (const [id, rawNode] of Object.entries(data.nodes || {})) {
		const edges : EdgeValue[] = extractEdgesFromRawNodeDefinition(rawNode);
		const rawNodeDisplay = rawNode.display || {};
		const rawValues = rawNode.values || {};
		const values = Object.fromEntries(Object.entries(rawValues).map(entry => [entry[0], calculateValueLeaf(entry[1])]));
		nodes[id] = {
			...rawNode,
			edges,
			values,
			display: {
				...rawNodeDisplay
			}
		};
	}
	const rawNodeDisplay = data.display?.node || {};
	const rawEdgeDisplay = data.display?.edge || {};
	const rawEdgeCombinerDisplay = data.display?.edgeCombiner || {};
	const display : MapDisplay = {
		node: {
			...baseNodeDisplay,
			...rawNodeDisplay
		},
		edge: {
			...baseEdgeDisplay,
			...rawEdgeDisplay
		},
		edgeCombiner: {
			...baseEdgeCombinerDisplay,
			...rawEdgeCombinerDisplay
		}
	};
	const rawScenarios = data.scenarios || {};
	const scenarios : ScenariosDefinition = {};
	for (const [scenarioName, rawScenario] of Object.entries(rawScenarios)) {
		const nodes : {[id : NodeID] : NodeValues} = {};
		for (const [nodeName, nodeValues] of Object.entries(rawScenario.nodes)) {
			nodes[nodeName] = Object.fromEntries(Object.entries(nodeValues).map(entry => [entry[0], calculateValueLeaf(entry[1])]));
		}
		const scenario : Scenario = {
			nodes
		};
		scenarios[scenarioName] = scenario;
	}
	return {
		...data,
		root,
		display,
		properties,
		nodes,
		scenarios
	};
};

const validateDisplay = (data : Partial<NodeDisplay> | Partial<EdgeDisplay> | Partial<EdgeCombinerDisplay>, exampleValues : NodeValues, propertyDefinition? : PropertyDefinition) : void => {
	for (const [displayName, displayValue] of Object.entries(data)) {
		if (typeof displayValue == 'string') {
			if (valueDefinitionIsStringType(displayValue)) {
				validateValueDefinition(displayValue, exampleValues, propertyDefinition);
			} else if (displayName == 'color') {
				//Throw if not a color
				color(displayValue);
			} else {
				throw new Error(displayName + ' was provided as a string');
			}
		} else {
			validateValueDefinition(displayValue, exampleValues, propertyDefinition);
		}
	}
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
		const nodeEdges = nodeData.edges || [];
		for (const edge of nodeEdges) {
			if (!edge.type) throw new Error(nodeName + ' has an edge with no type');
			if (!data.properties[edge.type]) throw new Error(nodeName + ' has an edge of type ' + edge.type + ' which is not included in types');
		}
		validateDisplay(nodeData.display, exampleValues);
		if (nodeData.values) {
			if (typeof nodeData.values != 'object') throw new Error('values if provided must be an object');
			for (const [valueName, valueValue] of Object.entries(nodeData.values)) {
				if (typeof valueValue != 'number') throw new Error('values property ' + valueName + ' is not a number as expected');
				if (!data.properties[valueName]) throw new Error('values property ' + valueName + ' is not defined in properties');
			}
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
		validateDisplay(propertyDefinition.display, exampleValues, propertyDefinition);
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

	for (const [scenarioName, scenario] of Object.entries(data.scenarios)) {
		if (scenarioName == DEFAULT_SCENARIO_NAME) throw new Error('The default scenario name is implied and should not be enumerated');
		if (!scenario.nodes || typeof scenario.nodes != 'object') throw new Error('Scenario must have nodes');
		for (const [nodeName, nodeValues] of Object.entries(scenario.nodes)) {
			if (nodeName != ROOT_ID && !data.nodes[nodeName]) throw new Error('All node ids in a scenario must be either ROOT_ID or included in nodes');
			for (const [propertyName, propertyValue] of Object.entries(nodeValues)) {
				if (!data.properties[propertyName]) throw new Error('All properties in scenarios for a node must be named properties');
				if (typeof propertyValue != 'number') throw new Error('All override node values must be numbers');
			}
		}
	}

	for (const displayContainer of Object.values(data.display)) {
		validateDisplay(displayContainer, exampleValues);
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
	_cachedRenderEdges : RenderEdgeValue[] | undefined;
	_cachedRoot : NodeValues | undefined;
	_cachedPropertyNames : PropertyName[];
	_cachedLayoutInfo : LayoutInfo;
	_scenarioName : ScenarioName;

	constructor(rawData : RawMapDefinition, scenarioName : ScenarioName = DEFAULT_SCENARIO_NAME) {
		//will throw if invalid library is included
		const data = processMapDefinition(rawData);
		//Will throw if it doesn't validate
		validateData(data);
		if (!data) throw new Error('undefined data');
		//TODO: deep freeze a copy of data
		this._data = data;
		this._nodes = {};

		if (scenarioName != DEFAULT_SCENARIO_NAME && !this.data.scenarios[scenarioName]) throw new Error('no such scenario');

		this._scenarioName = scenarioName;
		const children : SimpleGraph = {};
		for (const [child, definition] of Object.entries(this._data.nodes)) {
			const edges = definition.edges || [];
			for (const edge of edges) {
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

	get scenarioName() : ScenarioName {
		return this._scenarioName;
	}

	set scenarioName(name : ScenarioName) {
		if (name == this._scenarioName) return;
		if (name != DEFAULT_SCENARIO_NAME && !this.data.scenarios[name]) throw new Error('no such scenario');
		const oldName = this._scenarioName;
		this._scenarioName = name;
		this._scenarioChanged(oldName);
	}

	_scenarioData(name : ScenarioName) : Scenario {
		return this.data.scenarios[name] || {nodes: {}};
	}

	//Returns a scenario object for the current scenario, or an empty scneario
	//object for tthe default scenario. The scenario is an overlay over the base
	//defintion.
	get scenario() : Scenario {
		return this._scenarioData(this.scenarioName);
	}

	get result() : NodeValues {
		const result = Object.fromEntries(this.propertyNames.map(typ => [typ, 0.0]));
		for (const node of Object.values(this.nodes)) {
			for (const propertyName of this.propertyNames) {
				result[propertyName] += node.values[propertyName];
			}
		}
		return result;
	}

	resultDescription(includeHidden = false) : string {
		const filter = includeHidden ? () => true : (entry : [PropertyName, number] ) => !this.data.properties[entry[0]].hide;
		return Object.entries(this.result).filter(filter).map(entry => entry[0] + ': ' + entry[1]).join('\n');
	}

	//An opportunity to throw out any caches that are now invalidated
	_scenarioChanged(from : ScenarioName) {
		const fromScenario = this._scenarioData(from);
		const toScenario = this.scenario;
		if (fromScenario.nodes[ROOT_ID] || toScenario.nodes[ROOT_ID]) this._cachedRoot = undefined;
		this._cachedRenderEdges = undefined;
		for (const node of Object.values(this._nodes)) {
			node._scenarioChanged();
		}
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
			const scenarioNode = this.scenario.nodes[ROOT_ID] || {};
			this._cachedRoot = {...baseObject, ...this._data.root, ...scenarioNode};
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

const wrapStringAsColor = (input : string | ValueDefinition) : ValueDefinition => {
	if (typeof input != 'string') return input;
	return valueDefinitionIsStringType(input) ? input : {color: input};
};

type PropertyNameSet = {[name : PropertyName]: true};

const impliedPropertyNames = (config : ImpliesConfiguration | undefined, allNames : PropertyName[]) : PropertyNameSet => {
	if (!config) return {};
	if (config == '*') return Object.fromEntries(allNames.map(name => [name, true]));
	if (Array.isArray(config)) return Object.fromEntries(config.map(name => [name, true]));
	if (typeof config == 'object') {
		const excludeSet = Object.fromEntries(config.exclude.map(name => [name, true]));
		return Object.fromEntries(allNames.filter(name => !excludeSet[name]).map(name => [name, true]));
	}
	return assertUnreachable(config);
};

const completeEdgeSet = (source: NodeID, edges : EdgeValue[], data : MapDefinition) : ExpandedEdgeValue[] => {
	const edgesByRef : {[ref : NodeID]: ExpandedEdgeValue[]} = {};
	for (const edge of edges) {
		const ref = edge.ref || ROOT_ID;
		if (!edgesByRef[ref]) edgesByRef[ref] = [];
		edgesByRef[ref].push({
			...edge,
			implied: FALSE_NUMBER,
			source,
			ref
		});
	}
	//Not actually all property names, but those that have not explicitly opted to be excluded.
	const allPropertyNames : PropertyName[] = Object.keys(data.properties).filter(name => !data.properties[name].excludeFromDefaultImplication);
	const result : ExpandedEdgeValue[] =[];
	for (const [ref, refEdges] of Object.entries(edgesByRef)) {
		let impliedSet : PropertyNameSet = {};
		const seenSet : PropertyNameSet = {};
		for (const edge of refEdges) {
			seenSet[edge.type] = true;
			const implies = data.properties[edge.type].implies || edge.implies;
			impliedSet = {...impliedSet, ...impliedPropertyNames(implies, allPropertyNames)};
			delete edge.implies;
			result.push(edge);
		}
		//Now add any edges that were in implied set but not seen.
		for (const impliedPropertyName of Object.keys(impliedSet)) {
			if (seenSet[impliedPropertyName]) continue;
			const typeDefinition = data.properties[impliedPropertyName];
			const constants = typeDefinition.constants || {};
			result.push({
				...constants,
				type: impliedPropertyName,
				implied: DEFAULT_TRUE_NUMBER,
				source,
				ref
			});
		}
	}

	return result;
};

class AdjacencyMapNode {
	_id : NodeID;
	_map : AdjacencyMap;
	_data : NodeDefinition | undefined;
	_values : NodeValues | undefined;
	_isRoot : boolean;
	_cachedEdges : ExpandedEdgeValue[];
	_cachedRenderEdges : RenderEdgeValue[] | undefined;

	constructor(id : NodeID, parent : AdjacencyMap, data : NodeDefinition | undefined) {
		this._id = id;
		this._map = parent;
		this._data = data;
		this._isRoot = id == ROOT_ID;
	}

	_computeValues() : NodeValues {
		const partialResult : NodeValues = {};
		const edgeByType : {[type : PropertyName] : EdgeValue[]} = {};
		const edges = this._data?.edges || [];
		for (const edge of edges) {
			if (!edgeByType[edge.type]) edgeByType[edge.type] = [];
			edgeByType[edge.type].push(edge);
		}
		const scenarioNode = this._map.scenario.nodes[this.id] || {};
		//Iterate through edges in propertyNames order to make sure that any
		//ValueDefinitionResultValue will have the values they already rely on
		//calculated.
		for (const type of this._map.propertyNames) {
			//Fill in the partial result as we go so other things htat rely on
			//our root value can have it.
			partialResult[type] = this._map.rootValues[type];
			if (this._data) {
				if (this._data.values[type]) {
					partialResult[type] = this._data.values[type];
					//Dont' calculate the value at all, just override it.
					continue;
				}
			}
			if (scenarioNode[type]) {
				partialResult[type] = scenarioNode[type];
				//Dont' calculate the value at all, just override it, acting
				//like values.
				continue;
			}
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

	_scenarioChanged() {
		//The scenario changed, which means that we might need to invalidate
		//caches that rely on values that might have changed.
		
		//It might seem like we can only invalidate the cached value if
		//fromScenarioNode or toScenarioNode changed, but that's not right,
		//because our value relies on the values of nodes we depend on, and
		//THOSE might have changed, so just invalidate the cache.
		this._values = undefined;

		//Currently the edge values themselves cannot change because scenarios
		//can only modify nodes, and although the values flowing THROUGH those
		//edges might change when scenarios change, the actual edges themselves
		//don't. However, the renderEdges might change because they can rely on
		//values.

		this._cachedRenderEdges = undefined;
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

	get displayName() : string {
		return this._data?.displayName || this.id;
	}

	fullDescription(includeHidden = false) : string {
		const filter = includeHidden ? () => true : (entry : [PropertyName, number] ) => !this._map.data.properties[entry[0]].hide;
		return this.description + '\n\n' + Object.entries(this.values).filter(filter).map(entry => entry[0] + ': ' + entry[1]).join('\n');
	}

	get edges() : ExpandedEdgeValue[] {
		if (!this._cachedEdges) {
			if (this._data && this._data.edges) {
				this._cachedEdges = completeEdgeSet(this.id, this._data.edges, this._map.data);
			} else {
				this._cachedEdges = [];
			}
		}
		return this._cachedEdges;
	}

	_edgeDefinitionHelper(definition : ValueDefinition, edges : ExpandedEdgeValue[], input? : number[]) : number[] {
		const args : ValueDefinitionCalculationArgs = {
			edges: edges,
			//TODO: this.parents omits expliti root references
			refs: this.parents.map(id => this._map.node(id).values),
			partialResult: this.values,
			rootValue: this._map.rootValues
		};
		if (input) args.input = input;
		const result = calculateValue(definition, args);
		return result;
	}

	_spreadBumps(edges : RenderEdgeValue[]) : RenderEdgeValue[] {
		if (edges.length < 2) return edges;
		const totalTargetSpread = (edges.length -1) * TARGET_BUMP;
		const result : RenderEdgeValue[] = [];
		for (let i = 0; i < edges.length; i++) {
			const edge = edges[i];
			let bump = 0.5;
			if (totalTargetSpread > 1.0) {
				//Spread total amount evenly
				bump = (1 / (edges.length - 1)) * i;
			} else {
				//Spread each one out with the ideal spacing
				bump = i * TARGET_BUMP + (1 - totalTargetSpread) / 2;
			}
			result.push({
				...edge,
				bump
			});
		}
		return result;
	}

	_calculateRenderEdges() : RenderEdgeValue[] {
		
		const defaultBump = 0.5;

		const result : RenderEdgeValue[] = [];

		const source = this.id;
		
		const edgesByRef : {[source : NodeID]: {[edgeType : PropertyName]: ExpandedEdgeValue[]}} = {};
		for (const edge of this.edges) {
			if (!edgesByRef[edge.ref]) edgesByRef[edge.ref] = {};
			if (!edgesByRef[edge.ref][edge.type]) edgesByRef[edge.ref][edge.type] = [];
			edgesByRef[edge.ref][edge.type].push(edge);
		}
		for (const [ref, edgeMap] of Object.entries(edgesByRef)) {
			const bundledEdges : RenderEdgeValue[] = [];
			let resultsForRef :RenderEdgeValue[] = [];
			for (const [edgeType, edges] of Object.entries(edgeMap)){
				const edgeDefinition = this._map.data.properties[edgeType];
				const colorDefinitionOrString = edgeDefinition.display.color || this._map.data.display.edge.color;
				const colorDefinition = wrapStringAsColor(colorDefinitionOrString);
				const colors = this._edgeDefinitionHelper(colorDefinition, edges);
				const widthDefinition = edgeDefinition.display.width || this._map.data.display.edge.width;
				const clippedWidthDefinition = {
					clip: widthDefinition,
					low: 0.0
				};
				const widths = this._edgeDefinitionHelper(clippedWidthDefinition, edges);
				const opacityDefinition = edgeDefinition.display.opacity || this._map.data.display.edge.opacity;
				const clippedOpacityDefinition = {
					clip: opacityDefinition,
					low: 0.0,
					high: 1.0
				};
				const opacities = this._edgeDefinitionHelper(clippedOpacityDefinition, edges);
				const distinctDefinition = edgeDefinition.display.distinct || this._map.data.display.edge.distinct;
				const distincts = this._edgeDefinitionHelper(distinctDefinition, edges);

				const [wrappedColors, wrappedWidths, wrappedOpacities, wrappedDistincts] = wrapArrays(colors, widths, opacities, distincts);

				for (let i = 0; i < wrappedColors.length; i++) {

					const renderEdge = {
						source,
						ref,
						width: wrappedWidths[i % wrappedWidths.length],
						opacity: wrappedOpacities[i % wrappedOpacities.length],
						color: unpackColor(wrappedColors[i % wrappedColors.length]),
						bump: defaultBump,
					};

					const distinct = wrappedDistincts[i % wrappedDistincts.length];

					if (distinct) {
						resultsForRef.push(renderEdge);
					} else {
						bundledEdges.push(renderEdge);
					}
				}
			}

			if (bundledEdges.length) {
				//We need to do edge combining.
				const colorDefinitionOrString = this._map.data.display.edgeCombiner.color;
				const colorDefinition = wrapStringAsColor(colorDefinitionOrString);
				const colors = this._edgeDefinitionHelper(colorDefinition, [], bundledEdges.map(edge => packColor(edge.color)));
				const widthDefinition = {
					clip: this._map.data.display.edgeCombiner.width,
					low: 0
				};
				const widths = this._edgeDefinitionHelper(widthDefinition, [], bundledEdges.map(edge => edge.width));
				const opacityDefinition = {
					clip: this._map.data.display.edgeCombiner.opacity,
					low: 0.0,
					high: 1.0 
				};
				const opacities = this._edgeDefinitionHelper(opacityDefinition, [], bundledEdges.map(edge => edge.opacity));

				const [wrappedColors, wrappedWidths, wrappedOpacities] = wrapArrays(colors, widths, opacities);

				for (let i = 0; i < wrappedColors.length; i++) {
					const renderEdge = {
						source,
						ref,
						width: wrappedWidths[i % wrappedWidths.length],
						opacity: wrappedOpacities[i % wrappedOpacities.length],
						color: unpackColor(wrappedColors[i % wrappedColors.length]),
						bump: defaultBump,
					};
					resultsForRef.push(renderEdge);
				}
			}

			//Remove edges that have 0 width and pretend they don't exist
			resultsForRef = resultsForRef.filter(edge => edge.width > 0);

			result.push(...this._spreadBumps(resultsForRef));
		}
		return result;
	}

	get renderEdges(): RenderEdgeValue[] {
		if (!this._cachedRenderEdges) {
			this._cachedRenderEdges = this._calculateRenderEdges();
		}
		return this._cachedRenderEdges;
	}

	//Gets the parents we reference. Note that ROOT_ID is nearly always implied,
	//but not returned here.
	get parents() : NodeID[] {
		if (!this._data || !this._data.edges) return [];
		return this._data.edges.map(edge => edge.ref).filter(ref => ref && ref != ROOT_ID) as NodeID[];
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
		const definitionOrString = this._data?.display?.color || this._map.data.display.node.color;
		const colorDefinition = wrapStringAsColor(definitionOrString);
		const num = this._valueDefinitionHelper(colorDefinition);
		return unpackColor(num);
	}
}