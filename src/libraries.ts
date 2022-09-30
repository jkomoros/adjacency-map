import {
	Library,
	LibraryType
} from './types.js';

export const LIBRARIES : {[type in LibraryType] : Library} = {
	core: {
		types: {
			'core:radius': {
				description: 'The radius to use to render the node',
				value: 3
			}
		}
	}
};