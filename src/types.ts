export type RandomGenerator = () => number;

//A string that can be used directly anywhere CSS expects a color. Hex, RGB(),
//RGBA(), and named colors all work.
export type CSSColor = string;

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

export type Filename = string;

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
    child: ValueDefinition
}

type ArithmeticOperatorBinary =  '+' | '*' | '-' | '/' | '&&' | '||';
type ArithmeticOperatorUnary = '!';

export type ArithmeticOperator = ArithmeticOperatorBinary | ArithmeticOperatorUnary;

export type ValueDefinitionArithmeticBinary = {
    operator:ArithmeticOperatorBinary,
    child: ValueDefinition,
    //TODO: rename this to whatever the second part of an arithmetic expression
    //is called.
    term: ValueDefinition
};

export type ValueDefinitionArithmeticUnary = {
    operator: ArithmeticOperatorUnary,
    child: ValueDefinition
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
    child: ValueDefinition,
    //TODO: rename this to whatever the second part of an arithmetic expression
    //is called.
    term: ValueDefinition
}

/**
 * For the test 'if', returns then if the value isTrue(), and else otherwise.
 */
export type ValueDefinitionIf = {
    if: ValueDefinition,
    then: ValueDefinition,
    else: ValueDefinition
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

//The actual values are all numbers, but for convenience raw inputs can also
//literally be true or false, which are expanded to DEFAULT_TRUE_NUMBER and FALSE_NUMBER.
export type ValueDefinitionLeaf = number | boolean;

export type ValueDefinition = ValueDefinitionLeaf |
    ValueDefinitionLeaf[] |
    ValueDefintionEdgeConstant |
    ValueDefinitionRefValue |
    ValueDefinitionRootValue |
    ValueDefinitionResultValue |
    ValueDefinitionCombine |
    ValueDefinitionArithmetic |
    ValueDefinitionIf |
    ValueDefinitionCompare |
    ValueDefinitionClip |
    ValueDefinitionRange |
    ValueDefinitionPercent;

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

export type EdgeValue = {
    //Any of the exlicitly enumerated properties should be added to
    //RESERVED_VALUE_DEFINITION_PROPERTIES
    type: PropertyName,
    //If ref is not provided, it implicitly references the root node.
    ref? : NodeID,
    [constant : ConstantType]: undefined | number | PropertyName | NodeID;
};

export type ExpandedEdgeValue = EdgeValue & {
    //Source is the node that links to ref
    source: NodeID;
    //Ref is always filled, possibly with ROOT_ID
    ref: NodeID;
};

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

export type NodeDefinition = {
    description: string,
    values?: EdgeValue[]
};

/**
 * The final computed values of all of the values for a node.
 */
export type NodeValues = {
    [type : PropertyName]: number
};

export type Combiner = (nums: number[]) => [number];

//We can't use keyof typeof REDUCERS because `npm run generate:schema` can't handle those types
export type CombinerType = 'mean' | 'first' | 'last' | 'min' | 'max' | 'sum' | 'product' | 'and' | 'or';

export type PropertyDefinition = {
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
    //If provided, these are the enumerated set of other edges that this edge's
    //value can rely on. Note that they may not form a cycle. Only items
    //enumerated here may be used in this edge's ValueDefinition when it is of
    //type ValueDefintiionResultValue.
    dependencies? : PropertyName[],
    //Some properties (especially in libraries don't make sense to print out in e.g. AdjacencyMapNode.description)
    hide? : true,
    constants?: {
        [constant : ConstantType]: number
    }
}

export type LibraryType = 'core';

export type Library = {
    //Libraries can import other libraries
    import?: LibraryType[],
    //Types names should be `${libraryName}:${typeName}`
    properties: {
        [type : PropertyName]: PropertyDefinition
    },
    //Typically a library will provide default values for all of the types it
    //defines
    root: NodeValues
}

export type RawMapDefinition = {
    version: number,
    //Imports lists libraries to base types on. The library 'core' is implicitly
    //always imported.
    import?: LibraryType | LibraryType[],
    properties?: {
        [type : PropertyName]: PropertyDefinition
    }
    root?: NodeValues;
    nodes: {
        [id : NodeID] : NodeDefinition
    }
}

//MapDefinition is RawMapDefinition, but with any imports expanded.
export type MapDefinition = Required<Omit<RawMapDefinition, "import">> & {
    //have a flag variable so MapDefinition is not just a subset of
    //RawMapDefinition and typescript will complain if the wrong one is passed.
    processed: true
};

export type AppState = {
    page : string;
    pageExtra : string;
    offline : boolean;
};

export type DataState = {
    filename : Filename;
    data?: RawMapDefinition;
}

export type RootState = {
    app : AppState;
    data? : DataState;
}