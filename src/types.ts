export { DataFilename } from './data.GENERATED.js';

import {
	DataFilename
} from './data.GENERATED.js';

export type RandomGenerator = () => number;

//A string that can be used directly anywhere CSS expects a color. Hex, RGB(),
//RGBA(), and named colors all work.
export type CSSColor = string;

//Packed colors are just a color that has been packed into an integer via
//color.packColor. It can be unpacked to a Color via unpackColor.
export type PackedColor = number;

export type RGBColor = [r : number, g : number, b : number];
export type RGBAColor = [r : number, g : number, b : number, a : number];

export type Color = {
	r : number;
	g : number;
	b : number;
	a : number;
	hex : CSSColor;
	rgb : RGBColor;
	rgba : RGBAColor;
	rgbStr : CSSColor;
	rgbaStr : CSSColor;
}

//TODO: tigthen this
export type PropertyName = string;

export type ConstantType = string;

//Selects a constant on this edge
export type ValueDefintionEdgeConstant = {
	constant: ConstantType
};

//Selects the value in the parents of this type
export type ValueDefinitionRefValue = {
	ref: PropertyName
}

//Selects the value in the root of this type
export type ValueDefinitionRootValue = {
	root: PropertyName
}

//Selects the value of other edges that go into our own result.
export type ValueDefinitionResultValue = {
	//Property must be explicitly enumerated in our EdgeDefinition.dependencies.
	result: PropertyName
}

//Takes the singular child definition and runs the reducer on it, returning an
//array of a single value.
export type ValueDefinitionCombine = {
	combine: CombinerType;
	value: ValueDefinition
}

//Takes a color constant to turn into a color for items that expect it. Note
//that a color is packed into an integer for use in the calculation engine; if
//the packed color is used in other calculations it might return weird results.
export type ValueDefinitionColor = {
	//Same signature as color() (but without importing color)
	color: CSSColor | RGBColor | RGBAColor
}

type ArithmeticOperatorBinary =  '+' | '*' | '-' | '/' | '&&' | '||';
type ArithmeticOperatorUnary = '!';

export type ArithmeticOperator = ArithmeticOperatorBinary | ArithmeticOperatorUnary;

export type ValueDefinitionArithmeticBinary = {
	operator:ArithmeticOperatorBinary,
	a: ValueDefinition,
	b: ValueDefinition
};

export type ValueDefinitionArithmeticUnary = {
	operator: ArithmeticOperatorUnary,
	a: ValueDefinition
}

//Takes two children, and adds or multiplies the left by the right and returns.
//The return value will have the same lenght as the first child. The numbers
//that will be multiplied are the same index; if the second argument is shorter
//than the first, then the index wraps around. If it is longer than the first,
//then only part of it is used. This behavior means that you can do a scalar
//multiplication by having a single-termed second child.
export type ValueDefinitionArithmetic = ValueDefinitionArithmeticBinary | ValueDefinitionArithmeticUnary;

export type CompareOperator = '==' | '!=' | '<' | '>' | '<=' | '>=';

/**
 * Takes two children and applies the comparison to them, returning
 * DEFAULT_TRUE_NUMBER or FALSE_NUMBER.
 */
export type ValueDefinitionCompare= {
	compare:CompareOperator,
	a: ValueDefinition,
	//TODO: rename this to whatever the second part of an arithmetic expression
	//is called.
	b: ValueDefinition
}

/**
 * For the test 'if', returns then if the value isTrue(), and else otherwise.
 */
export type ValueDefinitionIf = {
	if: ValueDefinition,
	then: ValueDefinition,
	else: ValueDefinition
}

/**
 * Reduces down and cuts out any indexes in value whose corresponding index in
 * filter is equivalent to false. If all items are filtered, the result is
 * [null] to retain the invariant that every result is at least one number.
 */
export type ValueDefinitionFilter = {
	filter: ValueDefinition,
	value: ValueDefinition,
	default?: ValueDefinition
}

//Clip returns a value like input, but where each number if it's lower than low,
//clips to low, and if it's higher than high clips to high. Either low or high
//may be omitted, but not both.
export type ValueDefinitionClip = {
	clip: ValueDefinition
	low: ValueDefinition,
	high?: ValueDefinition
} | {
	clip: ValueDefinition
	low?: ValueDefinition,
	high: ValueDefinition
}

