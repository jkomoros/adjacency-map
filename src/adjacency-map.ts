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
	LayoutID,
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
	TagDefinition,
	TagID,
	TagMap,
	TagConstantName,
	AllowedValueDefinitionVariableTypes,
	ValudeDefinitionValidationArgs,
	ScenariosDefinitionUnextended,
	RenderEdgeSubEdge,
	RawEdgeInput,
	ScenarioNode,
	NodeValuesOverride,
	ScenarioNodeEdges,
	EdgeValueModificationMap,
	ConstantType,
	GroupID,
	GroupDefinition,
	CircleLayoutInfo
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
	colorMean,
	COMBINERS,
	DEFAULT_COMBINER,
	mean,
	sum
} from './combine.js';

import {
	TreeLayout
} from './tree-svg.js';

import {
	calculateValue, 
	calculateValueLeaf, 
	cloneWithSelf, 
	extractRequiredDependencies, 
	RESERVED_EDGE_CONSTANT_NAMES,
	validateValueDefinition,
	valueDefinitionIsLeaf,
	valueDefinitionIsStringType,
	valueDefinitionReliesOnEdges
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
	constantsForEdge,
	emptyScenarioNode,
	getEdgeValueMatchID,
	idToDisplayName,
	wrapArrays
} from './util.js';

import { TypedObject } from './typed-object.js';
import { CirclePackLayout } from './circle-pack.js';

const BASE_ALLOWED_VARIABLE_TYPES : AllowedValueDefinitionVariableTypes = {
	edgeConstant: true,
	parentValue: true,
	resultValue: true,
	rootValue: true,
	input: false,
	hasTag: true,
	tagConstant: true
};

const ALLOWED_VARIABLES_FOR_CONTEXT = {
	nodeDisplay: {
		...BASE_ALLOWED_VARIABLE_TYPES,
		edgeConstant: false
	},
	property: BASE_ALLOWED_VARIABLE_TYPES,
	propertyDisplay: BASE_ALLOWED_VARIABLE_TYPES,
	propertyCombinerDisplay: {
		...BASE_ALLOWED_VARIABLE_TYPES,
		edgeConstant: false,
		input: true,
	},
	nodeOverride: {
		edgeConstant: false,
		parentValue: false,
		resultValue: false,
		rootValue: false,
		input: true,
		hasTag: true,
		tagConstant: true
	}
} as const;

//If an edge is bumped, this is the amount we aim to bump it by by default.
const TARGET_BUMP = 0.4;

const LAYOUT_ID_GROUP_PREFIX = 'group';
const LAYOUT_ID_NODE_PREFIX = 'node';

export const isLayoutID = (input : string) : boolean => {
	if (input.startsWith(LAYOUT_ID_GROUP_PREFIX + ':')) return true;
	if (input.startsWith(LAYOUT_ID_NODE_PREFIX + ':')) return true;
	return false;
};

export const nodeIDFromLayoutID = (id : LayoutID | undefined) : NodeID | undefined => {
	if (id == undefined) return undefined;
	const prefix = LAYOUT_ID_NODE_PREFIX + ':';
	if (!id.startsWith(prefix)) return undefined;
	return id.slice(prefix.length);
};

//A similar implementation exists in AdjacencyMap._extractGroupedSimmpleGraph.
export const extractSimpleGraph = (data : MapDefinition, scenarioName : ScenarioName = DEFAULT_SCENARIO_NAME) : SimpleGraph => {
	const result : SimpleGraph = {};
	const scenario : Scenario = data.scenarios && data.scenarios[scenarioName] ? data.scenarios[scenarioName] : {description: '', nodes: {}};
	const scenarioNodes = scenario.nodes;
	for (const [id, value] of Object.entries(data.nodes)) {
		const scenarioNode = scenarioNodes[id] || emptyScenarioNode();
		const edges : {[id : NodeID] : true} = {};
		const [finalEdges] = edgesWithScenarioModifications(value.edges, scenarioNode.edges);
		for (const edge of finalEdges) {
			const ref = edge.parent || ROOT_ID;
			edges[ref] = true;
		}
		result[id] = edges;
	}
	result[ROOT_ID] = {};
	return result;
};

const scenarioNameGraph = (scenarios :ScenariosDefinitionUnextended) : SimpleGraph => {
	const result : SimpleGraph = {'': {}};
	for (const [scenarioID, scenarioDefinition] of Object.entries(scenarios)) {
		const children : {[otherID : NodeID] : true} = {};
		const extendsVal = scenarioDefinition.extends || '';
		children[extendsVal] = true;
		result[scenarioID] = children;
	}
	return result;
};

