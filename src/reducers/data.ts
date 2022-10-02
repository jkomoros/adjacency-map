import {
	AnyAction
} from "redux";

import {
	LOAD_DATA,
	UPDATE_FILENAME,
	DEFAULT_FILE_NAME,
	UPDATE_SCALE
} from "../actions/data.js";

import {
	DataState,
} from "../types.js";

const INITIAL_STATE : DataState = {
	filename: DEFAULT_FILE_NAME,
	data: undefined,
	scale: 1.0
};

const data = (state : DataState = INITIAL_STATE, action : AnyAction) : DataState => {
	switch (action.type) {
	case LOAD_DATA:
		return {
			...state,
			data: action.data,
		};
	case UPDATE_FILENAME:
		return {
			...state,
			filename: action.filename
		};
	case UPDATE_SCALE:
		return {
			...state,
			scale: action.scale
		};
	default:
		return state;
	}
};

export default data;
