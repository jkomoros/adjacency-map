export const OPEN_DIALOG = 'OPEN_DIALOG';
export const CLOSE_DIALOG = 'CLOSE_DIALOG';

import {
	AnyAction
} from 'redux';

import {
	DialogKind
} from '../types';

export const showError = (message : string) : AnyAction => {
	return openDialog('error', message);
};

export const showReadout = () : AnyAction => {
	return openDialog('readout');
};

const openDialog = (kind : DialogKind = '', message = '') : AnyAction => {
	return {
		type: OPEN_DIALOG,
		kind,
		message
	};
};

export const closeDialog = () : AnyAction => {
	return {
		type: CLOSE_DIALOG
	};
};