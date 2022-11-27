import {
	AnyAction
} from 'redux';

import {
	SET_DIALOG_OPEN
} from '../actions/dialog.js';

import {
	DialogState
} from '../types.js';

const INITIAL_STATE : DialogState = {
	open: false
};

const app = (state : DialogState = INITIAL_STATE, action : AnyAction) : DialogState => {
	switch (action.type) {
	case SET_DIALOG_OPEN:
		return {
			...state,
			open: action.open
		};
	default:
		return state;
	}
};

export default app;
