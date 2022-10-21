# Adjaceny Map

Adjacency map is a tool to make it easy to create "adjacency maps" that show how different use cases or outcomes are related to other, previously done work.

It contains a powerful caluclation and configuration engine.

![demo](/examples/demo.png?raw=true)

Check out the live demo at https://adjacency-map-demo.web.app/

Check out the configuration that produces the default example at [data/default.ts](https://github.com/jkomoros/adjacency-map/blob/main/data/default.ts)

## Installing

Install npm.

Check out this repo.

Run `npm install` to install dependencies.

## Running

Run `npm run start` from command line.

Visit http://localhost:8081

Arrow keys left or right to move forward or backward between 'scenarios' if any are defined.

The main config that will be loaded up is `data/default.ts`. You can also create additional config files in that directory, and load them by changing the `default` in the URL to be the filename of the file you want to load.

## Deploying

If you want to deploy to firebase hosting, set up a firebase project. Then run `firebase use <PROJECT-ID>`.

Now, you can deploy whenever you want to:

`npm run deploy`

Your web app will now be available at `https://<PROJECT-ID>.web.app/`

## Creating a new map

The files in  `data/` are the files that will be available to view in the webapp. If more than one file exists, then a drop-down select will show in the UI.

To create a new one, copy `stub.SAMPLE.ts` to a new filename that omits `SAMPLE`. Then run `npm run generate:config`, which will write the glue code to import that new diagram into the webapp. Now you can just edit the data file and refresh the web app to see it. VSCode will give lots of auto-complete help about what kinds of configuration is legal. You can also see `src/types.ts:RawMapDefinition` to get a sense of the format of configuration that is accepted.

# The Model 

## Understanding the fundamental model

The basic model of a diagram is composed of three things:
1) A set of **properties** defining the numerical values to be calculated for each node, and how they are calculated.
2) A set of **nodes** that define the primary output of the diagram, where each node will have one value for each property calculated. Each edge is affiliated with one property type. Nodes can explicitly set the values for each property, but more typically they define edges to implicitly describe their final values.
3) A set of **edges** for each node, that are of a specific propery type and rely on other nodes, which, combined with the property's definition for how its value should be calculated, lead to the final output value for the node.

There are other concepts, but they all build on or complicate this basic model.

There is one special **root** node, with ID of '', that sets default values for the main model and that has no edges to other nodes.

The final value for each property for each node is calulated by: 
1) Taking the values of the **root** node as the default values
2) Implicitly calculating the final value for each property type by aggregating all of the edges of that property that terminate in this node, and then passing those edges to the calculation expression definined on that property's `value` property. This set is skipped if calculateWhen is `edge` and there are no edges of that type.
3) Overlaying any specific node value overrides defined in map.nodes.NODEID.values, overriding the earlier value set via the normal process. This override may be a ValueDefinition, and it will be passed an input of the previous result in the pipeline to modify if it chooses.
4) Overlaying any overrides specific to this node specific to the active scenario. This ValueDefinition is passed the previous value in the pipeline as input, allowing modifying the previous value in the pipeline.
5) Using the configuration defined in the various `display` properties on the map itself, each property type, and each node to determine color, opacity, width, etc of nodes and edges to display.

Most of the properties of `RawMapDefinition` will be described below. It also has `description`, an optional string property that will be shown in the UI to describe the overall model.

## Properties

The list of properites defines the set of values for each node that will be calculated. They are explicitly enumerated in `map.properties`. Any `node.values` definition or `scenario.NODENAME.values` definition or `edge.type` that is defined must be one of these enumerated properties or the configuration won't validate.

You can also import other property definitions from Libraries using the `import` statement, see the Libraries section below.

This confniguration would define two properties, named 'one' and 'two', meaning that `node.values` could contain keys of `one` and `two`.
```
const data : RawMapDefinition = {
  //...
  properties: {
    one: {
        //...
    },
    two: {
        //...
    }
  }
  //...
};
```

Here's the meaning of each field of a property definition:

### description : string
A description of what the property represents in the model. The description doesn't actually show up in the rendered output currently.

### usage? : string
An optional string defining how the property should be used. This is most useful for libraries so their users know how to use the property. The usage string doesn't show up in the rendereed output currently.

### constants : {[constant : ConstantType]: ValueDefinitionLeaf}

Each edge can define a legal set of constants that are allowed to be present on edges of this type, and referenced in our value calculation.

Listing them in this constant dictionary defines their default value if a given edge of this type doesn't include an explicit value for them.

