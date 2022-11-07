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
	BEGIN_EDITING_SCENARIO
} from "../actions/data.js";

import {
	DataState,
	DataFilename,
	ScenarioName,
	ScenariosOverlays,
} from "../types.js";

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
	default:
		return state;
	}
};

export default data;
