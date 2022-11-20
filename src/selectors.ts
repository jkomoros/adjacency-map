import { createSelector } from "reselect";

import {
	DEFAULT_FILE_NAME
} from './actions/data.js';

import {
	AdjacencyMap
} from './adjacency-map.js';

import {
	DEFAULT_SCENARIO_NAME,
	ENABLE_EDITING_SCENARIOS
} from './constants.js';

import {
	DATA
} from './data.GENERATED.js';

import {
	DataFilename,
	RootState,
	ScenarioNode,
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
export const selectShowEdges = (state : RootState) => state.data ? state.data.showEdges : false;
export const selectShowHiddenValues = (state : RootState) => state.data ? state.data.showHiddenValues : false;
export const selectScenariosOverlays = (state : RootState) => state.data ? state.data.scenariosOverlays : {};

//This doesn't actually need state, but in other ways its like a selector so kind of pretend like it is
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const selectLegalFilenames = (_state : RootState) => Object.keys(DATA) as DataFilename[];

const selectRawData = createSelector(
	selectFilename,
	(filename) => DATA[filename]
);

export const selectCurrentScenarioOverlay = createSelector(
	selectFilename,
	selectScenariosOverlays,
	(filename, overlays) => overlays[filename] || {}
);

export const selectData = createSelector(
	selectRawData,
	selectCurrentScenarioOverlay,
	(rawData, overlay) => ({...rawData, scenarios: {...rawData.scenarios, ...overlay}})
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
	(data, scenarioName) => {
		if (!data) return null;
		try {
			return new AdjacencyMap(data, scenarioName);
		} catch(err) {
			console.warn(err);
		}
		return null;
	}
);

export const selectAdjacencyMapError = createSelector(
	selectData,
	selectScenarioName,
	(data, scenarioName) => {
		if (!data) return '';
		try {
			new AdjacencyMap(data, scenarioName);
		} catch(err) {
			return String(err);
		}
		return '';
	}
);

export const selectLegalScenarioNames = createSelector(
	selectAdjacencyMap,
	(map) => map ? ['', ...Object.keys(map.data.scenarios || {})] : ['']
);

export const selectCurrentScenarioEditable = createSelector(
	selectScenarioName,
	selectCurrentScenarioOverlay,
	(scenarioName, overlay) => overlay[scenarioName] ? ENABLE_EDITING_SCENARIOS : false
);

export const selectCurrentScenarioEditedNodes = createSelector(
	selectCurrentScenarioEditable,
	selectCurrentScenarioOverlay,
	selectScenarioName,
	(editable, overlay, scenarioName) => {
		if (!editable) return {};
		const scenario = overlay[scenarioName];
		//This will happen if hte current scenario isn't editable
		if (!scenario) return {};
		return scenario.nodes;
	}
);

export const selectSelectedNodeFieldsEdited = createSelector(
	selectCurrentScenarioEditedNodes,
	selectSelectedNodeID,
	(nodes, nodeID) => {
		if (nodeID == undefined) return {};
		const nodeOverride : ScenarioNode = nodes[nodeID] || {values:{}};
		return Object.fromEntries(Object.keys(nodeOverride.values).map(key => [key, true]));
	}
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