```
constants: {
    //Numbers are the main kind of constant
    weight: 10,
    //true / false may also be used
    strong: true
    //null may also be used, and is often used as a kind of sentinel for detecting when an edge doesn't explcitly define a constant
    included: null
}
```

### value : ValueDefinition

This is the primary meat of the property definition; it defines the value to calculate for a node's value of this property when a value hasn't been set explicitly in `node.values`.

The value definition is passed the set of edges to all nodes of the type of this property. The final node value is run through `combiner` (see below) to reduce an array down to a single number. Here are a few examples of types of value definitions that are legal:

```
//If there is at least one edge to another node, the final value of this property for that node is `3`
value: 3

//Extract `property_name` value from the node that is referred to by each edge. `property_name` can be this property itself... or any other legal property name.
value: {
    ref: 'property_name',
}

//Extract the constants of the given name from each edge of this property type. (See `constants`, above).
value: {
    constant: 'weight'
}

//Add to the parent node's value of type `property_name` the constant defined in each edge's weight.
value: {
    operator: '+',
    a: {
        ref: 'property_name',
    },
    b: {
        constant: 'weight'
    }
}
```

See more about ValueDefinitions in the Value Definition section below.

The value calculation is the same for every calculation of that property type on any node, although the final value may vary widely based on different parent values it relies on, different constants, etc.

### combine? : CombinerType

The final value for a node has to reduce a potentially multi-entry array of numbers (e.g. if there are multiple edges of this type) down to a single number. This combiner will be run on the final result, reducing it to a single number. Any `CombinerType` is allowed; if not included, it defaults to `mean`.

### calculateWhen? : 'edges' | 'always'

Many values rely on there being edges to do their calculation (calculateWhen of 'edges'). Some values rely only on other properties in values, or are just constants. If calculateWhen is 'always', then this value will be calcluated on a node even if there are no edges (explicit or implied) to this node.

If calculateWhen is 'always': 
- the value must not include any `{constant: 'foo'}` or `{ref: 'foo'}` ValueDefinitions nested. 
- `implies` must be unset or set to ''.
- `excludeFromDefaultImplication` is automatically set to true.

### extendTags? : boolean

If true, then the source node's base tag set will include any tags on the ref node. This allows tags to 'flow' through a graph additively.

### display? : EdgeDisplay

Defines how to display this edge by default. See the `display` section below for how these configurations work.

### implies? : ImpliesConfiguration

A value of a given node will only have an interesting (non-root default) value set if there is at least one edge of that type incoming.

Often you want values to 'flow' through nodes at long as there is any edge from one to the other, of any type. implies is machinery that allows the precense of one edge type from a ref/result node pair to imply other edges (with their constants all set to the default) as well.

This is where an edge can define a default implication of other edges whenever it shows up. Read more at 'Implied edges', below.

If calculateWhen != 'edges', then implies must be empty.

### excludeFromDefaultImplication? : boolean

A common value for `implies` is `*`, which means "include all other nodes". However, some edges really only want to be inclued if they are explicitly added. This allows a property type to opt out of being implied via `*`, unless they are specifically implied by another node.

If calculeWhen != 'edges', then excludeFromDefaultImplication is automatically set to true.

### hide? : true

Some edges, especially in libraries, are for internals and don't want to be shown in final rendered output to users. This allows those edges to define they are internal and shouldn't be shown by default to end users.

## Nodes

Nodes define the named points whose final values is the entire point of the framework. 

Edges may only refer to nodes that are defined in the nodes block:

```
const data : RawMapDefinition = {
    //...
    nodes: {
        a: {
            //...
        },
        b: {
            //...
        }
    }
    //...
}
```

The ID of each node is its name in the nodes map.

The final values of each node is *primarily* defined by the edges that it has, and how each of those edge's property types configures how the value shoudl be calculated.

### description : string

A description of what this node represents, for displaying in tooltips in the UI.

### displayName? : string

Sometimes the ID of the node is ugly (e.g. uses underscores). If the displayName is set, that will be used for rendering it in the UI instead of the ID.

### display? : NodeDisplay

Configures how this particular node will be displayed. See 'Display' section below for more on configuring display.

### edges : RawEdgeValue[] | RawEdgeMap

The primary meat of the engine, these are the edges who will be included in the value calculation of this node. See the 'Edges' section below for much more on how these are defined.

### values? : RawNodeValues

The final values of a node are primarily driven by the edges they include and the defined value calculation for those edge types. However, sometimes you want to just override and explicitly set values on a given node.

