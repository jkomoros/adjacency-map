import {
	Library,
	LibraryType
} from './types.js';

export const CORE_LIBRARY_NAME = 'core';

export const LIBRARIES : {[type in LibraryType] : Library} = {
	core: {
		properties: {
			'core:radius': {
				description: 'The radius to use to render the node',
				usage: "If you want to set the default radius, set root.core:radius If you want to override just one node's radius, add an edge of type 'core:radius' with a constant of radius of the value you want.",
				value: {
					if: {
						compare: '!=',
						a: {constant: 'radius'},
						b: null
					},
					then: {constant: 'radius'},
					else: {root: 'core:radius'}
				},
				constants: {
					'radius': null
				},
				combine: 'max',
				hide: true
			},
			'core:opacity': {
				description: 'The percentage opacity to use for a node',
				usage: "If you want to set the default opacity, set root.core:opacity If you want to override just one node's opacity, add an edge of type 'core:opacity' with a constant of opacity of the value you want.",
				value: {
					if: {
						compare: '!=',
						a: {constant: 'opacity'},
						b: null
					},
					then: {constant: 'opacity'},
					else: {root: 'core:opacity'}
				},
				constants: {
					'opacity': null
				},
				combine: 'mean',
				hide: true
			}
		},
		root: {
			'core:radius': 6.0,
			'core:opacity': 1.0,
		}
	}
};