//Range takes a number between low and high and returns the percentage of the
//way from low to high. (If low is higher than high, they are swapped). If the
//range input value is lower than low or higher than high it will be clipped to
//those.
export type ValueDefinitionRange = {
	//The input value
	range: ValueDefinition,
	low: ValueDefinition,
	high: ValueDefinition
}


//Percent takes a percentage (0.0 to 1.0) and returns (high - low) * percentage
//+ low. If percent is lower than 0 or higher than 1 it is clipped. If high is
//  lower than low, they are flipped.
export type ValueDefinitionPercent = {
	//The input value
	percent: ValueDefinition,
	low: ValueDefinition,
	high: ValueDefinition
}

//Collect takes 1 or more children and returns an array that is the
//concatenation of all of their valeus.
export type ValueDefinitionCollect = {
	collect: ValueDefinition[]
}

//LengthOf returns an array that is the length of refs or egdes, wrapping around
//value if necessary. This is useful if you want an array of constant values as
//long as edges, for example, but don't know any constants to fetch.
export type ValueDefinitionLengthOf = {
	lengthOf: 'refs' | 'edges' | 'input',
	value: ValueDefinition
}

//Input returns the input in this value calculation context, or [null] if this
//is a context where input was not provided. For example,
//map.display.edgeCombiner is a context where input is provided.
export type ValueDefinitionInput = 'input';

//Which tags to do the ValueDefintion for: all tags, only ones explicity added
//on this node, or only ones that come from previous nodes.
export type WhichTagSet = 'all' | 'self' | 'extended';

//Returns true if the result node has any of the defined tags.
export type ValueDefinitionHasTag = {
	//The tag to 
	has: TagID | TagID[] | TagMap
	//If true, only returns true if all of them are present. If false, then true
	//as long as any one is true.
	all?: boolean;
	//Which tags to collect, 'all', 'new', or 'extended'
	//If which is not provided, it defaults to 'all'
	which?: WhichTagSet
}

//Returns the given constant from each tag on result, or null if that constant
//doesn't exist on that tag. If the node has no tags, then the default value
//will be provided. If default is not set explicitly, it will return [0].
export type ValueDefinitionTagConstant = {
	tagConstant: TagConstantName
	default? : ValueDefinition
	//Which tags to collect, 'all', 'new', or 'extended'
	//If which is not provided, it defaults to 'all'
	which?: WhichTagSet
}

//The actual values are all numbers, but for convenience raw inputs can also
//literally be true or false, which are expanded to DEFAULT_TRUE_NUMBER and FALSE_NUMBER.
export type ValueDefinitionLeaf = number | boolean | null;

export type ValueDefinition = ValueDefinitionLeaf |
	ValueDefinitionLeaf[] |
	ValueDefintionEdgeConstant |
	ValueDefinitionRefValue |
	ValueDefinitionRootValue |
	ValueDefinitionResultValue |
	ValueDefinitionCombine |
	ValueDefinitionColor |
	ValueDefinitionArithmetic |
	ValueDefinitionIf |
	ValueDefinitionFilter |
	ValueDefinitionCompare |
	ValueDefinitionClip |
	ValueDefinitionRange |
	ValueDefinitionPercent |
	ValueDefinitionLengthOf |
	ValueDefinitionInput |
	ValueDefinitionCollect |
	ValueDefinitionHasTag |
	ValueDefinitionTagConstant;

//Different contexts that ValueDefinitions show up in allow different subsets of
//these types of proeprties.
export type AllowedValueDefinitionVariableTypes = {
	edgeConstant: boolean,
	refValue: boolean,
	rootValue: boolean,
	resultValue: boolean,
	input: boolean,
	hasTag: boolean,
	tagConstant: boolean
};

