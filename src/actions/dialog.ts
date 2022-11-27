export const OPEN_DIALOG = 'OPEN_DIALOG';
export const CLOSE_DIALOG = 'CLOSE_DIALOG';

import {
	AnyAction
} from 'redux';

export const openDialog = () : AnyAction => {
	return {
		type: OPEN_DIALOG,
	};
};

export const closeDialog = () : AnyAction => {
	return {
		type: CLOSE_DIALOG
	};
};