```
values: {
    //The primary output is numbers, but you can also use true/false/null
    one: true
    //The override may be a ValueDefinition. It will be passed an input of the previous value in the pipeline, which can be modified.
    two: {
        operator: '+',
        a: 'input',
        b: 5.0
    }
    //property names not enumerated will be calculated as usual.
}
```

Scenarios also effectively set these values properties for nodes in different scenarios.

### The root node

Every map includes one special `root` node, whose id is ''. This node is implied, and may not be listed in your `nodes` definition. It has no inbound edges, but it may set specific default values for any property. (Properties that are not enumerated are set to 0 on the root).

The root node can have its values overriden in the `root` property of the map:
```
const data : RawMapDefinition = {
    //...
    root: {
        one: 3
        //Unenumerated properties are implicitly set to 0.
    }
    //...
}
```

The `root` property is essentially the `values` property of the implied node named '' in the nodes map.

Edges that do not explicitly name a `ref` implicitly reference the root node.

The default values for each node starts out as the values in root, with each value potentially be overriden by the node's own `values` property, or incoming edges of a given type.

## Edges

Edges are the most important part of configuration; they define which nodes rely on which other nodes. Edges are defined on nodes, in the `edges` property.

Each edge notionally has the following properties:
```
//The type is the property type this edge represents, which tells the engine which ValueDefinition to execute.
type: PropertyName,
//source is never set explicitly, but implied by the node whose edge definition the edge shows up in
source: NodeID
//if ref is omitted it will implicitly be the root node, with id of ''
ref?: NodeID,
//A way for a given edge to override the implies property of its property type, see 'Implied Edges', below
implies?: ImpliesConfiguration
//If an edge was implied into existence, it will have implied: true. Effectively a special constant. You may not explicitly define a value for implied in your configuration; it is set automaticlaly by the engine.
implied: true | false
//Edges may also explicitly set any values for constants they defined on their PropertyDefinition for that type, to be available in the value calculation. Constants defined on that property type but  not explicitly included will default to the value in the PropertyDefinition.
weight: 5
```

The simplest way to define edges is to have `node.edges` enumerate a list of them:
```
edges: [
    {
        //type is required in this form
        type: 'one'
        //A ref that is omitted implies the root node, of name ''
        ref: 'b',
        weight: 3
    },
    {
        //ref, source, and any constants just get their default values.
        type: 'two'
    }
]
```

However, sometimes you have multiple edges to a given ref, and want to make it faster to manually configure them. You can also provide a map of nodeIDs to edges. Each edge in that list will then implicitly have its `ref` property set.

```
edges: {
    //You may explicitly name the root nodeID here.
    '' : [
        {
            //Ref is implicitly ''
            type: 'one'
        }
    ],
    a: [
        {
            //Ref is implicitly 'a'
            type: 'two'
        }
    ]
}
```

But sometimes you want to have multiple edges from a given node, of a given type. If you use a nodeID map, you can also have the values be a map of propertyType to edges:

```
edges: {
    '': {
        one: [
            //Ref is '', type is 'one'
            {},
            {weight: 2}
        ],
        two: [
            //Ref is '', type is 'two'
            {weight: 5}
        ]
    },
    //You can use the typeID map for one node, and the array type for other nodes.
    a: [
        {
            //Ref is implicitly 'a'
            type: 'two'
        }
    ]
}
```

Finally, sometimes in that form, you only have edge to imply, so you can skip wrapping them in an array if you have only one:

```
edges: {
    '': {
        one: [
            //Ref is '', type is 'one'
            {},
            {weight: 2}
        ],
        //Ref is '', type is 'two'. Only one edge, so skip the containing []
        two: {weight: 5}
    },
    //You can use the typeID map for one node, and the array type for other nodes.
    a: [
        {
            //Ref is implicitly 'a'
            type: 'two'
        }
    ]
}
```

### Implied edges

Typically edges are explicitly listed for each source/ref/type combination of nodes and type. However, sometimes you want the precense of one property type between a source/ref node pair to imply into existence other values, so those other property's value calculation can rely on that ref, too.

This where edge implication comes in. A given node can define an `ImplicationConfiguration`. A given PropertyDefinition can also define an implies configuration, which implicitly extends to all edges of that type.

An `ImplicationConfiguration` defines the set of other property names to imply into existence. The default form is simply a list of other property names:
```
implies: [one, two]
```