export type ValueDefinitionCalculationArgs = {
	//All of the edges that are being calculated together, all of the same type
	edges : EdgeValue[], 
	//An array of nodeValues, one per parent ref
	refs : NodeValues[], 
	//The results that are being calculated for this node. The only properties
	//that are guaranteed to be there and in their final state are ones that the
	//property enumerated in dependencies.
	partialResult : NodeValues, 
	//The values of root.
	rootValue : NodeValues,
	//The tags for the result node.
	tags: TagMap,
	//Tags explicitly on precisely self
	selfTags: TagMap,
	definition: MapDefinition,
	//The input numbers, which will be returned by ValueDefinitionInput, if this
	//is a context that does that.
	input? : number[]
};

export type ValudeDefinitionValidationArgs = {
	exampleValues : NodeValues, 
	data : MapDefinition, 
	allowedVariables: AllowedValueDefinitionVariableTypes, 
	propertyDefinition? : PropertyDefinition
};

export type LayoutInfo = {
	width: number,
	height: number,
	viewBox: [number, number, number, number],
	positions: {
		[id : NodeID]: {
			x : number,
			y : number
		}
	}
}

export type NodeID = string;

export type RawEdgeValue = {
	//Any of the exlicitly enumerated properties should be added to
	//RESERVED_VALUE_DEFINITION_PROPERTIES
	type: PropertyName,
	//If ref is not provided, it implicitly references the root node.
	ref? : NodeID,
	implies? : ImpliesConfiguration,
	[constant : ConstantType]: undefined | ValueDefinitionLeaf | PropertyName | NodeID | ImpliesConfiguration;
};

//Omit<> doesn't work for this because of the final index signature
type RawEdgeValueNoRef = {
	type: PropertyName,
	implies? : ImpliesConfiguration,
	[constant : ConstantType]: undefined | ValueDefinitionLeaf | PropertyName | NodeID | ImpliesConfiguration;
}

//Omit<> doesn't work for this because of the final index signature
type RawEdgeValueNoRefNoType = {
	implies? : ImpliesConfiguration,
	[constant : ConstantType]: undefined | ValueDefinitionLeaf | PropertyName | NodeID | ImpliesConfiguration;
}

export type RawEdgeTypeMap = {
	[propertyName : PropertyName]: RawEdgeValueNoRefNoType[] | RawEdgeValueNoRefNoType
};

export type RawEdgeMap = {
	[ref : NodeID]: RawEdgeValueNoRef[] | RawEdgeTypeMap;
};

export type EdgeValue = {
	//Any of the exlicitly enumerated properties should be added to
	//RESERVED_VALUE_DEFINITION_PROPERTIES
	type: PropertyName,
	//If ref is not provided, it implicitly references the root node.
	ref? : NodeID,
	implies? : ImpliesConfiguration,
	[constant : ConstantType]: undefined | number | PropertyName | NodeID | ImpliesConfiguration;
};

export type ExpandedEdgeValue = Exclude<EdgeValue,ImpliesConfiguration> & {
	//Source is the node that links to ref
	source: NodeID;
	//Ref is always filled, possibly with ROOT_ID
	ref: NodeID;
	implied: number;
};

//The final edges to actually render, based on processing the EdgeValues for a
//node.
export type RenderEdgeValue = {
	source: NodeID,
	ref: NodeID,
	width: number,
	opacity: number,
	color: Color,
	//A value from 0 to 1, where 0.5 is the normal bump
	bump: number
}

export type SimpleGraph = {
	[id : NodeID] : {
		[other : NodeID]: true
	}
}

//An array of child to singular parent
export type ParentGraph = {
	[id : NodeID] : NodeID
}

export type TreeGraph = {
	name : NodeID,
	children? : TreeGraph[];
}

export type RawNodeDefinition = {
	description: string,
	displayName? : string,
	display?: Partial<NodeDisplay>,
	tags? : TagID | TagID[] | TagMap,
	edges?: RawEdgeValue[] | RawEdgeMap,
	//If any values are provided here, they will be set on the node, overriding
	//any other edge values that or root values.
	values? : RawNodeValues,
};

export type NodeDefinition = {
	description: string,
	displayName?: string,
	tags: TagMap,
	display: Partial<NodeDisplay>,
	edges: EdgeValue[],
	values: NodeValues
};

export type RawNodeValues = {
	[type : PropertyName]: ValueDefinitionLeaf
};

/**
 * The final computed values of all of the values for a node.
 */
export type NodeValues = {
	[type : PropertyName]: number
};