//There are a number of different ways to conveniently define edges, this
//function converts all of them to the base type.
const extractEdgesFromRawEdgeInput = (input? : RawEdgeInput) : EdgeValue[] => {
	if (!input) return [];
	const edges : EdgeValue [] = [];
	if (Array.isArray(input)) {
		for (const rawValue of input) {
			const value : EdgeValue = {type: rawValue.type};
			if (rawValue.parent != undefined) value.parent = rawValue.parent;
			if (rawValue.implies != undefined) value.implies = rawValue.implies;
			for (const entry of Object.entries(rawValue)) {
				if (RESERVED_EDGE_CONSTANT_NAMES[entry[0]]) continue;
				const val = entry[1] as ValueDefinition;
				if (!valueDefinitionIsLeaf(val)) continue;
				value[entry[0]] = calculateValueLeaf(val);
			}
			edges.push(value);
		}
	} else {
		for (const [parent, refData] of Object.entries(input)) {
			if (Array.isArray(refData)) {
				for (const rawValue of refData) {
					const value : EdgeValue = {
						type: rawValue.type,
						parent
					};
					if (rawValue.implies != undefined) value.implies = rawValue.implies;
					for (const entry of Object.entries(rawValue)) {
						if (RESERVED_EDGE_CONSTANT_NAMES[entry[0]]) continue;
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
							parent
						};
						if (rawValue.implies != undefined) value.implies = rawValue.implies;
						for (const entry of Object.entries(rawValue)) {
							if (RESERVED_EDGE_CONSTANT_NAMES[entry[0]]) continue;
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

export const makeTagMap = (input : undefined | TagID | TagID[] | TagMap) : TagMap => {
	if (!input) return {};
	const tags : TagMap = {};
	if (typeof input == 'string') {
		tags[input] = true;
	} else if (Array.isArray(input)) {
		for (const tag of input) {
			tags[tag] = true;
		}
	} else {
		for (const [tagID, value] of Object.entries(input)) {
			tags[tagID] = value;
		}
	}
	return tags;
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
		const calculateWhen = rawDefinition.calculateWhen || 'edges';
		const definition : PropertyDefinition = {
			...rawDefinition,
			calculateWhen,
			value,
			dependencies,
			extendTags: !! rawDefinition.extendTags,
			excludeFromDefaultImplication: (!! rawDefinition.excludeFromDefaultImplication || calculateWhen != 'edges'),
			display: {
				...rawEdgeDisplay
			},
			constants: Object.fromEntries(Object.entries(rawDefinition.constants || {}).map(entry => [entry[0], calculateValueLeaf(entry[1])]))
		};
		properties[name] = definition;
	}
	const nodes : {[id : NodeID]: NodeDefinition} = {};
	for (const [id, rawNode] of Object.entries(data.nodes || {})) {
		const edges : EdgeValue[] = extractEdgesFromRawEdgeInput(rawNode.edges);
		const rawNodeDisplay = rawNode.display || {};
		const rawValues = rawNode.values || {};
		const values = {...rawValues};
		const tags = makeTagMap(rawNode.tags);
		let displayName = rawNode.displayName;
		if (displayName === undefined) displayName = idToDisplayName(id);
		if (displayName === '') displayName = id;
		nodes[id] = {
			...rawNode,
			tags,
			edges,
			displayName,
			values,
			display: {
				...rawNodeDisplay
			}
		};
	}
	const groups : {[id : GroupID]: GroupDefinition} = {};
	for (const [id, groupNode] of Object.entries(data.groups || {})) {
		let displayName = groupNode.displayName;
		if (displayName == undefined) displayName = idToDisplayName(id);
		if (displayName === '') displayName = id;
		groups[id] = {
			...groupNode,
			displayName
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
	const expandedScenarios : ScenariosDefinitionUnextended = {};
	for (const [scenarioName, scenarioDefinition] of Object.entries(rawScenarios)) {
		if (!Array.isArray(scenarioDefinition)) {
			expandedScenarios[scenarioName] = scenarioDefinition;
			continue;
		}
		if (scenarioDefinition.length == 0) continue;
		for (let i = 0; i < scenarioDefinition.length; i++) {
			const obj = {...scenarioDefinition[i]};
			if (i > 0) obj.extends = scenarioName + '_' + String(i - 1);
			expandedScenarios[scenarioName + '_' + String(i)] = obj;
		}
	}
	const topologicalScenarios = topologicalSort(scenarioNameGraph(expandedScenarios));
	topologicalScenarios.reverse();
	const scenarios : ScenariosDefinition = {};
	for (const scenarioName of topologicalScenarios) {
		const rawScenario = expandedScenarios[scenarioName] || {description: '', nodes: {}};
		const scenarioToExtend : Scenario = rawScenario.extends !== undefined ? scenarios[rawScenario.extends] : {description: '', nodes: {}};
		if (!scenarioToExtend) throw new Error('Scenario ' + scenarioName + ' extends a non-existent scenario ' + rawScenario.extends);

		//Create a FULL overlay of every node that has ever been touched in any
		//of the scenarios in our `extends` chain. We do this by propogating
		//every node from the previous scenario in our extends chain, and then
		//overlaying our modifications... which the previous one did too, and on
		//and on back to an extends of hte root scenario.

		const nodes : {[id : NodeID]: ScenarioNode} = {};
		for (const [id, baseNode] of Object.entries(scenarioToExtend.nodes)) {
			nodes[id] = {
				values: {...(baseNode.values || {})},
				edges: {
					extended: baseNode.edges,
					add: [],
					remove: {},
					modify: {}
				}
			};
		}
		for (const [id, node] of Object.entries(rawScenario.nodes)) {
			const existingNode : ScenarioNode = nodes[id] || emptyScenarioNode();
			const newNode : ScenarioNode = {
				values: {...existingNode.values, ...(node.values || {})},
				edges: {
					add: extractEdgesFromRawEdgeInput(node?.edges?.add),
					remove: node.edges?.remove || {},
					modify: node?.edges?.modify || {}
				}
			};
			if (existingNode.edges.extended) newNode.edges.extended = existingNode.edges.extended;
			nodes[id] = newNode;
		}

		const scenario : Scenario = {
			description: rawScenario.description || scenarioToExtend.description || '',
			nodes
		};
		scenarios[scenarioName] = scenario;
	}
	//Put the scenarios back into original sorted (non topological) order
	const sortedScenarios : ScenariosDefinition = {};
	for (const scenarioName of Object.keys(rawScenarios)) {
		const rawScenario = rawScenarios[scenarioName];
		if (Array.isArray(rawScenario)) {
			for (let i = 0; i < rawScenario.length; i++) {
				const key = scenarioName + '_' + String(i);
				sortedScenarios[key] = scenarios[key];
			}
		} else {
			sortedScenarios[scenarioName] = scenarios[scenarioName];
		}
	}
	const tags : {[id : TagID]: Required<TagDefinition>} = {};
	if (data.tags) {
		for (const [tagID, rawTagDefinition] of Object.entries(data.tags)) {
			const displayName = rawTagDefinition.displayName || tagID;
			tags[tagID] = {
				description: rawTagDefinition.description || ('Tag ' + displayName),
				displayName,
				color: rawTagDefinition.color || 'red',
				root: !!rawTagDefinition.root,
				constants: Object.fromEntries(Object.entries(rawTagDefinition.constants || {}).map(entry => [entry[0], calculateValueLeaf(entry[1])]))
			};
		}
	}
	const description = data.description || '';
	return {
		...data,
		description,
		root,
		display,
		tags,
		properties,
		nodes,
		groups,
		scenarios: sortedScenarios
	};
};

const validateDisplay = (data : Partial<NodeDisplay> | Partial<EdgeDisplay> | Partial<EdgeCombinerDisplay>, args : ValudeDefinitionValidationArgs) : void => {
	args = {...args, skipDependencies: true};
	for (const [displayName, displayValue] of Object.entries(data)) {
		if (typeof displayValue == 'string') {
			if (valueDefinitionIsStringType(displayValue)) {
				validateValueDefinition(displayValue, args);
			} else if (displayName == 'color' || displayName == 'strokeColor') {
				//Throw if not a color
				color(displayValue);
			} else {
				throw new Error(displayName + ' was provided as a string');
			}
		} else {
			validateValueDefinition(displayValue, args);
		}
	}
};

const validateEdges = (data : MapDefinition, nodeID: NodeID, edges?: EdgeValue[]) : void => {
	if (!edges) edges = [];
	for (const edge of edges) {
		if (!edge.type) throw new Error(nodeID + ' has an edge with no type');
		if (!data.properties[edge.type]) throw new Error(nodeID + ' has an edge of type ' + edge.type + ' which is not included in types');
		if (data.properties[edge.type].calculateWhen == 'always') throw new Error(nodeID + ' has an edge of type ' + edge.type + ' but that edge type does not allow any edges');
		if (Object.keys(explicitlyEnumeratedImpliedPropertyNames(edge.implies)).some(propertyName => !data.properties[propertyName] || data.properties[propertyName].calculateWhen == 'always')) throw new Error(nodeID + ' has an edge that has an implication that explicitly implies a property that doesn\'t exist or is noEdges');
	}
};

const validateNodeValues = (data : MapDefinition, values?: NodeValuesOverride) : void => {
	if (!values) return;
	if (typeof values != 'object') throw new Error('values if provided must be an object');
	for (const [valueName, valueValue] of Object.entries(values)) {
		if (!data.properties[valueName]) throw new Error('values property ' + valueName + ' is not defined in properties');
		validateValueDefinition(valueValue, {exampleValues: {}, data, allowedVariables: ALLOWED_VARIABLES_FOR_CONTEXT.nodeOverride});
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
		if (nodeData.group && !data.groups[nodeData.group]) throw new Error(nodeName + ' specifies group ' + nodeData.group + ' but that group is not defined');
		validateEdges(data, nodeName, nodeData.edges);
		validateDisplay(nodeData.display, {exampleValues, data, allowedVariables:ALLOWED_VARIABLES_FOR_CONTEXT.nodeDisplay});
		validateNodeValues(data, nodeData.values);
		for (const tagID of Object.keys(nodeData.tags)) {
			if (!data.tags[tagID]) throw new Error(nodeName + ' defined an unknown tag: ' + tagID);
		}
	}

	for (const [groupID, groupData] of Object.entries(data.groups)) {
		if (groupID == '') throw new Error('Groups must have a non-empty ID');
		//We don't need to check for overlap with normal node IDs because the node and metaNode ID space never overlaps.
		if (!groupData.description) throw new Error('group '+ groupID + ' has no description');
		if (groupData.group && !data.groups[groupData.group]) throw new Error('group ' + groupID + ' specifies a parent group (' + groupData.group + ') that doesnt exist');
	}

	const expectedTagConstants : {[name : TagConstantName]: true} = {};
	let firstTag = true;
	for (const [tagID, tagDefinition] of Object.entries(data.tags)) {
		const notSeenConstants = {...expectedTagConstants};
		for (const constantName of Object.keys(tagDefinition.constants)) {
			if (firstTag) {
				expectedTagConstants[constantName] = true;
			} else {
				if (!notSeenConstants[constantName]) throw new Error(tagID + ' had a constant named ' + constantName + ' but the first tag did not');
				delete notSeenConstants[constantName];
			}
		}
		if (Object.keys(notSeenConstants).length) throw new Error(tagID + ' was missing expected constants ' + Object.keys(notSeenConstants).join(', '));
		firstTag = false;
	}

	for(const [type, propertyDefinition] of Object.entries(data.properties)) {
		try {
			validateValueDefinition(propertyDefinition.value, {exampleValues, data, allowedVariables: ALLOWED_VARIABLES_FOR_CONTEXT.property, propertyDefinition});
		} catch (err) {
			throw new Error(type + ' does not have a legal value definition: ' + err);
		}
		if (propertyDefinition.calculateWhen == 'always' && valueDefinitionReliesOnEdges(propertyDefinition.value)) throw new Error(type + ' has set noEdges but its value definition relies on edges');
		if (propertyDefinition.calculateWhen == 'always' && propertyDefinition.implies) throw new Error(type + ' sets noEdges but also sets an implies value.');
		if (propertyDefinition.combine && !COMBINERS[propertyDefinition.combine]) throw new Error('Unknown combiner: ' + propertyDefinition.combine);
		if (propertyDefinition.description && typeof propertyDefinition.description != 'string') throw new Error(type + ' has a description not of type string');
		if (Object.keys(explicitlyEnumeratedImpliedPropertyNames(propertyDefinition.implies)).some(propertyName => !data.properties[propertyName] || data.properties[propertyName].calculateWhen == 'always')) throw new Error(type + 'has an implication that explicitly implies a property that doesn\'t exist or is noEdges');
		if (propertyDefinition.constants) {
			for (const [constantName, constantValue] of Object.entries(propertyDefinition.constants)) {
				if (RESERVED_EDGE_CONSTANT_NAMES[constantName]) throw new Error(constantName + ' was present in constants for ' + type + ' but is reserved');
				if (typeof constantValue != 'number') throw new Error(type + ' constant ' + constantName + ' was not number as expected');
			}
		}
		validateDisplay(propertyDefinition.display, {exampleValues, data, allowedVariables: ALLOWED_VARIABLES_FOR_CONTEXT.propertyDisplay, propertyDefinition});
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
		for (const [nodeName, nodeDefinition] of Object.entries(scenario.nodes)) {
			if (nodeName != ROOT_ID && !data.nodes[nodeName]) throw new Error('All node ids in a scenario must be either ROOT_ID or included in nodes');
			validateNodeValues(data, nodeDefinition.values);
			validateEdges(data, nodeName, nodeDefinition.edges.add);
			validateEdges(data, nodeName, Object.values(nodeDefinition.edges.modify));
			//Skip validating remove which isn't actually edges
		}
	}

	for (const displayKey of TypedObject.keys(data.display)) {
		switch(displayKey) {
		case 'edge':
			validateDisplay(data.display.edge, {exampleValues, data, allowedVariables: ALLOWED_VARIABLES_FOR_CONTEXT.propertyDisplay});
			break;
		case 'edgeCombiner':
			validateDisplay(data.display.edgeCombiner, {exampleValues, data, allowedVariables: ALLOWED_VARIABLES_FOR_CONTEXT.propertyCombinerDisplay});
			break;
		case 'node':
			validateDisplay(data.display.node, {exampleValues, data,  allowedVariables: ALLOWED_VARIABLES_FOR_CONTEXT.nodeDisplay});
			break;
		default:
			assertUnreachable(displayKey);
		}
	}
	const scenarioNames = [DEFAULT_SCENARIO_NAME, ...Object.keys(data.scenarios)];
	for (const scenarioName of scenarioNames) {
		try {
			topologicalSort(extractSimpleGraph(data, scenarioName));
		} catch (err) {
			throw new Error('The edges provided did not form a DAG in scenario ' + scenarioName);
		}
	}
};

export type LayoutNode = AdjacencyMapNode | AdjacencyMapGroup;

export class AdjacencyMap {
	
	_data : MapDefinition;
	_nodes : {[id : NodeID] : AdjacencyMapNode};
	_disableGroups : boolean;
	_groups : {[id : GroupID] : AdjacencyMapGroup};
	_cachedChildren : {[id : NodeID] : NodeID[]};
	_cachedEdges : ExpandedEdgeValue[];
	_cachedRenderEdges : RenderEdgeValue[] | undefined;
	_cachedRoot : NodeValues | undefined;
	_cachedTags : TagMap;
	_cachedPropertyNames : PropertyName[];
	_cachedLayoutInfo : LayoutInfo;
	_scenarioName : ScenarioName;

	constructor(rawData : RawMapDefinition, scenarioName : ScenarioName = DEFAULT_SCENARIO_NAME, disableGroups = false) {
		//will throw if invalid library is included
		const data = processMapDefinition(rawData);
		//Will throw if it doesn't validate
		validateData(data);
		if (!data) throw new Error('undefined data');
		//TODO: deep freeze a copy of data
		this._data = data;
		this._nodes = {};
		this._groups = {};
		this._disableGroups = disableGroups;

		if (scenarioName != DEFAULT_SCENARIO_NAME && !this.data.scenarios[scenarioName]) throw new Error('no such scenario');

		this._scenarioName = scenarioName;
		const children : SimpleGraph = {};
		for (const [child, definition] of Object.entries(this._data.nodes)) {
			const edges = definition.edges || [];
			for (const edge of edges) {
				const parent = edge.parent || ROOT_ID;
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

	get legalEdgePropertyNames() : PropertyName[] {
		return this.propertyNames.filter(propertyName => {
			const definition = this._data.properties[propertyName];
			if (definition.calculateWhen != 'edges') return false;
			if (definition.hide) return false;
			return true;
		});
	}

	get groupsDisabled() : boolean {
		return this._disableGroups;
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

	get rootTags() : TagMap {
		//TODO: cache
		return Object.fromEntries(Object.entries(this._data.tags).filter(entry => entry[1].root).map(entry => [entry[0], true]));
	}

	//the union of all node's tags.
	get tagsUnion() : TagMap {
		if (!this._cachedTags) {
			let tags : TagMap = {};
			for (const node of Object.values(this.nodes)) {
				tags = {...tags, ...node.tags};
			}
			this._cachedTags = tags;
		}
		return this._cachedTags;
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
			const scenarioNode = this.scenario.nodes[ROOT_ID] || {values:{}};
			const result = {...baseObject, ...this._data.root};
			const args : ValueDefinitionCalculationArgs = {
				refs: [],
				edges: [],
				partialResult: {},
				rootValue: {},
				tags: this.rootTags,
				selfTags: {},
				definition: this._data
			};
			for (const [propertyName, valueDefinition] of Object.entries(scenarioNode.values)) {
				result[propertyName] = calculateValue(valueDefinition, {...args, input: [result[propertyName]]})[0];
			}
			this._cachedRoot = result;
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

	group(id : GroupID) : AdjacencyMapGroup {
		if (this.groupsDisabled) throw new Error('Groups are disabled');
		if (!this._groups[id]) {
			if (!this._data.groups[id]) throw new Error('ID ' + id + ' does not exist in input');
			this._groups[id] = new AdjacencyMapGroup(this, id, this._data.groups[id]);
		}
		return this._groups[id];
	}

	_children(id : NodeID) : NodeID[] {
		return this._cachedChildren[id];
	}

	get nodes() : {[id : NodeID] : AdjacencyMapNode} {
		//TODO: cache. Not a huge deal because the heavy lifting is cached behind node().
		const ids = ['',...Object.keys(this._data.nodes)];
		return Object.fromEntries(ids.map(id => [id, this.node(id)]));
	}

	get groups() : {[id : GroupID] : AdjacencyMapGroup} {
		if (this.groupsDisabled) return {};
		//TODO: cache. Not a huge deal because the heavy lifting is cached behind group().
		return Object.fromEntries(Object.keys(this._data.groups).map(id => [id, this.group(id)]));
	}

	layoutNode(id : LayoutID) : LayoutNode {
		const [type, otherID] = id.split(':');
		if (type == undefined || otherID == undefined) throw new Error('Unxpected shape of layoutID: ' + id);
		return type == LAYOUT_ID_GROUP_PREFIX ? this.group(otherID) : this.node(otherID);
	}

	//The top level layout nodes (things that are not themselves part of a group (excluding groups without items).
	get layoutNodes() : {[id : LayoutID] : LayoutNode} {
		if (this.groupsDisabled) {
			return this.nodes;
		}
		const groupsWithNodes = Object.fromEntries(Object.entries(this.groups).filter(entry => entry[1].hasNodes));
		return {...this.nodes, ...groupsWithNodes};
	}

	get edges() : ExpandedEdgeValue[] {
		if (!this._cachedEdges) {
			this._cachedEdges = Object.keys(this._data.nodes).map(id => this.node(id).edges).flat();
		}
		return this._cachedEdges;
	}

	get renderEdges() : RenderEdgeValue[] {
		if (!this._cachedRenderEdges) {
			this._cachedRenderEdges = Object.values(this.layoutNodes).map(layoutNode => layoutNode.renderEdges).flat();
		}
		return this._cachedRenderEdges;
	}

	_extractGroupedSimpleGraph() : SimpleGraph {
		//similar to extractSimpleGraph but doens't have to do the scenario
		//overrides of nodes itself because it can use live nodes, and also it groups things based on groups.

		const result : SimpleGraph = {};
		for (const node of Object.values(this.nodes)) {
			const rootID = node._rootLayoutID;
			
			//It's possible for multiple nodes to be added to the same final
			//group, so there might already be edges.
			if (!result[rootID]) {
				result[rootID] = {};
			}
			const resultEdges = result[rootID];
			for (const edge of node.edges) {
				const parentNode = this.node(edge.parent);
				const parentRootID = parentNode._rootLayoutID;
				//with grouping applied there might be 'internal' nodes that
				//resolve to the same rootLayoutID. Skip them.
				if (parentRootID == rootID) continue;
				resultEdges[parentRootID] = true;
			}
		}
		return result;
	}

	_ensureLayoutInfo() {
		if (this._cachedLayoutInfo) return;
		const simpleGraph = this._extractGroupedSimpleGraph();
		const longestTree = tidyLongestTree(simpleGraph);
		const treeGraph = treeGraphFromParentGraph(longestTree);
		this._cachedLayoutInfo = TreeLayout(treeGraph, SVG_WIDTH, SVG_HEIGHT);
	}

	get description() : string {
		return this._data.description;
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

const explicitlyEnumeratedImpliedPropertyNames = (config : ImpliesConfiguration | undefined) : PropertyNameSet => {
	if (!Array.isArray(config)) return {};
	return Object.fromEntries(config.map(name => [name, true]));
};

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

const edgesWithScenarioModifications = (baseEdges : EdgeValue[], modifications? : ScenarioNodeEdges, skipRemovalsAtTopLevel = false) : [EdgeValue[], EdgeValueModificationMap] => {

	let result : EdgeValue[] = baseEdges ? [...baseEdges] : [];
	const modMap : EdgeValueModificationMap = {};

	if (!modifications) return [result, modMap];

	if (modifications.extended) {
		[result] = edgesWithScenarioModifications(result, modifications.extended);
	}

	//Actually remove items that are in removals.
	const filteredResult = result.filter(edge => {
		const id = getEdgeValueMatchID(edge);
		if (!modifications.remove[id]) return true;
		modMap[id] = null;
		return skipRemovalsAtTopLevel;
	});

	const modifyMap = modifications.modify;

	const modifiedResult = filteredResult.map(edge => {
		const id = getEdgeValueMatchID(edge);
		if (!modifyMap[id]) return edge;
		const newEdge = modifyMap[id];
		modMap[getEdgeValueMatchID(newEdge)] = id;
		return newEdge;
	});

	for (const additionEdge of modifications.add) {
		modifiedResult.push(additionEdge);
	}

	return [modifiedResult, modMap];
};

const completeEdgeSet = (source: NodeID, data : MapDefinition, edges : EdgeValue[]) : ExpandedEdgeValue[] => {
	const edgesByRef : {[ref : NodeID]: ExpandedEdgeValue[]} = {};
	for (const edge of edges) {
		const parent = edge.parent || ROOT_ID;
		if (!edgesByRef[parent]) edgesByRef[parent] = [];
		edgesByRef[parent].push({
			...edge,
			implied: FALSE_NUMBER,
			source,
			parent
		});
	}
	//Not actually all property names, but those that have not explicitly opted to be excluded.
	const allPropertyNames : PropertyName[] = Object.keys(data.properties).filter(name => !data.properties[name].excludeFromDefaultImplication);
	const result : ExpandedEdgeValue[] =[];
	for (const [parent, refEdges] of Object.entries(edgesByRef)) {
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
				parent
			});
		}
	}

	return result;
};

const expandedEdgeToRenderEdgeSubEdge = (input : ExpandedEdgeValue) : RenderEdgeSubEdge => {
	const result : RenderEdgeSubEdge = {type: '', implied: 0};
	for (const [key, value] of Object.entries(input)) {
		if (key == 'type') {
			result[key] = value as PropertyName;
			continue;
		}
		if (typeof value != 'number') continue;
		result[key] = value;
	}
	return result;
};


const spreadBumps = (edges : RenderEdgeValue[]) : RenderEdgeValue[] => {
	const numRenderedEges = edges.filter(edge => edge.width > 0).length;
	if (numRenderedEges< 2) return edges;
	const totalTargetSpread = (numRenderedEges -1) * TARGET_BUMP;
	const result : RenderEdgeValue[] = [];
	for (let i = 0; i < edges.length; i++) {
		const edge = edges[i];
		let bump = 0.5;
		if (edge.width > 0) {
			if (totalTargetSpread > 1.0) {
				//Spread total amount evenly
				bump = (1 / (numRenderedEges - 1)) * i;
			} else {
				//Spread each one out with the ideal spacing
				bump = i * TARGET_BUMP + (1 - totalTargetSpread) / 2;
			}
		}
		result.push({
			...edge,
			bump
		});
	}
	return result;
};

const edgeDefinitionHelper = (nodes : AdjacencyMapNode | AdjacencyMapNode[],  definition : ValueDefinition, edges : ExpandedEdgeValue[], input? : number[]) : number[] => {
	if (!Array.isArray(nodes)) nodes = [nodes];
	if (nodes.length == 0) throw new Error('Expect at least one node');
	//TODO: cheat and use the first node as "primary". Ultimately we should make
	//it so each thing it relies on uses a union of nodes.
	const primaryNode = nodes[0];
	const map = primaryNode._map;
	const parentIDs = Object.keys(Object.fromEntries(edges.map(edge => [edge.parent, true])));
	let allTags : TagMap = {};
	let selfTags : TagMap = {};
	for (const node of nodes) {
		allTags = {...allTags, ...node.tags};
		const nodeSelfTags = node._data ? node._data.tags : {};
		selfTags = {...selfTags, ...nodeSelfTags};
	}
	const args : ValueDefinitionCalculationArgs = {
		edges: edges,
		refs: parentIDs.map(id => map.node(id).values),
		partialResult: primaryNode.values,
		rootValue: map.rootValues,
		tags: allTags,
		selfTags,
		definition: map.data
	};
	if (input) args.input = input;
	const result = calculateValue(definition, args);
	return result;
};

const renderEdges = (map : AdjacencyMap, source : LayoutID, nodes : AdjacencyMapNode[]) : RenderEdgeValue[] => {
	const defaultBump = 0.5;

	const result : RenderEdgeValue[] = [];

	if (nodes.length == 0) return [];
	
	const edgesByRef : {[source : LayoutID]: {[edgeType : PropertyName]: {edges: ExpandedEdgeValue[], nodes: AdjacencyMapNode[]}}} = {};
	for (const node of nodes) {
		for (const edge of node.edges) {
			const parentID = map.node(edge.parent)._rootLayoutID;
			//Skip 'internal' edges that are fully contained within this group
			if (parentID == source) continue;
			if (!edgesByRef[parentID]) edgesByRef[parentID] = {};
			if (!edgesByRef[parentID][edge.type]) edgesByRef[parentID][edge.type] = {nodes: [], edges: []};
			edgesByRef[parentID][edge.type].nodes.push(node);
			edgesByRef[parentID][edge.type].edges.push(edge);
		}
	}
	for (const [parent, edgeMap] of Object.entries(edgesByRef)) {
		const bundledEdges : RenderEdgeValue[] = [];
		const resultsForRef :RenderEdgeValue[] = [];
		for (const [edgeType, edgeContainer] of Object.entries(edgeMap)){
			const nodesForEdges = edgeContainer.nodes;
			const edges = edgeContainer.edges;
			const edgeDefinition = map.data.properties[edgeType];
			const colorDefinitionOrString = edgeDefinition.display.color == undefined ? map.data.display.edge.color : edgeDefinition.display.color;
			const colorDefinition = wrapStringAsColor(colorDefinitionOrString);
			const colors = edgeDefinitionHelper(nodesForEdges, colorDefinition, edges);
			const widthDefinition = edgeDefinition.display.width == undefined ? map.data.display.edge.width : edgeDefinition.display.width;
			const clippedWidthDefinition = {
				clip: widthDefinition,
				low: 0.0
			};
			const widths = edgeDefinitionHelper(nodesForEdges, clippedWidthDefinition, edges);
			const opacityDefinition = edgeDefinition.display.opacity == undefined ? map.data.display.edge.opacity : edgeDefinition.display.opacity;
			const clippedOpacityDefinition = {
				clip: opacityDefinition,
				low: 0.0,
				high: 1.0
			};
			const opacities = edgeDefinitionHelper(nodesForEdges, clippedOpacityDefinition, edges);
			const distinctDefinition = edgeDefinition.display.distinct || map.data.display.edge.distinct;
			const distincts = edgeDefinitionHelper(nodesForEdges, distinctDefinition, edges);

			const [wrappedColors, wrappedWidths, wrappedOpacities, wrappedDistincts] = wrapArrays(colors, widths, opacities, distincts);

			const collapsed = wrappedColors.length == 1;

			for (let i = 0; i < wrappedColors.length; i++) {

				const subEdges = collapsed ? edges.map(edge => expandedEdgeToRenderEdgeSubEdge(edge)): [expandedEdgeToRenderEdgeSubEdge(edges[i % edges.length])];

				const renderEdge = {
					source,
					parent,
					edges: subEdges,
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

		const allNodes = Object.values(edgeMap).map(item => item.nodes).flat();

		if (bundledEdges.length) {
			//We need to do edge combining.
			const colorDefinitionOrString = map.data.display.edgeCombiner.color;
			const colorDefinition = wrapStringAsColor(colorDefinitionOrString);
			const colors = edgeDefinitionHelper(allNodes, colorDefinition, [], bundledEdges.map(edge => packColor(edge.color)));
			const widthDefinition = {
				clip: map.data.display.edgeCombiner.width,
				low: 0
			};
			const widths = edgeDefinitionHelper(allNodes, widthDefinition, [], bundledEdges.map(edge => edge.width));
			const opacityDefinition = {
				clip: map.data.display.edgeCombiner.opacity,
				low: 0.0,
				high: 1.0 
			};
			const opacities = edgeDefinitionHelper(allNodes, opacityDefinition, [], bundledEdges.map(edge => edge.opacity));

			const [wrappedColors, wrappedWidths, wrappedOpacities] = wrapArrays(colors, widths, opacities);

			const collapsed = wrappedColors.length == 1;

			for (let i = 0; i < wrappedColors.length; i++) {
				const renderEdge = {
					source,
					parent,
					edges: collapsed ? bundledEdges.map(edge => edge.edges).flat() : bundledEdges[i % bundledEdges.length].edges,
					width: wrappedWidths[i % wrappedWidths.length],
					opacity: wrappedOpacities[i % wrappedOpacities.length],
					color: unpackColor(wrappedColors[i % wrappedColors.length]),
					bump: defaultBump,
				};
				resultsForRef.push(renderEdge);
			}
		}

		result.push(...spreadBumps(resultsForRef));
	}
	return result;
};

export class AdjacencyMapNode {
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

	get _scenarioNode() : ScenarioNode {
		return this._map.scenario.nodes[this.id] || emptyScenarioNode();
	}

	_computeValues() : NodeValues {
		const partialResult : NodeValues = {};
		const edgeByType : {[type : PropertyName] : EdgeValue[]} = {};
		for (const edge of this.edges) {
			if (!edgeByType[edge.type]) edgeByType[edge.type] = [];
			edgeByType[edge.type].push(edge);
		}
		const scenarioNodeValues = this._scenarioNode.values;
		//Iterate through edges in propertyNames order to make sure that any
		//ValueDefinitionResultValue will have the values they already rely on
		//calculated.
		for (const type of this._map.propertyNames) {
			//Fill in the partial result as we go so other things htat rely on
			//our root value can have it.
			partialResult[type] = this._map.rootValues[type];

			//Compute the default value
			const rawEdges = edgeByType[type] || [];
			const typeDefinition = this._map.data.properties[type];
			if (rawEdges.length  > 0 || typeDefinition.calculateWhen == 'always') {
				const edgeValueDefinition = typeDefinition.value;
				const constants = typeDefinition.constants || {};
				const defaultedEdges = rawEdges.map(edge => ({...constants, ...edge}));
				//TODO: should we make it illegal to have an edge of same type and ref on a node? 
				const refs = rawEdges.map(edge => this._map.node(edge.parent || '').values);
				const args = {
					edges: defaultedEdges,
					refs,
					partialResult,
					rootValue: this._map.rootValues,
					tags: this.tags,
					selfTags: this._data ? this._data.tags : {},
					definition: this._map.data
				};
				const values = calculateValue(edgeValueDefinition, args);
				if (values.length == 0) throw new Error('values was not at least of length 1');
				const finalCombiner = typeDefinition.combine ? COMBINERS[typeDefinition.combine] : DEFAULT_COMBINER;
				partialResult[type] = finalCombiner(values)[0];
			}

			//Override the default value with the nodes override (if applicable)
			if (this._data && this._data.values[type]) {
				const overrideArgs : ValueDefinitionCalculationArgs = {
					refs: [],
					edges: [],
					partialResult: {},
					rootValue: {},
					tags: this.tags,
					selfTags: this._data ? this._data.tags : {},
					definition: this._map.data,
					input: [partialResult[type]]
				};
				partialResult[type] = calculateValue(this._data.values[type], overrideArgs)[0];
			}

			//Finally, do the scenario overriding if applicable
			if (scenarioNodeValues[type]) {
				const scenarioArgs : ValueDefinitionCalculationArgs = {
					refs: [],
					edges: [],
					partialResult: {},
					rootValue: {},
					tags: this.tags,
					selfTags: this._data ? this._data.tags : {},
					definition: this._map.data,
					input: [partialResult[type]]
				};
				partialResult[type] = calculateValue(scenarioNodeValues[type], scenarioArgs)[0];
			}

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

	get groupID() : GroupID | undefined {
		return this._map.groupsDisabled ? undefined : this._data?.group;
	}

	get group() : AdjacencyMapGroup | null {
		if (this.groupID == undefined) return null;
		return this._map.group(this.groupID);
	}

	get _layoutID() : LayoutID {
		return LAYOUT_ID_NODE_PREFIX + ':' + this.id;
	}

	//The layout ID of the part of the layout that we are positioned within.
	get _rootLayoutID() : LayoutID {
		return this.group ? this.group._rootLayoutID : this._layoutID;
	}

	fullDescription(includeHidden = false) : string {
		const filter = includeHidden ? () => true : (entry : [PropertyName, number] ) => !this._map.data.properties[entry[0]].hide;
		let result = this.displayName + '\n';
		result +=  this.description + '\n\n';
		result += Object.entries(this.values).filter(filter).map(entry => entry[0] + ': ' + entry[1]).join('\n');
		const tags = Object.keys(this.tags);
		if (tags.length) {
			result += '\n\nTags:\n';
			result += tags.map(tag => this._map.data.tags[tag].displayName).join('\n');
		}
		return result;
	}

	//The base edges without any scenario modifications or extensions
	get baseEdges() : EdgeValue[] {
		return this?._data?.edges || [];
	}

	//The base edges with all scenario modifications applied but not expanded.
	get edgesWithFinalScenarioModifications() : EdgeValue[] {
		const [result] = edgesWithScenarioModifications(this.baseEdges, this._scenarioNode.edges);
		return result;
	}

	//The base edges with all scenario modifications applied but not expanded, skipping any removal steps.
	get edgesForUI() : [EdgeValue[], EdgeValueModificationMap] {
		return edgesWithScenarioModifications(this.baseEdges, this._scenarioNode.edges, true);
	}

	allowedMissingConstants(edge : EdgeValue) : {[name : ConstantType]: number} {
		const typeInfo = this._map.data.properties[edge.type];
		if (!typeInfo) return {};
		if (!typeInfo.constants) return {};
		const existingConstants = constantsForEdge(edge);
		return Object.fromEntries(Object.entries(typeInfo.constants).filter(entry => !(entry[0] in existingConstants)));
	}

	//parents that it is legal for us to have set.
	get legalParentIDs() : {[id : NodeID] : true} {
		const result : {[id : NodeID]: true} = {[ROOT_ID]: true};
		const graph = extractSimpleGraph(this._map.data, this._map.scenarioName);
		const currentNodeID = this._id;
		for (const nodeID of Object.keys(this._map.data.nodes)) {
			if (nodeID == currentNodeID) continue;
			const extendedGraph = {...graph, [currentNodeID]: {...graph[currentNodeID]}};
			extendedGraph[currentNodeID][nodeID] = true;
			try {
				topologicalSort(extendedGraph);
			} catch(err) {
				continue;
			}
			result[nodeID] = true;
		}
		return result;
	}

	//Returns a propertyName and the name of hte ID to add so if you use the
	//propertyName+ParentID then it would be a unique edge. Most of the time the
	//parentNodeID is just root, but technically it might not be. If a
	//propertyName is null then it is illegal and should be grayed out.
	get legalAdditionalPropertyNames() : {[name : PropertyName]: NodeID | null} {
		const occupiedNamesAndIDs : {[name : PropertyName]: {[id : NodeID] : true}} = {};
		for (const edge of this.edges) {
			if (!occupiedNamesAndIDs[edge.type]) occupiedNamesAndIDs[edge.type] = {};
			occupiedNamesAndIDs[edge.type][edge.parent] = true;
		}
		//Don't include parent IDs to check that would form a DAG.
		const allIDs = Object.keys(this.legalParentIDs);
		const result : {[name : PropertyName]: NodeID | null} = {};
		for (const propertyName of this._map.legalEdgePropertyNames) {
			const occupiedIDs = occupiedNamesAndIDs[propertyName] || {};
			for (const id of allIDs) {
				if (occupiedIDs[id]) continue;
				result[propertyName] = id;
				break;
			}
			if (result[propertyName] == undefined) result[propertyName] = null;
		}
		return result;
	}

	//All edges
	get edges() : ExpandedEdgeValue[] {
		if (!this._cachedEdges) {
			this._cachedEdges = completeEdgeSet(this.id, this._map.data, this.edgesWithFinalScenarioModifications);
		}
		return this._cachedEdges;
	}

	get renderEdges(): RenderEdgeValue[] {
		//Only top-level items should return renderEdges.
		if (this.group != undefined) return [];
		if (!this._cachedRenderEdges) {
			this._cachedRenderEdges = renderEdges(this._map, this._rootLayoutID, [this]);
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

	get hasChildren() : boolean {
		return this.children.length > 0;
	}

	//Tags includes all of the tags included in root, included in any nodes we
	//have an edge with .extendTags=true on, and any tags our node.data.tags
	//includes.
	get tags() : TagMap {
		//TODO: cache
		let tags = this._map.rootTags;
		const nodeIDsToExtendTagsFrom : {[nodeID : NodeID] : true} = {};
		for (const edge of this.edges) {
			if (this._map.data.properties[edge.type].extendTags) nodeIDsToExtendTagsFrom[edge.parent] = true;
		}
		for (const nodeID of Object.keys(nodeIDsToExtendTagsFrom)) {
			tags = {...tags, ...this._map.node(nodeID).tags};
		}
		if (this._data) {
			tags = {...tags, ...this._data.tags};
			//Remove any explicitly set to false
			tags = Object.fromEntries(Object.entries(tags).filter(entry => entry[1]));
		}
		return tags;
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
		const pos = this._map.nodePositions[this._rootLayoutID];
		if (!pos) throw new Error(this._rootLayoutID + ' didn\'t exist in parent');
		return pos.x;
	}

	get y() : number {
		const pos = this._map.nodePositions[this._rootLayoutID];
		if (!pos) throw new Error(this._rootLayoutID + ' didn\'t exist in parent');
		return pos.y;
	}

	_valueDefinitionHelper(definition : ValueDefinition) : number {
		const result = calculateValue(definition, {
			edges: this.edges,
			//TODO: this.parents omits expliti root references
			refs: this.parents.map(id => this._map.node(id).values),
			partialResult: this.values,
			rootValue: this._map.rootValues,
			tags: this.tags,
			selfTags: this._data ? this._data.tags : {},
			definition: this._map.data
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

	get strokeWidth() : number {
		//TODO: cache
		const definition = this._data?.display?.strokeWidth || this._map.data.display.node.strokeWidth;
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

	get strokeOpacity() : number {
		//TODO: cache
		const definition = this._data?.display?.strokeOpacity || this._map.data.display.node.strokeOpacity;
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

	get strokeColor() : Color {
		//TODO: cache
		const definitionOrString = this._data?.display?.strokeColor || this._map.data.display.node.strokeColor;
		const colorDefinition = wrapStringAsColor(definitionOrString);
		const num = this._valueDefinitionHelper(colorDefinition);
		return unpackColor(num);
	}
}

export class AdjacencyMapGroup {
	_map : AdjacencyMap;
	_data : GroupDefinition;
	_id : GroupID;
	_cachedDirectNodes : LayoutNode[];
	_cachedRenderEdges : RenderEdgeValue[];
	_cachedLayout : CircleLayoutInfo;

	constructor(map : AdjacencyMap, id : GroupID, data : GroupDefinition) {
		this._map = map;
		this._data = data;
		this._id = id;
	}

	get _layoutID() : LayoutID {
		return LAYOUT_ID_GROUP_PREFIX + ':' + this.id;
	}

	get _rootLayoutID() : LayoutID {
		return this.group ? this.group._rootLayoutID : this._layoutID;
	}

	get id() : GroupID {
		return this._id;
	}

	get data() : GroupDefinition {
		return this._data;
	}

	get hasNodes() : boolean {
		return this.nodes.length > 0;
	}

	get groupID() : GroupID | undefined {
		return this._data.group;
	}

	get group() : AdjacencyMapGroup | null {
		if (this.groupID == undefined) return null;
		return this._map.group(this.groupID);
	}

	//All nodes who are descendants of this group.
	get nodes() : AdjacencyMapNode[] {
		const result : AdjacencyMapNode[] = [];
		for (const layoutNode of this.directNodes) {
			if (layoutNode instanceof AdjacencyMapNode) {
				result.push(layoutNode);
				continue;
			}
			result.push(...layoutNode.nodes);
		}
		return result;
	}

	get inGroup() : boolean {
		return this.groupID != undefined;
	}

	//Only nodes whose direct parent is this group.
	get directNodes() : LayoutNode[] {
		if (!this._cachedDirectNodes) {
			const result : LayoutNode[] = [];
			for (const node of Object.values(this._map.nodes)) {
				if (node.groupID != this.id) continue;
				result.push(node);
			}
			for (const group of Object.values(this._map.groups)) {
				if (group.groupID != this.id) continue;
				result.push(group);
			}
			this._cachedDirectNodes = result;
		}
		return this._cachedDirectNodes;
	}

	get x() : number {
		if (this.group) {
			const pos = this.group.nodePositions[this._layoutID];
			if (!pos) throw new Error(this._layoutID + 'didn\'t exist in parent');
			return pos.x;
		}
		const pos = this._map.nodePositions[this._rootLayoutID];
		if (!pos) throw new Error(this._rootLayoutID + ' didn\'t exist in parent');
		return pos.x;
	}

	get y() : number {
		if (this.group) {
			const pos = this.group.nodePositions[this._layoutID];
			if (!pos) throw new Error(this._layoutID + 'didn\'t exist in parent');
			return pos.y;
		}
		const pos = this._map.nodePositions[this._rootLayoutID];
		if (!pos) throw new Error(this._rootLayoutID + ' didn\'t exist in parent');
		return pos.y;
	}

	get renderEdges() : RenderEdgeValue[] {
		//Only top-level items should return render edges
		if (this.inGroup) return [];
		if (!this._cachedRenderEdges) {
			this._cachedRenderEdges = renderEdges(this._map, this._rootLayoutID, this.nodes);
		}
		return this._cachedRenderEdges;
	}

	get hasChildren() : boolean {
		return this.nodes.some(node => node.hasChildren);
	}

	get displayName() : string {
		return this._data.displayName;
	}

	get description() : string {
		return this._data.description;
	}

	get tags() : TagMap {
		let result : TagMap = {};
		for (const node of this.directNodes) {
			result = {...result, ...node.tags};
		}
		return result;
	}

	get values() : NodeValues {
		const values : {[type : PropertyName]: number[]} = {};
		for (const node of this.directNodes) {
			for (const [key, value] of Object.entries(node.values)) {
				if (!values[key]) values[key] = [];
				values[key].push(value);
			}
		}
		return Object.fromEntries(Object.entries(values).map(entry => {
			const propertyDefinition = this._map.data.properties[entry[0]];
			//TODO: allow a different combiner to be specified.
			const finalCombiner = propertyDefinition.combine ? COMBINERS[propertyDefinition.combine] : DEFAULT_COMBINER;
			const [result] = finalCombiner(entry[1]);
			return [entry[0], result];
		}));
	}

	get nodePositions() : {[id : LayoutID]: {x : number, y : number}} {
		if (!this._cachedLayout) this._calculateLayout();
		return this._cachedLayout.children;
	}

	_calculateLayout() {
		const items : {[id : LayoutID] : number} = {};
		for (const node of this.directNodes) {
			items[node._layoutID] = node.radius;
		}
		this._cachedLayout = CirclePackLayout(items);
	}

	get radius() : number {
		if (!this._cachedLayout) this._calculateLayout();
		return this._cachedLayout.radius;
	}

	get strokeWidth() : number {
		const widths = this.directNodes.map(node => node.strokeWidth);
		const [result] = sum(widths);
		return result;
	}

	get opacity() : number {
		const opacities = this.directNodes.map(node => node.opacity);
		const [result] = mean(opacities);
		return result;
	}
	
	get strokeOpacity() : number {
		const opacities = this.directNodes.map(node => node.strokeOpacity);
		const [result] = mean(opacities);
		return result;
	}

	get color() : Color {
		const colorsAsNums = this.directNodes.map(node => packColor(node.color));
		const [result] = colorMean(colorsAsNums);
		return unpackColor(result);
	}

	get strokeColor() : Color {
		const colorsAsNums = this.directNodes.map(node => packColor(node.strokeColor));
		const [result] = colorMean(colorsAsNums);
		return unpackColor(result);
	}

	fullDescription(includeHidden = false) : string {
		const subDescriptions = this.directNodes.map(node => '\t' + node.fullDescription(includeHidden).split('\n').join('\n\t'));
		let result = this.displayName + '\n';
		result += this._data.description + '\n';
		result += 'Children:\n';
		result += subDescriptions.join('\n\n\n');
		return result;
	}
}