When the engine sees an `implies` configuration, it looks at all of the edges explicitly enumerated for a given source/ref node pair. If there are any edge types that are implied in the union of all explicit edges' `implies` property but not explicitly included then an edge is implied into existence for that source/ref/type. It will use the default values for constants, and also have `edge.implied` set to true.

There are a few other ways to define implications.

One is a value of `*`, which means, "imply all edge types that don't explicitly opt out via `excludeFromDefaultImplication`". This is useful in libraries and other contexts where the full set of property types isn't known.

Finally, there is a type that allows you to *exclude* specific implications: `{exclude: [one]}`, which would be equivalent to including all edges in the implication set and then removing that type. Remember that the full set of edges to imply between a source/ref pair is the *union* of all `implies` property.

## Value Definitions

ValueDefinitions are the way a given `property.value` is configured. They are expressions that may nest arbitrarily and can be calculated.

They are also used in a lot of the `display` contexts (see 'Display', below).

### Array calculation

On a fundamental level, ValueDefinitions produce an array of at least one number as their result, based on their configuration.

This is necessary because in many contexts there are multiple numbers to operate over, for example if there are multiple edges of a given property type on a node, which means that any ValueDefinition that references those ref parents or constants of a given type on edges will receive multiple inputs.

The simplest ValueDefinition is an array of numbers:
```
value: [0, 1, 2]
```

Its common to have an array with only one item, in which case as syntactic sugar it may be provided as just one number:
```
//Equivalent to [0]
value: 0
```

ValueDefinitions also sometimes nest other ValueDefinitions inside of them, and those also return arrays of numbers with at least one item.

```
{
    compare: '==',
    a: [0, 1, 2],
    b: [0, 1, 3]
}
//Produces [1, 1, 0]
```

In general, all ValueDefinitions handle arrays by doing their specific operation on each array item in sequence. Often if there are multiple arguments, then it operates on the item of each at each index in turn. If any array is longer than another, then only part of its values are used. If it's too short, then its indexing wraps around to the beginning when it falls off the edge. Here are a few examples:

```
{
    operator: '+',
    a: [0, 1, 2],
    b: [1, 2, 3]
}
//Produces [1, 3, 5]

{
    operator: '+',
    a: [0, 1, 2],
    b: [1, 2]
}
//Produces [1, 3, 3]. b is effectively [1, 2, 1].

{
    operator: '+',
    a: [0, 1, 2],
    b: 1
}
//Produces [1, 2, 3], because be is effectively [1, 1, 1]
```

In practice, you typically don't have to think too hard about arrays because the right thing happens. ValueDefinition documentation doesn't mention anything about wrapping around values if necessary, because it's implied. Although which of the arguments provides the length of its output is often described.

### True, false, and null

All ValueDefinitions implicitly operate over an array of numbers.

However, in your inputs you can also use `true`, `false`, and `null` values, which expand to specific sentinel numeric values for purposes of comparison:

```
//Any value that is not zero is considered truthy
true: 1,
false: 0,
null: <a specific, very rare number>
```

### Combiner

One important type of ValueDefinition is ValueDefintionCombine.

This ValueDefinition takes a CombineType (see below) and an input, and then combines all of the numbers into an array with a single number as output.

It's special because Property.combine can be defined to be any valid CombineType as the final step to reduce the ValueDefinition for value (which might have more than one number) into an array with precisely one number.

### Color

Colors are also represented as numbers within valueDefintion. Different ValueDefinitions produce or consume numbers that are interpeted as colors. Under the covers the RGBA components are packed into an integer, and unpacked into a `color` when processed. You don't need to know much about this, other than that if you use a color in another context, you might see it have odd number values.

### Value Definition Reference

This section describes each ValueDefintion type.

#### ValueDefinitionLeaf

A ValueDefinititionLeaf is a number, true, false, or null.

true, false, and null all expand to specific sentinel numeric values as described above.

Technically this is semantic sugar over ValueDefinitionLeaf[], which is the fundamental type.

```
value: 3
//Evaluates to [3]
value: true
//Evaluates to [1]
value: false
//Evalutes to [0]
value: null
//Evalutes to [NULL_SENTINEL_NUMBER]
```

#### ValueDefinitionLeaf[]

A ValueDefinitionLeaf[], which expands to number[], is the fundamental type.

```
value: [3, true, false, null]
//Evaluates to [3, 1, 0, NULL_SENTINEL_NUMBER]
```

#### ValueDefintionEdgeConstant

