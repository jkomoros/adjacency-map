import { createSelector } from "reselect";

import {
	DEFAULT_FILE_NAME
} from './actions/data.js';

import {
	AdjacencyMap
} from './adjacency-map.js';

import {
	DATA
} from './data.GENERATED.js';

import {
	RootState
} from './types.js';

export const selectFilename = (state : RootState) => state.data ? state.data.filename : DEFAULT_FILE_NAME;
export const selectPage = (state : RootState) => state.app ? state.app.page : '';
export const selectPageExtra = (state : RootState) => state.app ? state.app.pageExtra : '';
export const selectScale = (state : RootState) => state.data ? state.data.scale : 1.0;

export const selectData = createSelector(
	selectFilename,
	(filename) => DATA[filename]
);

export const selectAdjacencyMap = createSelector(
	selectData,
	(data) => data ? new AdjacencyMap(data) : null
);