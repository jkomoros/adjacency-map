import {
	EdgeCombinerDisplay,
	EdgeDisplay,
	Library,
	LibraryType,
	NodeDisplay
} from './types.js';

export const CORE_LIBRARY_NAME = 'core';

export const BASE_NODE_DISPLAY : NodeDisplay = {
	radius: 6,
	opacity: 1.0,
	color: {
		color: '#333'
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
	}
};