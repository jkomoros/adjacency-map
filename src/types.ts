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

//TODO: expand this a lot
export type ValueDefinition = number;

export type NodeID = string;

export type EdgeValue = {
    type: EdgeType,
    ref? : NodeID,
    [constant : ConstantType]: number | EdgeType | NodeID;
};

export type JSONData = {
    version: number,
    types: {
        [type : EdgeType]: {
            value: ValueDefinition,
            [constant : ConstantType]: number
        }
    }
    root: {
        [type : EdgeType]: number
    },
    nodes: {
        [id : NodeID] : {
            description: string,
            values: EdgeValue[]
        }
    }
}

export type AppState = {
    page : string;
    pageExtra : string;
    offline : boolean;
};

export type DataState = {
    filename : Filename;
    data: unknown[];
}

export type RootState = {
    app : AppState;
    data? : DataState;
}