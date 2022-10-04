import {
	Library,
	LibraryType
} from './types.js';

export const CORE_LIBRARY_NAME = 'core';

export const LIBRARIES : {[type in LibraryType] : Library} = {
	core: {
		//Core currently doesn't define anything
		properties: {},
		root: {}
	}
};