export type Combiner = (nums: number[]) => [number];

//We can't use keyof typeof REDUCERS because `npm run generate:schema` can't handle those types
export type CombinerType = 'mean' | 'first' | 'last' | 'min' | 'max' | 'sum' | 'product' | 'and' | 'or' | 'color-mean';

//An enumeration of other property names to be implied. '*' means 'all property
//names'. An exclusion will be all property names EXCEPT the ones listed.
export type ImpliesConfiguration = PropertyName[] | {exclude: PropertyName[]} | '*' | '';

export type RawPropertyDefinition = {
	value: ValueDefinition,
	description?: string,
	//A message for how to use this property. Useful for libraries.
	usage?: string,
	//The intermediate values for ValueDefinition are all arrays of numbers, but
	//at the end they have to be reduced to a single number. A reducer is a
	//ValueDefinition that takes an array of numbers and provides an array with
	//a single number. This reducer will be used for that final reduction, to
	//produce the final number to use. If not provided, defaults to 'mean'
	combine? : CombinerType,
	//If present, then when edges of this type exist between a source and ref it
	//will imply that at least one edge of each other type should also exist...
	//using defaulted ones if necessary. Edges added by implication will not
	//have their implies executed if it exists.
	implies? : ImpliesConfiguration,
	//If true, then this property will never be implied as an edge (even with
	//'*' or {exclude:[]} on others) unless it is explicitly named.
	excludeFromDefaultImplication? : boolean,
	//Controls when the value definition is executed. If 'edges' then it will
	//only be run if at least one edge of that type exists on a node. If
	//'always', then no edges may be included for this type but its value
	//definition will be executed for every node. In addition, its value
	//definition must not rely on any edge values (e.g. {constant:'foo'} or
	//{ref: 'foo'}) and its implies property must be empty. If not provided,
	//defaults to 'edges'.
	calculateWhen?: 'edges' | 'always';
	//If true, then the source node will automatically inherit all of the tags
	//from all of the ref'd nodes.
	extendTags? : boolean,
	//Some properties (especially in libraries don't make sense to print out in e.g. AdjacencyMapNode.description)
	hide? : true,
	display? : Partial<EdgeDisplay>,
	constants?: {
		[constant : ConstantType]: ValueDefinitionLeaf
	}
}

export type PropertyDefinition = {
	value: ValueDefinition,
	description?: string,
	usage?: string,
	combine?: CombinerType,
	dependencies : PropertyName[],
	implies? : ImpliesConfiguration,
	excludeFromDefaultImplication : boolean,
	calculateWhen: 'edges' | 'always',
	extendTags: boolean,
	hide? : true,
	display: Partial<EdgeDisplay>,
	constants?: {
		[constant : ConstantType]: number
	}
}

export type LibraryType = 'core' | 'generation' | 'distinct-within-type' | 'distinct-across-type';

export type Library = {
	//Libraries can import other libraries
	import?: LibraryType[],
	display?: RawMapDisplay,
	//Types names should be `${libraryName}:${typeName}`
	properties: {
		[type : PropertyName]: RawPropertyDefinition
	},
	//Typically a library will provide default values for all of the types it
	//defines
	root: RawNodeValues
}

export type NodeDisplay = {
	//Values below 0.0 will be clipped to 0
	radius: ValueDefinition,
	//Values will be clipped to between 0 and 1
	opacity: ValueDefinition
	//Should return a color
	//As syntatic sugar, if the value is a string, it will be equivalent to {color: STRING}
	color: CSSColor | ValueDefinition,
	//Values below 0.0 will be clipped to 0
	strokeWidth: ValueDefinition,
	//Values will be clipped to between 0 and 1
	strokeOpacity: ValueDefinition,
	//Should return a color
	//As syntatic sugar, if the value is a string, it will be equivalent to {color: STRING}
	strokeColor: CSSColor | ValueDefinition
}

//If any of these returns more than one number, then the one that returns the
//most sets the number of edges to render for this edge type, and everything
//else will be looped to fill. Those same edges might later be distilled via
//edgeCombiner, though.
export type EdgeDisplay = {
	//The width of the stroke 
	width: ValueDefinition,
	//The color of the stroke
	//As syntatic sugar, if the value is a string, it will be equivalent to {color: STRING}
	color: CSSColor | ValueDefinition
	//The opacity of the stroke
	opacity: ValueDefinition
	//If truth-y, these edges will all render distinctly.
	distinct: ValueDefinition
}

