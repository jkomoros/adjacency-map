import {
	AnyAction
} from "redux";

import {
	UPDATE_FILENAME,
	DEFAULT_FILE_NAME,
	UPDATE_SCALE,
	UPDATE_SCENARIO_NAME,
	UPDATE_HOVERED_NODE_ID,
	UPDATE_SELECTED_NODE_ID
} from "../actions/data.js";

import {
	DataState,
} from "../types.js";

const INITIAL_STATE : DataState = {
	filename: DEFAULT_FILE_NAME,
	scale: 1.0,
	scenarioName: '',
	hoveredNodeID: undefined
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
	default:
		return state;
	}
};

export default data;
