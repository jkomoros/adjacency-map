export const OPEN_DIALOG = 'OPEN_DIALOG';
export const CLOSE_DIALOG = 'CLOSE_DIALOG';

import {
	AnyAction
} from 'redux';

import {
	DialogKind
} from '../types';

export const openDialog = (kind : DialogKind = '') : AnyAction => {
	return {
		type: OPEN_DIALOG,
		kind
	};
};

export const closeDialog = () : AnyAction => {
	return {
		type: CLOSE_DIALOG
	};
};