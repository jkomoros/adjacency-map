export const UPDATE_FILENAME = 'UPDATE_FILENAME';
export const UPDATE_SCALE = 'UPDATE_SCALE';
export const UPDATE_SCENARIO_NAME = 'UPDATE_SCENARIO_NAME';

export const DEFAULT_FILE_NAME = 'default';
//Also in tools/config.ts
export const DATA_DIRECTORY = 'data';

import {
	canonicalizePath
} from './app.js';

import {
	selectFilename,
	selectLegalScenarioNames,
	selectScale,
	selectScenarioName
} from '../selectors.js';

import {
	AppActionCreator,
} from '../store.js';

import {
	DataFilename,
	ScenarioName
} from '../types.js';

import {
	AnyAction
} from 'redux';

export const updateFilename : AppActionCreator = (filename : DataFilename, skipCanonicalize = false) => (dispatch, getState) => {
	const state = getState();
	const currentFilename = selectFilename(state);
	if (currentFilename == filename) return;
	dispatch({
		type: UPDATE_FILENAME,
		filename,
	});
	if (!skipCanonicalize) dispatch(canonicalizePath());
};

export const updateScale : AppActionCreator = (scale) => (dispatch, getState) => {
	if (scale == selectScale(getState())) return;
	dispatch({
		type: UPDATE_SCALE,
		scale,
	});
};

export const nextScenarioName : AppActionCreator = () => (dispatch, getState) => {
	const state = getState();
	const legalNames = selectLegalScenarioNames(state);
	const currentName = selectScenarioName(state);
	let result = 0;
	for (let i = 0; i < legalNames.length; i++) {
		result = i;
		if (legalNames[i] == currentName) break;
	}
	result++;
	if (result >= legalNames.length) result = legalNames.length - 1;
	dispatch(updateScenarioName(legalNames[result]));
};

export const previousScenarioName : AppActionCreator = () => (dispatch, getState) => {
	const state = getState();
	const legalNames = selectLegalScenarioNames(state);
	const currentName = selectScenarioName(state);
	let result = 0;
	for (let i = 0; i < legalNames.length; i++) {
		result = i;
		if (legalNames[i] == currentName) break;
	}
	result--;
	if (result < 0) result = 0;
	dispatch(updateScenarioName(legalNames[result]));
};

export const updateScenarioName = (scenarioName : ScenarioName) : AnyAction => {
	return {
		type: UPDATE_SCENARIO_NAME,
		scenarioName,
	};
};

export const updateWithMainPageExtra : AppActionCreator = (pageExtra) => (dispatch) => {
	const parts = pageExtra.split('/');
	//The last piece is the trailing slash
	//TODO: handle malformed URLs better
	if (parts.length != 1) return;
	const filename = parts[0];

	//Each of these will return if a no op
	dispatch(updateFilename(filename, true));
};