Selects a specific named constant from a given edge type. It extracts the named constant for each of the edges provided in this context.

This is only valid in contexts that provide a set of edges (e.g. `property.value`, which provides a set of edges to different refs all of one property type). Unknown constant names will throw an error.

```
//Default for one is '3'
edges: [
    {
        type: 'one',
        //Will implicitly use default value for this node type
    },
    {
        type: 'one',
        weight: 5
    }
]
value: {
    constant: 'weight'
}
//Evalues to, for example, [3, 5]
```

#### ValueDefinitionRefValue

Selects a final computed value out of the parent node for an edge (the 'ref'). Only defined PropertyNames may be used. Selects one number per node referenced.

If the ValueDefinition is in the context of a PropertyDefinition.value, then a PropertyName of '.' will automatically be replaced with the PropertyName being defined.

```
nodes: {
    a: {
        values: {
            one: 3
        }
    },
    b: {
        values: {
            one: 5
        }
    }

}
edges: [
    {
        type: 'one',
        ref: 'a'
    },
    {
        type: 'one',
        ref: 'b'
    }
]
value: {
    //Selects the property named 'one' for each node with an edge of this property type
    ref: 'one'
}
//Evalutes to [3, 5]
```

#### ValueDefinitionRootValue

Selects the value from the root node. Useful for having defaults for a given property. Only defined PropertyNames may be used. Returns an array of a single number, since there's only one root.

If the ValueDefinition is in the context of a PropertyDefinition.value, then a PropertyName of '.' will automatically be replaced with the PropertyName being defined.

```
root: {
    one: 3
}
value: {
    root: 'one'
}
//Evalutes to [3]
```

#### ValueDefinitionResultValue

Selects the named value from the node we are currently calculating. This allows properties to rely on the final values of other properties. That means that those other properties have to have their values calculated before this property is calculated. Properties may not have circular references to themselves directly or indirectly.

```
value: {
    result: 'two'
}
//Evalutes to, for example, [3]
```

#### ValueDefinitionCombine

Reduces an array of possibly many numbers down to an array with a single number, based on the combiner selected.

input may be any other ValueDefinition.

```
value: {
    combine: 'sum',
    input: [0, 1, 2]
}
//Evaluates to [3]
value: {
    combine: 'sum',
    input: {
        ref: 'one'
    }
}
```

