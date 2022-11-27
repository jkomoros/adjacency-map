import {
	AnyAction
} from 'redux';

import {
	OPEN_DIALOG,
	CLOSE_DIALOG
} from '../actions/dialog.js';

import {
	DialogState
} from '../types.js';

const INITIAL_STATE : DialogState = {
	open: true,
	kind: ''
};

const app = (state : DialogState = INITIAL_STATE, action : AnyAction) : DialogState => {
	switch (action.type) {
	case OPEN_DIALOG:
		return {
			...state,
			open: true,
			kind: action.kind
		};
	case CLOSE_DIALOG:
		return {
			...state,
			open: false,
			kind: '',
		};
	default:
		return state;
	}
};

export default app;
