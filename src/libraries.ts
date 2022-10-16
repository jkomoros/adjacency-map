import {
	EdgeCombinerDisplay,
	EdgeDisplay,
	Library,
	LibraryType,
	NodeDisplay,
	ValueDefinition
} from './types.js';

export const CORE_LIBRARY_NAME = 'core';

export const BASE_NODE_DISPLAY : NodeDisplay = {
	radius: 6,
	opacity: 1.0,
	color: {
		color: '#333'
	},
	strokeWidth: 0.0,
	strokeOpacity: 1.0,
	strokeColor: {
		color: '#000'
	}
};

//Since none of these return an array of numbers, edges of the same type from
//the same ref/source pair will be combined together. If you want them to not
//combine, override one of these to return {lengthOf:'edges', value: FOO}
export const BASE_EDGE_DISPLAY : EdgeDisplay = {
	width: 1.5,
	color: {
		color: '#555'
	},
	opacity: 0.4,
	distinct: false
};

export const BASE_EDGE_COMBINER_DISPLAY : EdgeCombinerDisplay = {
	width: {
		combine: 'sum',
		value: 'input'
	},
	color: {
		color: '#555'
	},
	opacity: 0.4
};

export const LIBRARIES : {[type in LibraryType] : Library} = {
	core: {
		//Core currently doesn't define anything
		properties: {},
		root: {}
	},
	//Returns a value for the smallest number of hops away from root it is
	generation: {
		properties: {
			generation: {
				description: 'The smallest number of edges to get back to root',
				combine: 'min',
				hide: true,
				display: {
					width: 0
				},
				value: {
					operator: '+',
					a: {
						ref: '.'
					},
					b: 1
				}
			}
		},
		root: {
			generation: 0
		}
	},
	//Including this library will make it so edges of various types will not be
	//combined into one type, but rather show a different edge for each type.
	'distinct-across-type': {
		display: {
			edgeCombiner: {
				width: {
					lengthOf: 'input',
					value: BASE_EDGE_COMBINER_DISPLAY.width
				},
				color: {
					lengthOf: 'input',
					value: BASE_EDGE_COMBINER_DISPLAY.color as ValueDefinition
				},
				opacity: {
					lengthOf: 'input',
					value: BASE_EDGE_COMBINER_DISPLAY.opacity
				}
			}
		},
		properties: {},
		root: {}
	},
	//Including this library will make it so edges of the same type will not be
	//combined into one edge but kept separate.
	'distinct-within-type': {
		display: {
			edge: {
				width: {
					lengthOf: 'input',
					value: BASE_EDGE_DISPLAY.width
				},
				color: {
					lengthOf: 'input',
					value: BASE_EDGE_DISPLAY.color as ValueDefinition
				},
				opacity: {
					lengthOf: 'input',
					value: BASE_EDGE_DISPLAY.opacity
				},
				distinct: {
					lengthOf: 'input',
					value: BASE_EDGE_DISPLAY.distinct
				}
			}
		},
		properties: {},
		root: {}
	}
};