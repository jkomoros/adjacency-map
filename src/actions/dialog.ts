export const SET_DIALOG_OPEN = 'SET_DIALOG_OPEN';

import {
	AnyAction
} from 'redux';

export const setDialogOpen = (open : boolean) : AnyAction => {
	return{
		type: SET_DIALOG_OPEN,
		open
	};
};