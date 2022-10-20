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
export const selectHoveredNodeID = (state : RootState) => state.data ? state.data.hoveredNodeID : undefined;
export const selectSelectedNodeID = (state : RootState) => state.data ? state.data.selectedNodeID : undefined;
export const selectShowHiddenValues = (state : RootState) => state.data ? state.data.showHiddenValues : false;

//This doesn't actually need state, but in other ways its like a selector so kind of pretend like it is
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const selectLegalFilenames = (_state : RootState) => Object.keys(DATA) as DataFilename[];

export const selectData = createSelector(
	selectFilename,
	(filename) => DATA[filename]
);

//The node that should be used for the summary readout
export const selectSummaryNodeID = createSelector(
	selectHoveredNodeID,
	selectSelectedNodeID,
	(hoveredNodeID, selectedNodeID) => hoveredNodeID || selectedNodeID
);

export const selectAdjacencyMap = createSelector(
	selectData,
	selectScenarioName,
	(data, scenarioName) => data ? new AdjacencyMap(data, scenarioName) : null
);

export const selectLegalScenarioNames = createSelector(
	selectAdjacencyMap,
	(map) => map ? ['', ...Object.keys(map.data.scenarios || {})] : ['']
);

export const selectHashForCurrentState = createSelector(
	selectScenarioName,
	(scenarioName) => {
		const pieces : URLHashArgs = {};
		if (scenarioName != DEFAULT_SCENARIO_NAME) pieces.s = scenarioName;
		return Object.entries(pieces).map(entry => entry[0] + '=' + entry[1]).join('&');
	}
);

export const selectSummaryNodeDisplayName = createSelector(
	selectSummaryNodeID,
	selectAdjacencyMap,
	(nodeID, map) => {
		if (!map) return '';
		if (nodeID === undefined) return undefined;
		const node = map.node(nodeID);
		return node.displayName;
	}
);

export const selectSummaryDescription = createSelector(
	selectSummaryNodeID,
	selectAdjacencyMap,
	(nodeID, map) => {
		if (!map) return '';
		if (nodeID === undefined) return map.description;
		const node = map.node(nodeID);
		return node.description;
	}
);

export const selectSummaryValues = createSelector(
	selectSummaryNodeID,
	selectAdjacencyMap,
	(nodeID, map) => {
		if (!map) return {};
		if (nodeID === undefined) return map.result;
		const node = map.node(nodeID);
		return node.values;
	}
);

export const selectSummaryTags = createSelector(
	selectSummaryNodeID,
	selectAdjacencyMap,
	(nodeID, map) => {
		if (!map) return {};
		if (nodeID === undefined) return map.tagsUnion;
		const node = map.node(nodeID);
		return node.tags;
	}
);