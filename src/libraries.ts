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
						compare: '<',
						child: {constant: 'radius'},
						term: 0
					},
					then: {root: 'core:radius'},
					else: {constant: 'radius'}
				},
				constants: {
					'radius': -1
				},
				combine: 'max',
				hide: true
			}
		},
		root: {
			'core:radius': 3
		}
	}
};