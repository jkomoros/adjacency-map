import { createSelector } from "reselect";

import {
	DEFAULT_FILE_NAME
} from './actions/data.js';

import {
	AdjacencyMap,
	nodeIDFromLayoutID
} from './adjacency-map.js';

import {
	DEFAULT_SCENARIO_NAME
} from './constants.js';

import {
	DATA,
	SIDECAR_EDITS
} from './data.GENERATED.js';

import {
	DataFilename,
	DialogKind,
	LayoutID,
	RootState,
	ScenarioNode
} from './types.js';

import {
	stringifyURLHashArgs
} from './util.js';

export const selectFilename = (state : RootState) => state.data ? state.data.filename : DEFAULT_FILE_NAME;
export const selectPage = (state : RootState) => state.app ? state.app.page : '';
export const selectPageExtra = (state : RootState) => state.app ? state.app.pageExtra : '';
export const selectHash = (state : RootState) => state.app ? state.app.hash : '';
export const selectScale = (state : RootState) => state.data ? state.data.scale : 1.0;
export const selectScenarioName = (state : RootState) => state.data ? state.data.scenarioName : '';
export const selectEditing = (state : RootState) => state.data ? state.data.editing : false;
export const selectHoveredLayoutID = (state : RootState) => state.data ? state.data.hoveredLayoutID : undefined;
export const selectHoveredEdgeID = (state : RootState) => state.data ? state.data.hoveredEdgeID : undefined;
export const selectSelectedLayoutID = (state : RootState) => state.data ? state.data.selectedLayoutID : undefined;
export const selectShowEdges = (state : RootState) => state.data ? state.data.showEdges : false;
export const selectRenderGroups = (state : RootState) => state.data ? state.data.renderGroups : false;
export const selectShowHiddenValues = (state : RootState) => state.data ? state.data.showHiddenValues : false;
export const selectScenariosOverlays = (state : RootState) => state.data ? state.data.scenariosOverlays : {};
export const selectDialogOpen = (state : RootState) => state.dialog ? state.dialog.open : false;
export const selectDialogKind = (state : RootState) : DialogKind => state.dialog ? state.dialog.kind : '';
export const selectDialogMessage = (state : RootState) => state.dialog ? state.dialog.message : '';

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

const selectSidecarScenarios = createSelector(
	selectFilename,
	(filename) => SIDECAR_EDITS[filename] || {}
);

export const selectData = createSelector(
	selectRawData,
	selectSidecarScenarios,
	selectCurrentScenarioOverlay,
	(rawData, sidecar, overlay) => ({...rawData, scenarios: {...rawData.scenarios, ...sidecar, ...overlay}})
);

export const selectAdjacencyMap = createSelector(
	selectData,
	selectScenarioName,
	selectRenderGroups,
	(data, scenarioName, renderGroups) => {
		if (!data) return null;
		try {
			return new AdjacencyMap(data, scenarioName, !renderGroups);
		} catch(err) {
			console.warn(err);
		}
		return null;
	}
);

//The node that should be used for the summary readout
export const selectSummaryLayoutID = createSelector(
	selectHoveredLayoutID,
	selectSelectedLayoutID,
	selectAdjacencyMap,
	(hoveredLayoutID, selectedLayoutID, map) => {
		const valid = (id : LayoutID | undefined) : LayoutID | undefined => {
			if (id === undefined || !map) return undefined;
			try { map.layoutNode(id); return id; } catch { return undefined; }
		};
		return valid(hoveredLayoutID) || valid(selectedLayoutID);
	}
);

export const selectAdjacencyMapError = createSelector(
	selectData,
	selectScenarioName,
	selectRenderGroups,
	(data, scenarioName, renderGroups) => {
		if (!data) return '';
		try {
			new AdjacencyMap(data, scenarioName, !renderGroups);
		} catch(err) {
			const e = err as Error;
			return e.message;
		}
		return '';
	}
);

export const selectLegalScenarioNames = createSelector(
	selectAdjacencyMap,
	(map) => map ? [DEFAULT_SCENARIO_NAME, ...Object.keys(map.data.scenarios || {})] : [DEFAULT_SCENARIO_NAME]
);

export const selectCurrentScenarioEditable = createSelector(
	selectScenarioName,
	selectCurrentScenarioOverlay,
	selectEditing,
	(scenarioName, overlay, editing) => overlay[scenarioName] ? editing : false
);

export const selectEditableScenarios = createSelector(
	selectCurrentScenarioOverlay,
	selectEditing,
	(overlay, editing) => editing ? overlay : {}
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

export const selectSelectedNodeID = createSelector(
	selectSelectedLayoutID,
	selectAdjacencyMap,
	(layoutID, map) => {
		if (layoutID === undefined) return undefined;
		if (!map) return undefined;
		try {
			map.layoutNode(layoutID);
		} catch {
			return undefined;
		}
		return nodeIDFromLayoutID(layoutID);
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
	selectSelectedLayoutID,
	selectAdjacencyMap,
	(scenarioName, selectedLayoutID, map) => {
		let validSelectedLayoutID : LayoutID | undefined;
		if (selectedLayoutID && map) {
			try {
				map.layoutNode(selectedLayoutID);
				validSelectedLayoutID = selectedLayoutID;
			} catch {
				validSelectedLayoutID = undefined;
			}
		}
		return stringifyURLHashArgs({
			s: scenarioName != DEFAULT_SCENARIO_NAME ? scenarioName : undefined,
			n: validSelectedLayoutID
		});
	}
);

export const selectSummaryNodeDisplayName = createSelector(
	selectSummaryLayoutID,
	selectAdjacencyMap,
	(nodeID, map) => {
		if (!map) return '';
		if (nodeID === undefined) return undefined;
		const node = map.layoutNode(nodeID);
		return node.displayName;
	}
);

export const selectSummaryDescription = createSelector(
	selectSummaryLayoutID,
	selectAdjacencyMap,
	(nodeID, map) => {
		if (!map) return '';
		if (nodeID === undefined) return map.description;
		const node = map.layoutNode(nodeID);
		return node.description;
	}
);

export const selectSummaryValues = createSelector(
	selectSummaryLayoutID,
	selectAdjacencyMap,
	(nodeID, map) => {
		if (!map) return {};
		if (nodeID === undefined) return map.result;
		const node = map.layoutNode(nodeID);
		return node.values;
	}
);

export const selectSummaryTags = createSelector(
	selectSummaryLayoutID,
	selectAdjacencyMap,
	(nodeID, map) => {
		if (!map) return {};
		if (nodeID === undefined) return map.tagsUnion;
		const node = map.layoutNode(nodeID);
		return node.tags;
	}
);

export const selectHeadlineMetrics = createSelector(
	selectAdjacencyMap,
	(map) : {property: string, value: number}[] => {
		if (!map) return [];
		const result = map.result || {};
		// Access the optional headlineMetrics config from the data's display block.
		const configured = (map.data && (map.data as any).display && (map.data as any).display.headlineMetrics) as string[] | undefined;
		const entries : {property: string, value: number}[] = [];
		const candidates = configured && configured.length > 0
			? configured
			: Object.keys(result).filter(k => typeof (result as any)[k] === 'number' && Math.abs((result as any)[k] as number) > 1e-9);
		for (const k of candidates) {
			const v = (result as any)[k];
			if (typeof v !== 'number') continue;
			entries.push({ property: k, value: v });
		}
		if (!configured) entries.splice(6);
		return entries;
	}
);
