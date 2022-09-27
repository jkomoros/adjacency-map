export const LOAD_DATA = "LOAD_DATA";
export const UPDATE_FILENAME = 'UPDATE_FILENAME';

export const DEFAULT_FILE_NAME = 'default';
//Also in tools/config.ts
export const DATA_DIRECTORY = 'data';

import {
	canonicalizePath
} from './app.js';

import {
	selectFilename,
} from '../selectors.js';

import {
	AppActionCreator,
} from '../store.js';

import {
	Filename,
} from '../types.js';

export const loadData : AppActionCreator = (blob) => (dispatch) => {
	let data;
	try {
		data = unpackConfigJSON(blob);
	} catch(err) {
		console.warn('Couldn\'t load data:' + err);
		return;
	}
	dispatch({
		type: LOAD_DATA,
		data,
	});
};

export const updateFilename : AppActionCreator = (filename : Filename, skipCanonicalize = false) => (dispatch, getState) => {
	const state = getState();
	const currentFilename = selectFilename(state);
	if (currentFilename == filename) return;
	dispatch({
		type: UPDATE_FILENAME,
		filename,
	});
	if (!skipCanonicalize) dispatch(canonicalizePath());
};