import { createSelector } from "reselect";

import {
	AdjacencyMap
} from './adjacency-map.js';

import {
	RootState
} from './types.js';

export const selectFilename = (state : RootState) => state.data ? state.data.filename : '';
export const selectPage = (state : RootState) => state.app ? state.app.page : '';
export const selectPageExtra = (state : RootState) => state.app ? state.app.pageExtra : '';
export const selectData = (state : RootState) => state.data?.data;

export const selectAdjacencyMap = createSelector(
	selectData,
	(data) => data ? new AdjacencyMap(data) : null
);