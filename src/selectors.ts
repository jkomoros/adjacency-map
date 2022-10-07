import { createSelector } from "reselect";

import {
	DEFAULT_FILE_NAME
} from './actions/data.js';

import {
	AdjacencyMap
} from './adjacency-map.js';

import {
	DEFAULT_SCENARIO_NAME
} from './constants.js';

import {
	DATA
} from './data.GENERATED.js';

import {
	DataFilename,
	RootState,
	URLHashArgs
} from './types.js';

export const selectFilename = (state : RootState) => state.data ? state.data.filename : DEFAULT_FILE_NAME;
export const selectPage = (state : RootState) => state.app ? state.app.page : '';
export const selectPageExtra = (state : RootState) => state.app ? state.app.pageExtra : '';
export const selectHash = (state : RootState) => state.app ? state.app.hash : '';
export const selectScale = (state : RootState) => state.data ? state.data.scale : 1.0;
export const selectScenarioName = (state : RootState) => state.data ? state.data.scenarioName : '';

//This doesn't actually need state, but in other ways its like a selector so kind of pretend like it is
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const selectLegalFilenames = (_state : RootState) => Object.keys(DATA) as DataFilename[];

export const selectData = createSelector(
	selectFilename,
	(filename) => DATA[filename]
);

export const selectLegalScenarioNames = createSelector(
	selectData,
	(data) => data ? ['', ...Object.keys(data.scenarios || {})] : ['']
);

export const selectAdjacencyMap = createSelector(
	selectData,
	selectScenarioName,
	(data, scenarioName) => data ? new AdjacencyMap(data, scenarioName) : null
);

export const selectHashForCurrentState = createSelector(
	selectScenarioName,
	(scenarioName) => {
		const pieces : URLHashArgs = {};
		if (scenarioName != DEFAULT_SCENARIO_NAME) pieces.s = scenarioName;
		return Object.entries(pieces).map(entry => entry[0] + '=' + entry[1]).join('&');
	}
);