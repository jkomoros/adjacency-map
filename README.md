# Adjaceny Map

Adjacency map is a tool to make it easy to create "adjacency maps" that show how different use cases or outcomes are related to other, previously done work.

It contains a powerful caluclation and configuration engine.

![demo](/examples/demo.png?raw=true)

## Installing

Install npm.

Check out this repo.

Run `npm install` to install dependencies.

### Installing on Apple Silicon

The machinery to do screenshotting relies on a library that doesn't install cleanly on Apple Silicon.

Can get everything but screenshots running with `npm install --only=prod`

Install homebrew if not already installed

Run `arch -arm64 brew install pkg-config cairo pango libpng jpeg giflib librsvg`

Then run `npm install canvas` and `npm install`

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
2) Overlaying any values for this node explicitly defined it its **values** property, or implicitly defined in the active scenario. Any property that has a value explicitly defined will have that be the final value, skipping the last step.
3) Implicitly calculating the final value for each property type by aggregating all of the edges of that property that terminate in this node, and then passing those edges to the calculation expression definined on that property's `value` property.
4) Using the configuration defined in the various `display` properties on the map itself, each property type, and each node to determine color, opacity, width, etc of nodes and edges to display.

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

### combine? : CombinerType

The final value for a node has to reduce a potentially multi-entry array of numbers (e.g. if there are multiple edges of this type) down to a single number. This combiner will be run on the final result, reducing it to a single number. Any `CombinerType` is allowed; if not included, it defaults to `mean`.

### display? : EdgeDisplay

Defines how to display this edge by default. See the `display` section below for how these configurations work.

### implies? : ImpliesConfiguration

A value of a given node will only have an interesting (non-root default) value set if there is at least one edge of that type incoming.

Often you want values to 'flow' through nodes at long as there is any edge from one to the other, of any type. implies is machinery that allows the precense of one edge type from a ref/result node pair to imply other edges (with their constants all set to the default) as well.

This is where an edge can define a default implication of other edges whenever it shows up. Read more at 'Implied edges', below.

### excludeFromDefaultImplication? : boolean

A common value for `implies` is `*`, which means "include all other nodes". However, some edges really only want to be inclued if they are explicitly added. This allows a property type to opt out of being implied via `*`, unless they are specifically implied by another node.

### hide? : true

Some edges, especially in libraries, are for internals and don't want to be shown in final rendered output to users. This allows those edges to define they are internal and shouldn't be shown by default to end users.

## Nodes

### The root node

## Edges

### Implied edges

## Value Definitions

### Array calculation

### Combiner

### True, false, and null

### Color

### Value Definition Reference

## Display

### Node Display

### Edge Display

## Scenarios

## Libaries