Legal values for combine: 
- `mean` - The average of all numbers
- `first` - The first in the list of numbers
- `last` - The last in the list of numbers
- `min` - The smallest in the list of numbers
- `max` - The largest in the list of numbers
- `sum` - The sum of all numbers
- `product` - The product of all numbers
- `and` - true if the list of all numbers are not false
- `or` - true if any in the list of numbers is not false`
- `color-mean` - interprets each input as a color, and returns the average color by averaging each component of RGBA separately for each color

#### ValueDefinitionColor

Returns a color. As described above, colors are packed into integers, and different ValueDefinitions or contexts know to unpack the color into a `color` with r, g, b, and a components.

```
//All examples evaluate to '#FF0000FF';
value: {
    //May be any CSS named color
    color: 'red'
}
value: {
    color: '#FF0000'
}
value: {
    color: '#FF0000FF'
}
value: {
    color: 'rgb(255, 0, 0)'
}
value: {
    color: 'rgba(255, 0, 0, 1.0)'
}
```

#### ValueDefinitionGradient

Takes two colors, `a` and `b` and returns a new color that is `gradient` percentage between `a` and `b`.

`a`, `b`, and `gradient` may all be arrays, and all be ValueDefinitions. The final result will have the same length as a.

```
value: {
    gradient: 0.5,
    a: {color: 'red'},
    b: {color: 'blue'}
}
```

#### ValueDefinitionArithmetic

Calculates an arithemtic result of `a` OP `b`.

The resulting array of numbers will have the same length as `a`.

`a` and `b` may be any other ValueDefinition.

Valid operators are   '+' | '*' | '-' | '/' | '&&' | '||' and '!'. `b` is ignored if the operator is '!'. '&&', '||', and '!' treat any value that is not 0 as true.

```
{
    operator: '+',
    a: [0, 1, 2],
    //Effectively [0, 1, 0] to bring it to the same size as a.
    b: [0, 1]
}
//Evaluates to [0, 2, 2]
```

#### ValueDefinitionIf

Returns `then` or `else` argument depending on value of `if`. The numbers in `if` are considered false if 0, true otherwise.

`if`, `then`, and `else` may all be any other ValueDefinition.

```
value: {
    if: [0, 1, 0],
    //Effectively [2, 3, 2] to bring it to the length of if.
    then: [2, 3],
    else: [5, 4, 3]
}
//Evaluates to [5, 3, 3]
```

#### ValueDefinitionFilter

Returns a new array where the only numbers of `input` are included if the corresponding index of `filter` are truthy.

If all numbers are filtered away, it will return the value of `default` (which if not provided defaults to `[null]`), since all number arrays must have at least one argument.

`input` and `filter` may be any ValueDefinition.

```
value: {
    input: [3, 4, 5],
    //Effetively [0,1,0]
    filter: [0, 1]
}
//Evaluates to [4]
```

#### ValueDefinitionCompare

Compares `a` and `b` at each index, and returns a result tied to the comparison operator, `1` if the comparison is true, and `0` if false.

`a` and `b` may be any ValueDefinition.

Valid operators are: '==' | '!=' | '<' | '>' | '<=' | '>='

```
value: {
    compare: '<',
    a: [3, 4, 5],
    b: [0, 10, 8]
}
//Evalutes to [0, 1, 1]
```

#### ValueDefinitionClip

Clips `input` to be at least `low` and at most `high`. Either `low` or `high` may be omitted. 

`input`, `low`, `high` may be any ValueDefinition.

```
value: {
    input: [-1, 5, 10],
    low: [0, 1]
}
//Evalutes to: [0, 5, 10]
value: {
    input: [-1, 5, 10],
    high: [5, 4]
}
//Evalutes to [-1, 4, 5]
value: {
    input: [-1, 5, 10],
    low: 0,
    high: 6
}
//Evalutes to [0, 5, 6]
```

#### ValueDefinitionRange

Returns the percentage between `low` and `high` that `range` is. The inverse of ValueDefinitionPercent.

`low`, `high`, and `range` may all be ValueDefinitions.

```
value: {
    range: [3, 4]
    low: 1,
    high: 5
}
//Evalutes to [0.25, 0.5]
```

#### ValueDefinitionPercent

Returns a value that is `percent` of the way from `low` to `high`. The inverse of ValueDefinitionRange.

`low`, `high`, and `percent` may all be ValueDefinitions.

```
value: {
    percent: [0.25, 0.5],
    low: 1,
    high: 5
}
//Evalutes to [3, 4]
```

#### ValueDefinitionInput

When ValueDefinitions are used as PropetyDefinition.value, the variable inputs are typical via ValueDefinitionConstant, ValueDefinitionResult, or ValueDefinitionRef. But in other contexts, there may be special input passed, for example MapDefinition.display.edgeCombiner properties.

This is the way to retrieving that supplemental input specific to the context. The documentation for each context will define what the input will be in that context. In contexts with no input, it's equivalent to `[null]`.

```
value: 'input'
```

#### ValueDefinitionHasTag

Checks to see if the result node has any of the tags enumerated in `has` and
returns [true] or [false]. If `all` is true, then it returns true only if all of
the enumerated tags are in the result.

The optional `which` parameter selects which tags to use for the comparison:
- `all` (default) - All of the node's final tags
- `self` - Only the tags specifically added to this node.
- `extended` - Only the tags this node got via an edge with `extendTags` set.

```
//node.tags = {a: true, b: true}
value: {
    has: {'a': true, 'c':true}
}
//Evaluates to true
value: {
    has: {'a': true, 'c':true}
    all: true
}
//Evaluates to false
value: {
    //Equivalent to {'a': true}
    has: 'a'
}
//Evaluates to true
value: {
    //Equivalent to {'a': true, 'c': true}
    has: ['a', 'c']
}
//Evalutes to true
```

#### ValueDefinitionTagConstant

Extracts the named constant for each of the tags on the result node.

If there are no tags on the result node it will evaluate to whatever was provided as the `default` parameter. If `default` is not provided, it defaults to `[0]`.

The optional `which` parameter selects which tags to use for the comparison:
- `all` (default) - All of the node's final tags
- `self` - Only the tags specifically added to this node.
- `extended` - Only the tags this node got via an edge with `extendTags` set.

```
//In MapDefinition:
tags: {
    tagA: {
        constants: {
            weight: 5,
            other: 2
        }
    },
    tagB: {
        constants: {
            //If this tag did not have weight or other, then the MapDefinition would not validate.
            weight: 2,
            other: 1
        }
    }
}

