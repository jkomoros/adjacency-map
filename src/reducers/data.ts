import {
	AnyAction
} from "redux";

import {
	UPDATE_FILENAME,
	DEFAULT_FILE_NAME,
	UPDATE_SCALE,
	UPDATE_SCENARIO_NAME,
	UPDATE_HOVERED_NODE_ID,
	UPDATE_SELECTED_NODE_ID,
	UPDATE_SHOW_HIDDEN_VALUES,
	BEGIN_EDITING_SCENARIO,
	REMOVE_EDITING_SCENARIO,
	BEGIN_EDITING_NODE_VALUE,
	EDITING_UPDATE_NODE_VALUE,
	REMOVE_EDITING_NODE_VALUE
} from "../actions/data.js";

import {
	DataState,
	DataFilename,
	ScenarioName,
	ScenariosOverlays,
	NodeID,
	PropertyName
} from "../types.js";

import {
	deepCopy
} from "../util.js";

const INITIAL_STATE : DataState = {
	filename: DEFAULT_FILE_NAME,
	scale: 1.0,
	scenarioName: '',
	hoveredNodeID: undefined,
	showHiddenValues: false,
	scenariosOverlays: {}
};

const addScenarioToScenariosOverlay = (filename: DataFilename, currentScenarioName : ScenarioName, newScenarioName: ScenarioName, currentOverlay : ScenariosOverlays) : ScenariosOverlays => {
	return {
		...currentOverlay,
		[filename]: {
			...(currentOverlay[filename] || {}),
			[newScenarioName]: {
				extends: currentScenarioName,
				description: 'A custom scenario based on ' + currentScenarioName,
				nodes: {}
			}
		}
	};
};

const removeScenarioFromScenariosOverlay = (filename : DataFilename, scenarioName : ScenarioName, currentOverlay : ScenariosOverlays) : ScenariosOverlays => {
	const result = deepCopy(currentOverlay);
	const fileOverlay = result[filename];
	if (fileOverlay) {
		delete fileOverlay[scenarioName];
		if (Object.keys(fileOverlay).length == 0) delete result[filename];
	}
	return result;
};

const beginEditingNodeValueInOverlay = (filename: DataFilename, scenarioName: ScenarioName, currentOverlay: ScenariosOverlays, nodeID : NodeID, propertyName : PropertyName, value : number) : ScenariosOverlays => {
	const result = deepCopy(currentOverlay);
	const filenameOverlay = result[filename];
	if (filenameOverlay == undefined) throw new Error('filename overlay unexpectededly not set');
	const scenarioOverlay = filenameOverlay[scenarioName];
	if (scenarioOverlay == undefined) throw new Error('scenarioOverlay unexpectedly not set');
	const nodes = scenarioOverlay.nodes;
	if (!nodes[nodeID]) nodes[nodeID] = {};
	const node = nodes[nodeID];
	node[propertyName] = value;
	return result;
};

const editingUpdateNodeValueInOverlay = (filename: DataFilename, scenarioName: ScenarioName, currentOverlay: ScenariosOverlays, nodeID : NodeID, propertyName : PropertyName, value: number) : ScenariosOverlays => {
	const result = deepCopy(currentOverlay);
	const filenameOverlay = result[filename];
	if (filenameOverlay == undefined) throw new Error('filename overlay unexpectededly not set');
	const scenarioOverlay = filenameOverlay[scenarioName];
	if (scenarioOverlay == undefined) throw new Error('scenarioOverlay unexpectedly not set');
	const nodes = scenarioOverlay.nodes;
	if (!nodes[nodeID]) throw new Error('unexpectedly nodes was not set');
	const node = nodes[nodeID];
	node[propertyName] = value;
	return result;
};

const removeEditingNodeValueInOverlay = (filename: DataFilename, scenarioName: ScenarioName, currentOverlay: ScenariosOverlays, nodeID : NodeID, propertyName : PropertyName) : ScenariosOverlays => {
	const result = deepCopy(currentOverlay);
	const filenameOverlay = result[filename];
	if (filenameOverlay == undefined) throw new Error('filename overlay unexpectededly not set');
	const scenarioOverlay = filenameOverlay[scenarioName];
	if (scenarioOverlay == undefined) throw new Error('scenarioOverlay unexpectedly not set');
	const nodes = scenarioOverlay.nodes;
	if (!nodes[nodeID]) throw new Error('nodes unexpectedly not set');
	const node = nodes[nodeID];
	delete node[propertyName];
	//If that was the last property then remove the item
	if (Object.keys(node).length == 0) delete node[nodeID];
	return result;
};

const data = (state : DataState = INITIAL_STATE, action : AnyAction) : DataState => {
	switch (action.type) {
	case UPDATE_FILENAME:
		return {
			...state,
			scenarioName: DEFAULT_FILE_NAME,
			filename: action.filename
		};
	case UPDATE_SCALE:
		return {
			...state,
			scale: action.scale
		};
	case UPDATE_SCENARIO_NAME:
		return {
			...state,
			scenarioName: action.scenarioName
		};
	case UPDATE_HOVERED_NODE_ID:
		return {
			...state,
			hoveredNodeID: action.nodeID
		};
	case UPDATE_SELECTED_NODE_ID:
		return {
			...state,
			selectedNodeID: action.nodeID
		};
	case UPDATE_SHOW_HIDDEN_VALUES:
		return {
			...state,
			showHiddenValues: action.showHiddenValues
		};
	case BEGIN_EDITING_SCENARIO:
		return {
			...state,
			scenarioName: action.scenarioName,
			scenariosOverlays: addScenarioToScenariosOverlay(state.filename, state.scenarioName, action.scenarioName, state.scenariosOverlays)
		};
	case REMOVE_EDITING_SCENARIO: 
		return {
			...state,
			scenarioName: state.scenarioName == action.scenarioName ? action.nextScenarioName : state.scenarioName,
			scenariosOverlays: removeScenarioFromScenariosOverlay(state.filename, action.scenarioName, state.scenariosOverlays)
		};
	case BEGIN_EDITING_NODE_VALUE:
		return {
			...state,
			scenariosOverlays: beginEditingNodeValueInOverlay(state.filename, state.scenarioName, state.scenariosOverlays, state.selectedNodeID as NodeID, action.propertyName, action.value)
		};
	case EDITING_UPDATE_NODE_VALUE:
		return {
			...state,
			scenariosOverlays: editingUpdateNodeValueInOverlay(state.filename, state.scenarioName, state.scenariosOverlays, state.selectedNodeID as NodeID, action.propertyName, action.value)
		};
	case REMOVE_EDITING_NODE_VALUE:
		return {
			...state,
			scenariosOverlays: removeEditingNodeValueInOverlay(state.filename, state.scenarioName, state.scenariosOverlays, state.selectedNodeID as NodeID, action.propertyName)
		};
	default:
		return state;
	}
};

export default data;
