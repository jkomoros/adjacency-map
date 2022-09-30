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
export type EdgeType = string;

export type ConstantType = string;

//Selects a constant on this edge
export type ValueDefintionEdgeConstant = {
    constant: ConstantType
};

//Selects the value in the parents of this type
export type ValueDefinitionRefValue = {
    ref: EdgeType
}

//Selects the value of other edges that go into our own result.
export type ValueDefinitionResultValue = {
    //Property must be explicitly enumerated in our EdgeDefinition.dependencies.
    result: EdgeType
}

//Takes the singular child definition and runs the reducer on it, returning an
//array of a single value.
export type ValueDefinitionCombine = {
    combine: CombinerType;
    child: ValueDefinition
}

export type ArithmeticOperator =  '+' | '*' | '-' | '/';

//Takes two children, and adds or multiplies the left by the right and returns.
//The return value will have the same lenght as the first child. The numbers
//that will be multiplied are the same index; if the second argument is shorter
//than the first, then the index wraps around. If it is longer than the first,
//then only part of it is used. This behavior means that you can do a scalar
//multiplication by having a single-termed second child.
export type ValueDefinitionArithmetic = {
    operator:ArithmeticOperator,
    child: ValueDefinition,
    //TODO: rename this to whatever the second part of an arithmetic expression
    //is called.
    term: ValueDefinition
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

export type ValueDefinition = number | number[] | ValueDefintionEdgeConstant | ValueDefinitionRefValue | ValueDefinitionResultValue | ValueDefinitionCombine | ValueDefinitionArithmetic | ValueDefinitionClip;

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
    type: EdgeType,
    //If ref is not provided, it implicitly references the root node.
    ref? : NodeID,
    [constant : ConstantType]: undefined | number | EdgeType | NodeID;
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
    [type : EdgeType]: number
};

export type Combiner = (nums: number[]) => [number];

//We can't use keyof typeof REDUCERS because `npm run generate:schema` can't handle those types
export type CombinerType = 'mean' | 'first' | 'last' | 'min' | 'max' | 'sum' | 'product';

export type EdgeDefinition = {
    value: ValueDefinition,
    description?: string,
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
    dependencies? : EdgeType[],
    constants?: {
        [constant : ConstantType]: number
    }
}

export type MapDefinition = {
    version: number,
    types: {
        [type : EdgeType]: EdgeDefinition
    }
    root?: NodeValues;
    nodes: {
        [id : NodeID] : NodeDefinition
    }
}

export type AppState = {
    page : string;
    pageExtra : string;
    offline : boolean;
};

export type DataState = {
    filename : Filename;
    data?: MapDefinition;
}

export type RootState = {
    app : AppState;
    data? : DataState;
}