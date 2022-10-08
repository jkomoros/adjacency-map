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

## Nodes

## Edges

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