//All of the ValueDefinition will receive as input the previous values for
//un-distinct edges of all types. You can check how many different edge types
//you are combining by checking lengthOf input. Because it's in an edge-free
//context, constants fetching won't work. If any of these emits more than one
//edge, then all of those edges will be rendered.
export type EdgeCombinerDisplay = {
	//The width of the stroke 
	width: ValueDefinition,
	//The color of the stroke
	//As syntatic sugar, if the value is a string, it will be equivalent to {color: STRING}
	color: CSSColor | ValueDefinition
	//The opacity of the stroke
	opacity: ValueDefinition
}

export type RawMapDisplay = {
	node?: Partial<NodeDisplay>,
	edge?: Partial<EdgeDisplay>,
	edgeCombiner? : Partial<EdgeCombinerDisplay>
};

export type MapDisplay = {
	node: NodeDisplay;
	edge: EdgeDisplay;
	edgeCombiner : EdgeCombinerDisplay;
}

export type TagID = string;

export type TagConstantName = string;

export type RawTagDefinition = {
	displayName? : string,
	description? : string,
	color? : CSSColor,
	//If true, will be included in map.rootTags()
	root?: boolean
	constants?: {
		[constantName : TagConstantName]: ValueDefinitionLeaf
	}
};

export type TagDefinition = {
	displayName : string,
	description: string,
	color : CSSColor,
	//If true, will be included in map.rootTags()
	root: boolean
	constants: {
		[constantName : TagConstantName]: number
	}
}

export type TagMap = {
	[id : TagID] : boolean
};

export type ScenarioName = string;

//A scenario is an overlay over the base configuration. Currnetly it may only
//override the base values of already existing nodes.
export type RawScenario = {
	description? : string,
	//A scenario may extend another by using its ID here, which means it will
	//overlay its definition. Cycles are not allowed.
	extends? : ScenarioName,
	//Scenarios may override root nodes by using id of ROOT_ID.
	nodes: {
		[id : NodeID] : {
			[propertyName: PropertyName]: ValueDefinition
		};
	};
}

export type Scenario = {
	description : string,
	nodes: {
		[id : NodeID] : {
			[propertyName : PropertyName]: ValueDefinition
		};
	}
}

export type RawScenariosDefinition = {
	[name : ScenarioName] : RawScenario;
};

export type ScenariosDefinition = {
	[name : ScenarioName] : Scenario;
};

export type RawMapDefinition = {
	description?: string;
	//Imports lists libraries to base types on. The library 'core' is implicitly
	//always imported.
	import?: LibraryType | LibraryType[],
	display?: RawMapDisplay,
	tags?: {
		[id : TagID]: RawTagDefinition,
	},
	properties?: {
		[type : PropertyName]: RawPropertyDefinition
	}
	root?: RawNodeValues;
	nodes?: {
		[id : NodeID] : RawNodeDefinition
	},
	//Scenarios define different collections of base values to set on nodes. The
	//default scenario is implicitly named '' and not enumerated, because it is
	//just the base map definition.
	scenarios?: RawScenariosDefinition,
}

//MapDefinition is RawMapDefinition, but with any imports expanded.
export type MapDefinition = {
	description: string,
	properties: {
		[type : PropertyName]: PropertyDefinition
	}
	tags: {
		[id : TagID]: TagDefinition
	}
	display: MapDisplay,
	root: NodeValues,
	nodes: {
		[id : NodeID]: NodeDefinition
	},
	scenarios: ScenariosDefinition;
};

export type URLHashArgs = {
	s? : ScenarioName
};

export type AppState = {
	page : string;
	pageExtra : string;
	offline : boolean;
	hash: string;
};

export type DataState = {
	filename : DataFilename;
	scale: number;
	scenarioName : ScenarioName;
	hoveredNodeID? : NodeID;
	selectedNodeID? : NodeID;
}

export type RootState = {
	app : AppState;
	data? : DataState;
}