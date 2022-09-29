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
    type : 'edge',
    property: ConstantType
};

//Selects the value in the parents of this type
export type ValueDefinitionRefValue = {
    type: 'ref',
    property: EdgeType
}

//TODO: expand this a lot
export type ValueDefinition = number | number[] | ValueDefintionEdgeConstant | ValueDefinitionRefValue;

export type NodeID = string;

export type EdgeValue = {
    //Any of the exlicitly enumerated properties should be added to
    //RESERVED_VALUE_DEFINITION_PROPERTIES
    type: EdgeType,
    //If ref is not provided, it implicitly references the root node.
    ref? : NodeID,
    [constant : ConstantType]: undefined | number | EdgeType | NodeID;
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

export type TreeGraphWithDetails = {
    name: NodeID;
    description: string;
    values: NodeValues;
    children? : TreeGraphWithDetails[];
}

export type NodeDefinition = {
    description: string,
    values?: EdgeValue[]
};

export type NodeValuesMap = {
    [id : NodeID] : NodeValues
};

/**
 * The final computed values of all of the values for a node.
 */
export type NodeValues = {
    [type : EdgeType]: number
};

export type Reducer = (nums: number[]) => [number];

//We can't use keyof typeof REDUCERS because `npm run generate:schema` can't handle those types
export type ReducerType = 'mean' | 'first' | 'last' | 'min' | 'max' | 'sum' | 'product';

export type EdgeDefinition = {
    value: ValueDefinition,
    description?: string,
    //The intermediate values for ValueDefinition are all arrays of numbers, but
    //at the end they have to be reduced to a single number. A reducer is a
    //ValueDefinition that takes an array of numbers and provides an array with
    //a single number. This reducer will be used for that final reduction, to
    //produce the final number to use. If not provided, defaults to 'mean'
    reducer? : ReducerType,
    constants?: {
        [constant : ConstantType]: number
    }
}

export type JSONData = {
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
    data?: JSONData;
}

export type RootState = {
    app : AppState;
    data? : DataState;
}