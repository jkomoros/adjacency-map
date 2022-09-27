import {
	AnyAction
} from "redux";

import {
	LOAD_DATA,
	UPDATE_FILENAME,
	DEFAULT_FILE_NAME
} from "../actions/data.js";

import {
	DataState,
} from "../types.js";

const INITIAL_STATE : DataState = {
	filename: DEFAULT_FILE_NAME,
	data: undefined,
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
	default:
		return state;
	}
};

export default data;