//Assuming node.tags = ['tagA', 'tagB']
value: {
    tagConstant: 'weight'
}
//Returns [5, 2]
```

#### ValueDefinitionLengthOf

Extends the input to be the same length as `edges`, `input`, or `refs`. This is useful in `display.edge` and `display.edgeCombiner` contexts where the number of returned values is important. 

`input` may be any ValueDefinition.

```
value: {
    //In this example, assume input has 4 items
    lengthOf: 'input',
    input: [0, 1]
}
//Evaluates to [0, 1, 0, 1]
```

#### ValueDefinitionCollect

Combines multiple input arrays into one longer array.

`collect` is an array of ValueDefinitions with at least one item.

```
value: {
    collect: [
        //For this example, assume input is [0, 1]
        'input',
        3,
        [4, 5]
    ]
}
//Evalutes to [0,1,3,4,5]
```

#### ValueDefinitionLet / ValueDefinitionVariable

Sets a given named variable to have a given variable within a sub-expression block.

Useful when you want to use the same sub-expression multiple times in a statement.

Use ValueDefinitionVariable to access the named variable within the block.

```
value: {
    let: 'foo',
    value: 3,
    //Within statements in block, the variable `foo` will be set to 3
    block: {
        operator: '+',
        a: {
            variable: 'foo'
        },
        b: 5
    }
}
//Evalutes to 8
```

#### ValueDefinitionLog

Logs the value passed to `log` to the console, and returns it upwards.

Useful for 

You can optionally provide a `message` parameter to prefix to the message.

```
//Assume above there is a let block of foo to 1.0
value: {
    //Logs 'log: message, [1.0]' to the console
    log: {
        variable: 'foo'
    },
    message: 'message'
}
//Evaluates to [1.0]
```

## Display

Display properties allow defining how nodes and edges render.

The display definitions have a collection of ValueDefinitions that are evaluated after all of the underlying values for nodes are calculated.

Display blocks can be defined at the top level at map.display, for type `node`, `edge`, and `edgeCombiner`, and those serve as defaults for every node and edge. Individual `node` and `PropertyDefinition` also have a `display` paramter for overriding the display of just that edge or display.

Because the properties are the same for every node, or for every edge of a given property, and since they can't reference one another, typically the value definitions are either constants or just reference a given property, and then the final result varies with those underlying values.

```
{
    //...
    display: {
        node: {
            radius: {
                result: 'value'
            }
        },
        edge: {
            width: {
                constant: 'weight'
            }
        }
    }
    //...
}
```

### Color shorthand

Each of `NodeDisplay`, `EdgeDisplay`, and `EdgeCombinerDisplay` arguments have a `color` (and sometimes `strokeColor`) value definition. In those cases, it's very common to have a single `color` ValueDefinition. If the value is a string, it is interpreted as being equivalent to `{color: STRING}`.

```
{
    //...
    display: {
        node: {
            //Both are equivalent to color: {color: 'red'}
            color: 'red'
            strokeColor: 'red'
        }
    }
    //...
}
```

### Node Display

Nodes have 6 values: `color`, `radius`, `opacity`, `strokeColor`, `strokeWidth`, and `strokeOpacity`.

Each of those is a ValueDefinition. The first number returned is used.

ValueDefinitions of type ValueDefinitionRefValue and ValueDefinitionEdgeValue will have no inputs in this context.

### Edge Display

Edges are more complex than nodes.

At the high level, first, we collect every source/ref/type tuple of edges and run the `color`, `width`, and `opacity` value definitions for each. If they return an array of numbers, then one edge for each index is passed on to the next step. (The property of `color`, `width`, `opacity`, and `distinct` with the longest length defines the number of edges, with the other properties being wrapped around to achieve the target length.)

For each source/ref/type tuple, a ValueDefintion of property `distinct` is also computed. For each edge in this step, if `distinct` for that edge index returns a truthy value, then that edge is added to the output step. If it returns a falsey value, it is instead added to the bundle of edges for the next step.

Now, we have an array of final edges, and a bundle of edges to combine, possibly of different types. For each source/ref pair, we take all of the edges produced by the earlier step and pass them to the `edgeCombiner` ValueDefintiions. In this context, the input from the previous step is available as the `ValueDefintiinInput` input value. Again, the final length of the array returned from this step defines how many edges to render (with the longest property defining the target length, and other properties being wrapped around to be long enough).

The behavior of how edge collapsing works means that if *any* of the properties returns an array of more than one number, then those edges will not be collapsed.

If any of these display properties are omitted, they are set to the defaults you can see at the top of `src/libraries.ts`.

Any edge that has a width of 0 will be culled from the final set.

## Scenarios

The default configuration in a map defines the diagram display.

However, it's also possible to define a set of 'scenarios' that set specific nodes to specific values, effectively defining a `values` property for any enumerated node.

```
const data : RawMapDefinition = {
    //...
    scenarios: {
        scenario_name_1: {
            node_a: {
                //Other enumerated values are left alone.
                one: 3
            }
        }
    }
    //...
};
```

The default defintion is implicitly the scenario named ''.

When there is more than one scenario defined, the UI shows a drop down allowing the user to select which scenario to render. The URL also includes the selected scenario. Hitting the left/right arrows also cycles through different scenarios.

The values for scenarios are any ValueDefinition. In this context, root, ref, result and edge constant statements are not allowed. The input will be the final result of what the node would have been had the scenario not applied.

So for example you could have the scenario define that the value for a node would be 4.0 more than it would have otherwise been:

```
const data : RawMapDefinition = {
    //...
    scenarios: {
        scenario_name_1: {
            node_a: {
                one: {
                    operator: '+',
                    a: 'input',
                    b: 4.0
                }
            }
        }
    }
    //...
};
```

If the ValueDefinition evalutes to more than one number, only the first will be used for the final value of that node's property in that scenario--an implicit `combine` of type `first`.

Scenarios may extend other scenarios, effectively overlaying any of their properties, by defining the `extends` parameter. Scenarios may not extend another scenario that also depends on them (which would form a cycle);

Finally, sometimes you have a sequence of scenarios, all of which should extend the one previous to them, animating in new states. If you provide an array of scenarios, then they will be expanded into a set:

```
const data : RawMapDefinition = {
    //...
    scenarios: {
        //Normal scenarios and arrays may be intermixed
        scenario_name_a: {
            node_a:{
                //...
            }
        }
        scenario_name_b: [
            //The name of this scenario will be `scenario_name_b_0`
            {
                //The first one in a sequence may extend a different sceario
                extends: 'scenario_name_a'
                node_a: {
                    //...
                }
            },
            //The name of this scenario will be `scenario_name_b_1`
            {
                //The `extends` will automatically be `scenario_nambe_b_0`. If one were provided explicitly here it would be overriden.
                node_b: {
                    //...
                }
            }
        ]
    }
    //...
}
```

## Tags

Diagrams also have a notion of `tags`. Tags are an enumerated set of binary tags. For example, in a diagram these might represent independent features that are represented in a product at each node.

They are defined on the MapDefinition.tags.

```
const data : RawMapDefinition = {
    //The tagID is the key
    one: {
        displayName: 'My tag',
        color: 'green',
        //Will be included in map.rootTags()
        root: true,
        //Each tag must enumerate the same constants
        constants: {
            weight: 5,
            //True, false, and null are also allowed
            include: true
        }
    },
    two: {
        //displayName will default to the tagID if not provided
        //color will default to 'red' if not provided
        constants: {
            weight: 2,
            include: false
        }
    }
}
```

Then, specific nodes can define tags they want to set true/false to override the rootTags:

```
const data : RawMapDefinition = {
    //...
    tags: {
        tagA: {},
        tagB: {}
    }
    nodes: {
        a: {
            //...
            tags: {
                //TagIDs must all be enumerated in map.tags.
                tagA: true,
                //Tags can be removed too
                tagB: false
            }
            //...
        },
        b: {
            //...
            //Equivalent to {tagA: true, tagB: true}
            tags: ['tagA', 'tagB']
            //...
        },
        c : {
            //...
            //Equivalent to {tagA: true}
            tags: 'tagA'
            //...
        }
    }
    //...
}
```

Tags are also included in a node's tags if from any node it has an edge to whose definition sets extendTags: true.

## Libraries

Properties and display values can be finicky to define and compose. Libraries allow a definition to load in pre-defined properties and display configurations to use as a base.

```
const data : RawMapDefinition = {
    //...
    import: ['distinct-across-type']
    //...
};
```

You can enumerate multiple libraries to import.

Legal values are defined below.

### product

Product is a large library that configures a number of properties for use in building product use case maps.

TODO: document

### generation

Adds a value called `generation` that counts how many layers deep each node is from the root node (via the shortest path).


### distinct-across-type

Including this library will make it so edges of various types will not be combined into one type, but rather show a different edge for each type.

### distinct-within-type

Including this library will make it so edges of the same type will not be combined into one edge but kept separate.